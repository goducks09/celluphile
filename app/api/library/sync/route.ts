import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { Types } from 'mongoose';
import dbConnect from '@/app/lib/mongoose';
import Movie from '@/app/models/movie';
import UserMovie from '@/app/models/userMovie';
import UserWishlist from '@/app/models/userWishlist';
import UserEvent from '@/app/models/userEvent';
import { getMovieDetails } from '@/app/lib/tmdb';
import { extractCredits } from '@/app/lib/tmdb-utils';
import { addMovieSchema, movieIdSchema, updateMovieSchema } from '@/app/lib/schemas';
import { z } from 'zod';

// ------------------------------------------------------------
// Schema for the batch sync payload sent by the service worker
// ------------------------------------------------------------
const syncOperationSchema = z.discriminatedUnion('action', [
    z.object({
        action: z.literal('add'),
        payload: addMovieSchema,
    }),
    z.object({
        action: z.literal('remove'),
        payload: z.object({ tmdbId: movieIdSchema }),
    }),
    z.object({
        action: z.literal('update'),
        payload: z.object({
            tmdbId: movieIdSchema,
            quality: z.array(z.enum(['Digital', 'Blu-ray', '4K', 'DVD'])).min(1).optional(),
            customNotes: z.string().optional(),
        }),
    }),
    z.object({
        action: z.literal('wishlist-add'),
        payload: z.object({ tmdbId: movieIdSchema }),
    }),
    z.object({
        action: z.literal('wishlist-remove'),
        payload: z.object({ tmdbId: movieIdSchema }),
    }),
]);

const syncBatchSchema = z.object({
    operations: z.array(syncOperationSchema).min(1).max(50),
});

// ------------------------------------------------------------
// POST /api/library/sync
// Called by the service worker background sync handler.
// Processes each queued offline operation in order and returns
// per-operation results so the SW can selectively clear the
// IndexedDB sync queue.
// ------------------------------------------------------------
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id || !Types.ObjectId.isValid(session.user.id)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = syncBatchSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    await dbConnect();
    const userId = new Types.ObjectId(session.user.id);

    const results: { index: number; success: boolean; message: string }[] = [];

    for (let i = 0; i < parsed.data.operations.length; i++) {
        const op = parsed.data.operations[i];

        try {
            switch (op.action) {
                case 'add': {
                    const { tmdbId, quality, customNotes } = op.payload;

                    const exists = await UserMovie.findOne({ userId, tmdbId });
                    if (exists) {
                        results.push({ index: i, success: true, message: 'Already in library.' });
                        break;
                    }

                    // Remove from wishlist if present (mirrors addMovieToLibrary logic)
                    await UserWishlist.findOneAndDelete({ userId, tmdbId });

                    // Ensure movie catalog entry exists
                    let movie = await Movie.findOne({ tmdbId });
                    if (!movie) {
                        const tmdbDetails = await getMovieDetails(tmdbId);
                        const { actors, directors } = extractCredits(tmdbDetails);
                        const keywords = tmdbDetails.keywords?.keywords?.map((k: any) => k.name) || [];

                        movie = await Movie.findOneAndUpdate(
                            { tmdbId },
                            {
                                $setOnInsert: {
                                    title: tmdbDetails.title,
                                    poster: tmdbDetails.poster_path || '',
                                    overview: tmdbDetails.overview || '',
                                    genres: tmdbDetails.genres.map((g: any) => g.name),
                                    keywords,
                                    actors,
                                    directors,
                                    releaseDate: tmdbDetails.release_date,
                                    runtime: tmdbDetails.runtime !== null ? tmdbDetails.runtime : undefined,
                                    voteAverage: tmdbDetails.vote_average,
                                    voteCount: tmdbDetails.vote_count,
                                    popularity: tmdbDetails.popularity,
                                    embedding: null,
                                    lastFetched: new Date(),
                                },
                            },
                            { upsert: true, new: true }
                        );
                    }

                    await UserMovie.create({ userId, tmdbId, quality, customNotes });
                    await UserEvent.create({ userId, tmdbId, event: 'added' }).catch(() => { });

                    results.push({ index: i, success: true, message: 'Added.' });
                    break;
                }

                case 'remove': {
                    const { tmdbId } = op.payload;
                    await UserMovie.findOneAndDelete({ userId, tmdbId });
                    await UserEvent.create({ userId, tmdbId, event: 'removed' }).catch(() => { });
                    results.push({ index: i, success: true, message: 'Removed.' });
                    break;
                }

                case 'update': {
                    const { tmdbId, ...updateFields } = op.payload;
                    const parsedUpdate = updateMovieSchema.safeParse(updateFields);
                    if (!parsedUpdate.success) {
                        results.push({ index: i, success: false, message: 'Invalid update data.' });
                        break;
                    }
                    await UserMovie.findOneAndUpdate(
                        { userId, tmdbId },
                        { $set: parsedUpdate.data },
                        { new: true }
                    );
                    results.push({ index: i, success: true, message: 'Updated.' });
                    break;
                }

                case 'wishlist-add': {
                    const { tmdbId } = op.payload;
                    const existsLib = await UserMovie.findOne({ userId, tmdbId });
                    if (existsLib) {
                        results.push({ index: i, success: true, message: 'Already in library.' });
                        break;
                    }
                    const existsWl = await UserWishlist.findOne({ userId, tmdbId });
                    if (existsWl) {
                        results.push({ index: i, success: true, message: 'Already in wishlist.' });
                        break;
                    }

                    // Ensure movie catalog entry exists
                    let wlMovie = await Movie.findOne({ tmdbId });
                    if (!wlMovie) {
                        const tmdbDetails = await getMovieDetails(tmdbId);
                        const { actors, directors } = extractCredits(tmdbDetails);
                        const keywords = tmdbDetails.keywords?.keywords?.map((k: any) => k.name) || [];

                        wlMovie = await Movie.findOneAndUpdate(
                            { tmdbId },
                            {
                                $setOnInsert: {
                                    title: tmdbDetails.title,
                                    poster: tmdbDetails.poster_path || '',
                                    overview: tmdbDetails.overview || '',
                                    genres: tmdbDetails.genres.map((g: any) => g.name),
                                    keywords,
                                    actors,
                                    directors,
                                    releaseDate: tmdbDetails.release_date,
                                    runtime: tmdbDetails.runtime !== null ? tmdbDetails.runtime : undefined,
                                    voteAverage: tmdbDetails.vote_average,
                                    voteCount: tmdbDetails.vote_count,
                                    popularity: tmdbDetails.popularity,
                                    embedding: null,
                                    lastFetched: new Date(),
                                },
                            },
                            { upsert: true, new: true }
                        );
                    }

                    await UserWishlist.create({ userId, tmdbId });
                    await UserEvent.create({ userId, tmdbId, event: 'wishlisted' }).catch(() => { });
                    results.push({ index: i, success: true, message: 'Added to wishlist.' });
                    break;
                }

                case 'wishlist-remove': {
                    const { tmdbId } = op.payload;
                    await UserWishlist.findOneAndDelete({ userId, tmdbId });
                    await UserEvent.create({ userId, tmdbId, event: 'unwishlisted' }).catch(() => { });
                    results.push({ index: i, success: true, message: 'Removed from wishlist.' });
                    break;
                }
            }
        } catch (err) {
            console.error(`[Sync] Operation ${i} failed:`, err);
            results.push({ index: i, success: false, message: 'Server error.' });
            // Stop processing on first failure to preserve operation ordering.
            break;
        }
    }

    return NextResponse.json({ results });
}
