'use server';

import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import mongoose, { Types, type Document } from 'mongoose';
import webpush from 'web-push';
import dbConnect from './mongoose';
import Movie from '../models/movie';
import User from '../models/user';
import UserMovie from '../models/userMovie';
import UserEvent from '../models/userEvent';
import { z } from 'zod';
import { getMovieDetails } from './tmdb';
import { extractCredits } from './tmdb-utils';

import type { Session } from 'next-auth';
import type { IMovie, IActor, IDirector } from '../models/movie';
import type { Quality } from './schemas';

import {
    addMovieSchema,
    movieIdSchema,
    pushSubscriptionSchema,
    searchFiltersSchema,
    sendNotificationSchema,
    searchQuerySchema,
    searchSortSchema,
    searchPaginationSchema,
    updateMovieSchema,
} from './schemas';

// ============================================================
// Types
// ============================================================

export type SerializedMovie = Omit<IMovie, '_id' | 'lastFetched' | 'embedding' | keyof Document> & {
    _id: string;
    userId: string;
    quality: Quality;
    addedAt: Date;
    customNotes?: string;
};

type SessionSuccess = { session: Session & { user: { id: string } }; error?: never };
type SessionError = { error: { success: false; message: string }; session?: never };

// ============================================================
// Web Push — initialised once at module load, server-side only.
// ============================================================

let webPushInitialized = false;

function initWebPush() {
    try {
        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        const privateKey = process.env.VAPID_PRIVATE_KEY;
        if (!publicKey || !privateKey) {
            console.warn('[@/lib/actions] VAPID keys are not configured. Push notifications will be disabled.');
            return;
        }
        webpush.setVapidDetails('mailto:you@yourdomain.com', publicKey, privateKey);
        webPushInitialized = true;
    } catch (err) {
        console.error('[@/lib/actions] Failed to initialize web push:', err);
    }
}

initWebPush();

// ============================================================
// Shared helpers
// ============================================================

export async function getValidatedSession(errorStr: string): Promise<SessionSuccess | SessionError> {
    const session = await auth();

    if (!session?.user?.id) {
        return { error: { success: false, message: 'You must be logged in to ' + errorStr + '.' } };
    }

    if (!Types.ObjectId.isValid(session.user.id)) {
        return { error: { success: false, message: 'Invalid session.' } };
    }

    return { session: session as Session & { user: { id: string } } };
}

function serializeMovie(doc: any): SerializedMovie {
    const userMovie = doc.userMovie || doc;
    const movieDetails = doc.movieDetails || doc;

    return {
        _id: userMovie._id.toString(),
        userId: userMovie.userId.toString(),
        tmdbId: userMovie.tmdbId,
        quality: userMovie.quality,
        addedAt: userMovie.addedAt,
        customNotes: userMovie.customNotes,

        title: movieDetails.title,
        poster: movieDetails.poster || '',
        overview: movieDetails.overview || '',
        genre: movieDetails.genre || [],
        keywords: movieDetails.keywords || [],
        actors: movieDetails.actors?.map((a: IActor) => ({ firstName: a.firstName, lastName: a.lastName, fullName: a.fullName })) || [],
        directors: movieDetails.directors?.map((d: IDirector) => ({ firstName: d.firstName, lastName: d.lastName, fullName: d.fullName })) || [],
        releaseDate: movieDetails.releaseDate,
        runtime: movieDetails.runtime,
        voteAverage: movieDetails.voteAverage,
        voteCount: movieDetails.voteCount,
        popularity: movieDetails.popularity,
    };
}

function revalidateLibrary(tmdbId?: number) {
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/library');
    if (tmdbId) revalidatePath(`/dashboard/library/${tmdbId}`, 'page');
}

// ============================================================
// Movie actions
// ============================================================

