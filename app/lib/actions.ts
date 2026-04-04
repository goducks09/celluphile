'use server';

import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import mongoose, { Types, type Document } from 'mongoose';
import webpush from 'web-push';
import dbConnect from './mongoose';
import Movie from '../models/movie';
import User from '../models/user';
import { z } from 'zod';

import type { Session } from 'next-auth';
import type { IMovie } from '../models/movie';

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

// Represents a movie returned from the server as a plain serialisable object
// rather than a Mongoose Document
export type SerializedMovie = Omit<IMovie, '_id' | 'userId' | keyof Document> & {
    _id: string;
    userId: string;
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

function revalidateLibrary() {
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/library');
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

        const newMovie = new Movie({
            userId: new Types.ObjectId(session.user.id),
            ...parsed.data,
        });

        await newMovie.save();
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

        const result = await Movie.findOneAndDelete({
            userId: new Types.ObjectId(session.user.id),
            tmdbId: parsed.data,
        });

        if (!result) {
            return { success: false, message: 'Movie not found in your library.' };
        }

        revalidateLibrary();
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

        type MovieFilterQuery = {
            userId: Types.ObjectId;
            $text?: { $search: string };
            genre?: { $in: string[] };
            quality?: { $in: string[] };
        };

        const userId = new Types.ObjectId(session.user.id);
        const filterQuery: MovieFilterQuery = { userId };

        if (safeQuery && safeQuery.trim() !== '') {
            filterQuery.$text = { $search: safeQuery };
        }

        if (safeFilters?.genre && safeFilters.genre.length > 0) {
            filterQuery.genre = { $in: safeFilters.genre };
        }

        if (safeFilters?.quality && safeFilters.quality.length > 0) {
            filterQuery.quality = { $in: safeFilters.quality };
        }

        type MovieSortConfig = Record<string, 1 | -1 | { $meta: 'textScore' }>;
        let sortConfig: MovieSortConfig = {};
        if (safeQuery && safeQuery.trim() !== '') {
            sortConfig = { score: { $meta: 'textScore' } };
        } else if (safeSortOpts) {
            sortConfig[safeSortOpts.field] = safeSortOpts.order;
        } else {
            sortConfig = { addedAt: -1 };
        }

        let mongooseQuery = Movie.find(filterQuery).sort(sortConfig);

        if (safeQuery && safeQuery.trim() !== '') {
            mongooseQuery = mongooseQuery.select({ score: { $meta: 'textScore' } });
        }

        // Setup pagination
        const skip = (page - 1) * limit;

        const movies = await mongooseQuery.skip(skip).limit(limit + 1).lean();
        const hasMore = movies.length > limit;
        const pageMovies = hasMore ? movies.slice(0, limit) : movies;

        return {
            success: true,
            movies: pageMovies.map((movie) => ({
                ...movie,
                _id: movie._id.toString(),
                userId: movie.userId.toString(),
            })) satisfies SerializedMovie[],
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

        const result = await Movie.findOneAndUpdate(
            { userId: new Types.ObjectId(session.user.id), tmdbId: parsedId.data },
            { $set: parsedData.data },
            { new: true }
        );

        if (!result) {
            return { success: false, message: 'Movie not found in your library.' };
        }

        revalidateLibrary();
        return { success: true, message: 'Movie details updated.' };
    } catch (error) {
        console.error('Error updating movie in library:', error);
        return { success: false, message: 'Failed to update movie details.' };
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