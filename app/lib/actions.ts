'use server';

import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { Types } from 'mongoose';
import webpush from 'web-push'
import dbConnect from './mongoose';
import Movie from '../models/movie';
import User from '../models/user';

type SessionSuccess = { session: NonNullable<Awaited<ReturnType<typeof auth>>>; error?: never };
type SessionError = { error: { success: false; message: string }; session?: never };

function initWebPush() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) throw new Error('VAPID keys are not configured');
    webpush.setVapidDetails('mailto:you@yourdomain.com', publicKey, privateKey);
}

export async function getValidatedSession(errorStr: string): Promise<SessionSuccess | SessionError> {
    const session = await auth();

    if (!session?.user?.id) {
        return { error: { success: false, message: 'You must be logged in to ' + errorStr + '.' } };
    }

    if (!Types.ObjectId.isValid(session.user.id)) {
        return { error: { success: false, message: 'Invalid session.' } };
    }

    return { session };
}

export async function addMovieToLibrary(movieData: {
    tmdbId: number;
    title: string;
    poster: string;
    genre: string[];
    quality: 'Digital' | 'Blu-ray' | '4K' | 'DVD';
    customNotes?: string;
}) {
    const { session, error } = await getValidatedSession('add a movie');

    if (error) {
        return error;
    }

    try {
        await dbConnect();

        const newMovie = new Movie({
            userId: new Types.ObjectId(session.user.id),
            ...movieData,
            addedAt: new Date(),
        });

        await newMovie.save();

        // Revalidate library page
        revalidatePath('/dashboard');
        revalidatePath('/dashboard/library');

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

    if (error) {
        return error;
    }

    try {
        await dbConnect();

        const result = await Movie.findOneAndDelete({
            userId: new Types.ObjectId(session.user.id),
            tmdbId: tmdbId,
        });

        if (!result) {
            return { success: false, message: 'Movie not found in your library.' };
        }

        // Revalidate paths to update UI
        revalidatePath('/dashboard');
        revalidatePath('/dashboard/library');

        return { success: true, message: 'Movie removed from library.' };
    } catch (error) {
        console.error('Error removing movie from library:', error);
        return { success: false, message: 'Failed to remove movie from library.' };
    }
}

export async function searchUserLibrary(
    query: string,
    filters?: {
        genre?: string[];
        quality?: string[];
    },
    sortOpts?: {
        field: 'title' | 'addedAt' | 'release_date';
        order: 1 | -1;
    }
): Promise<{ success: boolean; message?: string; movies: any[] }> {
    const { session, error } = await getValidatedSession('search your library');

    if (error) {
        return { ...error, movies: [] };
    }

    try {
        await dbConnect();

        const userId = new Types.ObjectId(session.user.id);
        const filterQuery: any = { userId };

        // Text search if a query is provided
        if (query && query.trim() !== '') {
            filterQuery.$text = { $search: query };
        }

        // Apply genre filters if selected
        if (filters?.genre && filters.genre.length > 0) {
            filterQuery.genre = { $in: filters.genre };
        }

        // Apply quality filters if selected
        if (filters?.quality && filters.quality.length > 0) {
            filterQuery.quality = { $in: filters.quality };
        }

        // Determine sorting
        let sortConfig: any = {};
        if (query && query.trim() !== '') {
            // Sort by text search score relevance by default when searching
            sortConfig = { score: { $meta: "textScore" } };
        } else if (sortOpts) {
            sortConfig[sortOpts.field] = sortOpts.order;
        } else {
            // Default sort is newest additions first
            sortConfig = { addedAt: -1 };
        }

        let mongooseQuery = Movie.find(filterQuery)
            .sort(sortConfig)

        // Include the text match score in the projection if performing a text search
        if (query && query.trim() !== '') {
            mongooseQuery = mongooseQuery.select({ score: { $meta: "textScore" } });
        }

        const movies = await mongooseQuery.lean();

        return {
            success: true,
            movies: movies.map((movie: any) => ({
                ...movie,
                _id: movie._id.toString(), // Ensure _id is serializable
                userId: movie.userId.toString()
            }))
        };
    } catch (error) {
        console.error('Error searching user library:', error);
        return { success: false, message: 'Failed to search library.', movies: [] };
    }
}

export async function updateMovieInLibrary(
    tmdbId: number,
    updateData: { quality?: 'Digital' | 'Blu-ray' | '4K' | 'DVD'; customNotes?: string }
) {
    const { session, error } = await getValidatedSession('update a movie');

    if (error) {
        return error;
    }

    try {
        await dbConnect();

        const result = await Movie.findOneAndUpdate(
            { userId: new Types.ObjectId(session.user.id), tmdbId: tmdbId },
            { $set: updateData },
            { new: true }
        );

        if (!result) {
            return { success: false, message: 'Movie not found in your library.' };
        }

        revalidatePath('/dashboard');
        revalidatePath('/dashboard/library');

        return { success: true, message: 'Movie details updated.' };
    } catch (error) {
        console.error('Error updating movie in library:', error);
        return { success: false, message: 'Failed to update movie details.' };
    }
}

export async function subscribeUser(sub: PushSubscription) {
    const { session, error } = await getValidatedSession('subscribe to notifications');
    if (error) return error;

    try {
        await dbConnect();
        await User.findByIdAndUpdate(session.user.id, { webPushSubscription: sub });
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
        await User.findByIdAndUpdate(session.user.id, { $unset: { webPushSubscription: "" } });
        return { success: true };
    } catch (err) {
        console.error('Failed to unsubscribe from push notifications:', err);
        return { success: false, message: 'Database error' };
    }
}

export async function sendNotification(message: string) {
    initWebPush();
    const { session, error } = await getValidatedSession('send a notification');
    if (error) return error;

    try {
        await dbConnect();
        const user = await User.findById(session.user.id);

        if (!user || !user.webPushSubscription) {
            throw new Error('No subscription available for this user');
        }

        await webpush.sendNotification(
            user.webPushSubscription,
            JSON.stringify({
                title: 'Celluphile Update',
                body: message,
                icon: '/icon-192x192.png',
            })
        );
        return { success: true };
    } catch (err: any) {
        console.error('Error sending push notification:', err);
        return { success: false, message: err.message || 'Failed to send notification' };
    }
}