export async function addMovieToLibrary(movieData: z.infer<typeof addMovieSchema>) {
    const { session, error } = await getValidatedSession('add a movie');
    if (error) return error;

    const parsed = addMovieSchema.safeParse(movieData);
    if (!parsed.success) {
        return { success: false, message: 'Invalid movie data provided.' };
    }

    try {
        await dbConnect();

        const { tmdbId, quality, customNotes } = parsed.data;
        const userId = new Types.ObjectId(session.user.id);

        const existingUserMovie = await UserMovie.findOne({ userId, tmdbId });
        if (existingUserMovie) {
            return { success: false, message: 'Movie already exists in your library.' };
        }

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
                        genre: tmdbDetails.genres.map(g => g.name),
                        keywords,
                        actors,
                        directors,
                        releaseDate: tmdbDetails.release_date,
                        runtime: tmdbDetails.runtime !== null ? tmdbDetails.runtime : undefined,
                        voteAverage: tmdbDetails.vote_average,
                        voteCount: tmdbDetails.vote_count,
                        popularity: tmdbDetails.popularity,
                        embedding: null,
                        lastFetched: new Date()
                    }
                },
                { upsert: true, new: true }
            );
        }

        const newUserMovie = new UserMovie({
            userId,
            tmdbId,
            quality,
            customNotes
        });

        await newUserMovie.save();

        // Phase 4: Log the 'added' event implicitly
        const newEvent = new UserEvent({
            userId,
            tmdbId,
            event: 'added'
        });
        await newEvent.save().catch((e: unknown) => console.error('Failed to log event:', e));

        revalidateLibrary();

        return { success: true, message: 'Movie added to library successfully!' };
    } catch (error: any) {
        if (error.code === 11000) {
            return { success: false, message: 'Movie already exists in your library.' };
        }
        console.error('Error adding movie to library:', error);
        return { success: false, message: 'Failed to add movie to library. Please try again later.' };
    }
}

export async function removeMovieFromLibrary(tmdbId: number) {
    const { session, error } = await getValidatedSession('remove a movie');
    if (error) return error;

    const parsed = movieIdSchema.safeParse(tmdbId);
    if (!parsed.success) {
        return { success: false, message: 'Invalid movie ID.' };
    }

    try {
        await dbConnect();

        const result = await UserMovie.findOneAndDelete({
            userId: new Types.ObjectId(session.user.id),
            tmdbId: parsed.data,
        });

        if (!result) {
            return { success: false, message: 'Movie not found in your library.' };
        }

        // Phase 4: Log the 'removed' event
        const newEvent = new UserEvent({
            userId: new Types.ObjectId(session.user.id),
            tmdbId: parsed.data,
            event: 'removed'
        });
        await newEvent.save().catch((e: unknown) => console.error('Failed to log event:', e));

        revalidateLibrary(parsed.data);
        return { success: true, message: 'Movie removed from library.' };
    } catch (error) {
        console.error('Error removing movie from library:', error);
        return { success: false, message: 'Failed to remove movie from library.' };
    }
}

export async function searchUserLibrary(
    query: string,
    filters?: z.infer<typeof searchFiltersSchema>,
    sortOpts?: z.infer<typeof searchSortSchema>,
    pagination?: z.infer<typeof searchPaginationSchema>
): Promise<{ success: boolean; message?: string; movies: SerializedMovie[]; totalCount?: number; hasMore?: boolean; page?: number }> {
    const { session, error } = await getValidatedSession('search your library');
    if (error) return { ...error, movies: [] as SerializedMovie[] };

    const parsedQuery = searchQuerySchema.safeParse(query);
    const parsedFilters = searchFiltersSchema.safeParse(filters);
    const parsedSort = searchSortSchema.safeParse(sortOpts);
    const parsedPagination = searchPaginationSchema.safeParse(pagination || { page: 1, limit: 20 });

    if (!parsedQuery.success || !parsedFilters.success || !parsedSort.success || !parsedPagination.success) {
        return { success: false, message: 'Invalid search parameters.', movies: [] };
    }

    const safeQuery = parsedQuery.data;
    const safeFilters = parsedFilters.data;
    const safeSortOpts = parsedSort.data;
    const { page, limit } = parsedPagination.data;

    try {
        await dbConnect();

        const pipeline: any[] = [];

        if (safeQuery && safeQuery.trim() !== '') {
            // Start with Movie collection for $text index support
            pipeline.push({ $match: { $text: { $search: safeQuery } } });

            if (safeFilters?.genre && safeFilters.genre.length > 0) {
                pipeline.push({ $match: { genre: { $in: safeFilters.genre } } });
            }

            pipeline.push({
                $lookup: {
                    from: 'usermovies',
                    let: { movieTmdbId: '$tmdbId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$tmdbId', '$$movieTmdbId'] },
                                        { $eq: ['$userId', new Types.ObjectId(session.user.id)] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'userMovie'
                }
            });
            pipeline.push({ $unwind: '$userMovie' });

            if (safeFilters?.quality && safeFilters.quality.length > 0) {
                pipeline.push({ $match: { 'userMovie.quality': { $in: safeFilters.quality } } });
            }

            pipeline.push({ $addFields: { score: { $meta: 'textScore' } } });
            pipeline.push({ $sort: { score: -1 } });
            pipeline.push({ $project: { score: 0 } });
        } else {
            // Start with UserMovie for optimal performance when not text searching
            const userMatch: any = { userId: new Types.ObjectId(session.user.id) };
            if (safeFilters?.quality && safeFilters.quality.length > 0) {
                userMatch.quality = { $in: safeFilters.quality };
            }
            pipeline.push({ $match: userMatch });

            pipeline.push({
                $lookup: {
                    from: 'movies',
                    localField: 'tmdbId',
                    foreignField: 'tmdbId',
                    as: 'movieDetails'
                }
            });
            pipeline.push({ $unwind: '$movieDetails' });

            if (safeFilters?.genre && safeFilters.genre.length > 0) {
                pipeline.push({ $match: { 'movieDetails.genre': { $in: safeFilters.genre } } });
            }

            let sortConfig: any = {};
            if (safeSortOpts) {
                if (safeSortOpts.field === 'title' || safeSortOpts.field === 'release_date') {
                    sortConfig = { [`movieDetails.${safeSortOpts.field}`]: safeSortOpts.order };
                } else if (safeSortOpts.field === 'addedAt') {
                    sortConfig = { addedAt: safeSortOpts.order };
                }
            } else {
                sortConfig = { addedAt: -1 };
            }
            pipeline.push({ $sort: sortConfig });
        }

        const skip = (page - 1) * limit;
        pipeline.push({ $skip: skip });
        pipeline.push({ $limit: limit + 1 });

        const rawResult = safeQuery && safeQuery.trim() !== ''
            ? await Movie.aggregate(pipeline)
            : await UserMovie.aggregate(pipeline);

        const hasMore = rawResult.length > limit;
        const pageMovies = hasMore ? rawResult.slice(0, limit) : rawResult;

        return {
            success: true,
            movies: pageMovies.map(serializeMovie),
            hasMore,
            page
        };
    } catch (error) {
        console.error('Error searching user library:', error);
        return { success: false, message: 'Failed to search library.', movies: [] };
    }
}

export async function updateMovieInLibrary(
    tmdbId: number,
    updateData: z.infer<typeof updateMovieSchema>
) {
    const { session, error } = await getValidatedSession('update a movie');
    if (error) return error;

    const parsedId = movieIdSchema.safeParse(tmdbId);
    const parsedData = updateMovieSchema.safeParse(updateData);

    if (!parsedId.success || !parsedData.success) {
        return { success: false, message: 'Invalid data provided.' };
    }

    try {
        await dbConnect();

        const result = await UserMovie.findOneAndUpdate(
            { userId: new Types.ObjectId(session.user.id), tmdbId: parsedId.data },
            { $set: parsedData.data },
            { new: true }
        );

        if (!result) {
            return { success: false, message: 'Movie not found in your library.' };
        }

        revalidateLibrary(parsedId.data);
        return { success: true, message: 'Movie details updated.' };
    } catch (error) {
        console.error('Error updating movie in library:', error);
        return { success: false, message: 'Failed to update movie details.' };
    }
}

// ============================================================
// Movie actions - Fetching
// ============================================================

export async function getMovieByTmdbId(tmdbId: number): Promise<{ success: boolean; movie?: SerializedMovie; message?: string }> {
    const { session, error } = await getValidatedSession('view a movie');
    if (error) return error;

    const parsedId = movieIdSchema.safeParse(tmdbId);
    if (!parsedId.success) {
        return { success: false, message: 'Invalid movie ID.' };
    }

    try {
        await dbConnect();

        const userMovie = await UserMovie.findOne({
            userId: new Types.ObjectId(session.user.id),
            tmdbId: parsedId.data,
        }).lean();

        if (!userMovie) {
            return { success: false, message: 'Movie not found in your library.' };
        }

        const movieDetails = await Movie.findOne({
            tmdbId: parsedId.data,
        }).lean();

        if (!movieDetails) {
            return { success: false, message: 'Movie details not found.' };
        }

        return { success: true, movie: serializeMovie({ ...userMovie, movieDetails }) };
    } catch (error) {
        console.error('Error fetching movie by TMDB ID:', error);
        return { success: false, message: 'Failed to find movie.' };
    }
}

export async function getRandomMovie(): Promise<{ success: boolean; movie?: SerializedMovie; message?: string }> {
    const { session, error } = await getValidatedSession('get a random movie');
    if (error) return error;

    try {
        await dbConnect();

        const [userMovie] = await UserMovie.aggregate([
            { $match: { userId: new Types.ObjectId(session.user.id) } },
            { $sample: { size: 1 } },
            {
                $lookup: {
                    from: 'movies',
                    localField: 'tmdbId',
                    foreignField: 'tmdbId',
                    as: 'movieDetails'
                }
            },
            { $unwind: '$movieDetails' }
        ]);

        if (!userMovie) {
            return { success: false, message: 'Your library is empty.' };
        }

        return { success: true, movie: serializeMovie(userMovie) };
    } catch (err) {
        console.error('Error fetching random movie:', err);
        return { success: false, message: 'Failed to get a random movie.' };
    }
}

// ============================================================
// Library stats
// ============================================================

export interface LibraryStats {
    totalFilms: number;
    in4K: number;
    thisMonth: number;
}

export async function getLibraryStats(): Promise<{ success: boolean; message?: string; stats: LibraryStats }> {
    const { session, error } = await getValidatedSession('view library stats');
    if (error) return { ...error, stats: { totalFilms: 0, in4K: 0, thisMonth: 0 } };

    try {
        await dbConnect();

        const userId = new Types.ObjectId(session.user.id);

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [result] = await UserMovie.aggregate([
            { $match: { userId } },
            {
                $group: {
                    _id: null,
                    totalFilms: { $sum: 1 },
                    in4K: { $sum: { $cond: [{ $eq: ['$quality', '4K'] }, 1, 0] } },
                    thisMonth: { $sum: { $cond: [{ $gte: ['$addedAt', startOfMonth] }, 1, 0] } },
                },
            },
        ]);

        return {
            success: true,
            stats: result
                ? { totalFilms: result.totalFilms, in4K: result.in4K, thisMonth: result.thisMonth }
                : { totalFilms: 0, in4K: 0, thisMonth: 0 },
        };
    } catch (err) {
        console.error('Error fetching library stats:', err);
        return { success: false, message: 'Failed to load library stats.', stats: { totalFilms: 0, in4K: 0, thisMonth: 0 } };
    }
}

// ============================================================
// Push notification actions
// ============================================================

export async function sendNotification(message: string) {
    if (!webPushInitialized) {
        return { success: false, message: 'Push notifications are not configured.' };
    }

    const { session, error } = await getValidatedSession('send a notification');
    if (error) return error;

    const parsed = sendNotificationSchema.safeParse(message);
    if (!parsed.success) {
        return { success: false, message: 'Invalid notification message.' };
    }

    try {
        await dbConnect();
        const user = await User.findById(session.user.id);

        if (!user?.webPushSubscription) {
            return { success: false, message: 'No subscription available for this user.' };
        }

        await webpush.sendNotification(
            user.webPushSubscription,
            JSON.stringify({
                title: 'Celluphile Update',
                body: parsed.data,
                icon: '/icon-192x192.png',
            })
        );
        return { success: true };
    } catch (err: any) {
        console.error('Error sending push notification:', err);
        return { success: false, message: err.message || 'Failed to send notification' };
    }
}

export async function subscribeUser(sub: PushSubscription) {
    const { session, error } = await getValidatedSession('subscribe to notifications');
    if (error) return error;

    const parsed = pushSubscriptionSchema.safeParse(sub);
    if (!parsed.success) {
        return { success: false, message: 'Invalid subscription object.' };
    }

    try {
        await dbConnect();
        await User.findByIdAndUpdate(session.user.id, { webPushSubscription: parsed.data });
        return { success: true };
    } catch (err) {
        console.error('Failed to save subscription:', err);
        return { success: false, message: 'Database error' };
    }
}

export async function unsubscribeUser() {
    const { session, error } = await getValidatedSession('unsubscribe from notifications');
    if (error) return error;

    try {
        await dbConnect();
        await User.findByIdAndUpdate(session.user.id, { $unset: { webPushSubscription: '' } });
        return { success: true };
    } catch (err) {
        console.error('Failed to unsubscribe from push notifications:', err);
        return { success: false, message: 'Database error' };
    }
}

// ============================================================
// Event Logging (Phase 4 AI Recommendation)
// ============================================================

export async function logUserEvent(
    tmdbId: number,
    event: 'added' | 'removed' | 'rated' | 'watched' | 'watchlisted',
    rating?: number | null,
    sessionId?: string
) {
    const { session, error } = await getValidatedSession('log an event');
    if (error) return error;

    try {
        await dbConnect();

        const newEvent = new UserEvent({
            userId: new Types.ObjectId(session.user.id),
            tmdbId,
            event,
            rating,
            sessionId,
        });

        await newEvent.save();
        return { success: true };
    } catch (err) {
        console.error('Error logging user event:', err);
        return { success: false, message: 'Failed to log event.' };
    }
}

// ============================================================
// Recommendations (Phase 1 AI Recommendation)
// ============================================================

export async function getRecommendations(): Promise<{ success: boolean; message?: string; movies?: SerializedMovie[] }> {
    const { session, error } = await getValidatedSession('get recommendations');
    if (error) return error;

    try {
        await dbConnect();
        const userId = new Types.ObjectId(session.user.id);

        // 1. Sample 3 recent movies from the user's library
        const samples = await UserMovie.aggregate([
            { $match: { userId } },
            { $sort: { addedAt: -1 } },
            { $limit: 3 }
        ]);

        if (samples.length === 0) {
            return { success: false, message: 'Not enough movies in library for recommendations.' };
        }

        const libraryTmdbIds = await UserMovie.find({ userId }).distinct('tmdbId');

        // 2. Vector search for each sampled movie
        const allRecommendations: any[][] = [];

        for (const userMovie of samples) {
            const movieDetails = await Movie.findOne({ tmdbId: userMovie.tmdbId });
            // If the movie has an embedding generated by the offline script, use it
            if (!movieDetails || !movieDetails.embedding || movieDetails.embedding.length === 0) continue;

            // Note: This requires an Atlas Vector Search index named 'vector_index' configured on the 'embedding' field
            const similar = await Movie.aggregate([
                {
                    $vectorSearch: {
                        index: 'vector_index',
                        path: 'embedding',
                        queryVector: movieDetails.embedding,
                        numCandidates: 100,
                        limit: 5
                    }
                },
                {
                    $match: {
                        tmdbId: { $nin: libraryTmdbIds }
                    }
                }
            ]);

            allRecommendations.push(similar);
        }

        // 3. Interleave the results
        const finalResults: any[] = [];
        const maxLength = Math.max(...allRecommendations.map(arr => arr.length), 0);

        for (let i = 0; i < maxLength; i++) {
            for (let j = 0; j < allRecommendations.length; j++) {
                if (allRecommendations[j] && allRecommendations[j][i]) {
                    const candidate = allRecommendations[j][i];
                    // Ensure uniqueness
                    if (!finalResults.some(m => m.tmdbId === candidate.tmdbId)) {
                        finalResults.push(candidate);
                    }
                }
            }
        }

        // Return matching SerializedMovie format (pseudo-serializing for recommendations)
        const serialized = finalResults.map(m => ({
            _id: m._id.toString(),
            userId: session.user.id,
            tmdbId: m.tmdbId,
            quality: 'DVD' as Quality, // placeholder
            addedAt: new Date(),
            customNotes: '',
            title: m.title,
            poster: m.poster || '',
            overview: m.overview || '',
            genre: m.genre || [],
            keywords: m.keywords || [],
            actors: m.actors || [],
            directors: m.directors || [],
            releaseDate: m.releaseDate,
            runtime: m.runtime,
            voteAverage: m.voteAverage,
            voteCount: m.voteCount,
            popularity: m.popularity,
        }));

        return { success: true, movies: serialized };
    } catch (err) {
        console.error('Error generating recommendations:', err);
        return { success: false, message: 'Failed to generate recommendations.' };
    }
}