'use server';

import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import mongoose, { Types, type Document } from 'mongoose';
import dbConnect from './mongoose';
import Movie from '../models/movie';
import User from '../models/user';
import UserMovie from '../models/userMovie';
import UserEvent from '../models/userEvent';
import UserWishlist from '../models/userWishlist';
import { z } from 'zod';
import { getMovieDetails } from './tmdb';
import { extractCredits } from './tmdb-utils';
import { NotificationType, NOTIFICATION_REGISTRY } from './notifications/registry';

import type { Session } from 'next-auth';
import type { IMovie, IActor, IDirector } from '../models/movie';
import type { Quality } from './schemas';

import {
    addMovieSchema,
    movieIdSchema,
    pushSubscriptionSchema,
    searchFiltersSchema,
    searchQuerySchema,
    searchSortSchema,
    searchPaginationSchema,
    updateMovieSchema,
    logEventSchema,
} from './schemas';

import { getValidatedSession } from './data';
import type { BaseSerializedMovie, SerializedMovie, SerializedWishlistMovie } from './data';

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

        let removedWishlistRecord = null;
        try {
            removedWishlistRecord = await UserWishlist.findOneAndDelete({ userId, tmdbId });
        } catch (err) {
            console.error('Error removing from wishlist during library add:', err);
            return { success: false, message: 'Failed to process request.' };
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
                        genres: tmdbDetails.genres.map(g => g.name),
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

        try {
            await newUserMovie.save();
        } catch (saveErr: any) {
            if (removedWishlistRecord) {
                await UserWishlist.create({
                    userId,
                    tmdbId,
                    addedAt: removedWishlistRecord.addedAt
                }).catch(e => console.error('Failed to restore wishlist record:', e));
            }
            throw saveErr;
        }

        // Phase 4: Log the 'added' event implicitly
        const newEvent = new UserEvent({
            userId,
            tmdbId,
            event: 'added'
        });
        await newEvent.save().catch((e: unknown) => console.error('Failed to log event:', e));

        revalidateLibrary();
        revalidatePath('/dashboard/wishlist');

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

// ============================================================
// Wishlist actions
// ============================================================

export async function addMovieToWishlist(tmdbId: number) {
    const { session, error } = await getValidatedSession('add to wishlist');
    if (error) return error;

    const parsed = movieIdSchema.safeParse(tmdbId);
    if (!parsed.success) {
        return { success: false, message: 'Invalid movie ID.' };
    }

    try {
        await dbConnect();
        const userId = new Types.ObjectId(session.user.id);
        const validTmdbId = parsed.data;

        // Check if in library
        const existingLibrary = await UserMovie.findOne({ userId, tmdbId: validTmdbId });
        if (existingLibrary) {
            return { success: false, message: 'Already in library.' };
        }

        // Check if in wishlist
        const existingWishlist = await UserWishlist.findOne({ userId, tmdbId: validTmdbId });
        if (existingWishlist) {
            return { success: false, message: 'Already in wishlist.' };
        }

        let movie = await Movie.findOne({ tmdbId: validTmdbId });

        if (!movie) {
            const tmdbDetails = await getMovieDetails(validTmdbId);
            const { actors, directors } = extractCredits(tmdbDetails);
            const keywords = tmdbDetails.keywords?.keywords?.map((k: any) => k.name) || [];

            movie = await Movie.findOneAndUpdate(
                { tmdbId: validTmdbId },
                {
                    $setOnInsert: {
                        title: tmdbDetails.title,
                        poster: tmdbDetails.poster_path || '',
                        overview: tmdbDetails.overview || '',
                        genres: tmdbDetails.genres.map(g => g.name),
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

        const newWishlistItem = new UserWishlist({
            userId,
            tmdbId: validTmdbId
        });
        await newWishlistItem.save();

        const newEvent = new UserEvent({
            userId,
            tmdbId: validTmdbId,
            event: 'wishlisted'
        });
        await newEvent.save().catch((e: unknown) => console.error('Failed to log event:', e));

        revalidatePath('/dashboard/wishlist');

        return { success: true, message: 'Movie added to wishlist.' };
    } catch (err) {
        console.error('Error adding to wishlist:', err);
        return { success: false, message: 'Failed to add to wishlist.' };
    }
}

export async function removeMovieFromWishlist(tmdbId: number) {
    const { session, error } = await getValidatedSession('remove from wishlist');
    if (error) return error;

    const parsed = movieIdSchema.safeParse(tmdbId);
    if (!parsed.success) {
        return { success: false, message: 'Invalid movie ID.' };
    }

    try {
        await dbConnect();
        const userId = new Types.ObjectId(session.user.id);
        const validTmdbId = parsed.data;

        const result = await UserWishlist.findOneAndDelete({ userId, tmdbId: validTmdbId });
        if (!result) {
            return { success: false, message: 'Movie not found in wishlist.' };
        }

        const newEvent = new UserEvent({
            userId,
            tmdbId: validTmdbId,
            event: 'unwishlisted'
        });
        await newEvent.save().catch((e: unknown) => console.error('Failed to log event:', e));

        revalidatePath('/dashboard/wishlist');
        return { success: true, message: 'Movie removed from wishlist.' };
    } catch (err) {
        console.error('Error removing from wishlist:', err);
        return { success: false, message: 'Failed to remove from wishlist.' };
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



// ============================================================
// Library stats
// ============================================================




// ============================================================
// Push notification actions
// ============================================================

export async function subscribeUser(sub: PushSubscription) {
    const { session, error } = await getValidatedSession('subscribe to notifications');
    if (error) return error;

    const parsed = pushSubscriptionSchema.safeParse(sub);
    if (!parsed.success) {
        return { success: false, message: 'Invalid subscription object.' };
    }

    try {
        await dbConnect();
        // Remove any existing sub for this endpoint to prevent duplicates from key rotation
        await User.findByIdAndUpdate(session.user.id, {
            $pull: { webPushSubscriptions: { endpoint: parsed.data.endpoint } }
        });
        await User.findByIdAndUpdate(session.user.id, {
            $addToSet: { webPushSubscriptions: parsed.data }
        });
        return { success: true };
    } catch (err) {
        console.error('Failed to save subscription:', err);
        return { success: false, message: 'Database error' };
    }
}

export async function unsubscribeUser(endpoint: string) {
    const { session, error } = await getValidatedSession('unsubscribe from notifications');
    if (error) return error;

    const parsed = z.string().url().safeParse(endpoint);
    if (!parsed.success) {
        return { success: false, message: 'Invalid endpoint.' };
    }

    try {
        await dbConnect();
        await User.findByIdAndUpdate(session.user.id, { $pull: { webPushSubscriptions: { endpoint: parsed.data } } });
        return { success: true };
    } catch (err) {
        console.error('Failed to unsubscribe from push notifications:', err);
        return { success: false, message: 'Database error' };
    }
}

export async function updateNotificationPreferences(preferences: Record<NotificationType, boolean>) {
    const { session, error } = await getValidatedSession('update notification preferences');
    if (error) return error;

    try {
        await dbConnect();
        const validKeys = Object.keys(NOTIFICATION_REGISTRY) as NotificationType[];
        const updateDoc: Record<string, boolean> = {};

        for (const [key, value] of Object.entries(preferences)) {
            if (!validKeys.includes(key as NotificationType) || typeof value !== 'boolean') {
                continue; // skip invalid keys
            }
            updateDoc[`notificationPreferences.${key}`] = value;
        }

        if (Object.keys(updateDoc).length === 0) {
            return { success: false, message: 'No valid preferences provided.' };
        }

        await User.findByIdAndUpdate(session.user.id, { $set: updateDoc });
        return { success: true };
    } catch (err) {
        console.error('Failed to update preferences:', err);
        return { success: false, message: 'Database error' };
    }
}



// ============================================================
// Event Logging (Phase 4 AI Recommendation)
// ============================================================

export async function logUserEvent(
    tmdbId: number,
    event: 'added' | 'removed' | 'rated' | 'watched' | 'watchlisted' | 'wishlisted' | 'unwishlisted',
    rating?: number | null,
    sessionId?: string
) {
    const { session, error } = await getValidatedSession('log an event');
    if (error) return error;

    const parsed = logEventSchema.safeParse({ tmdbId, event, rating, sessionId });
    if (!parsed.success) {
        return { success: false, message: 'Invalid event data.' };
    }

    const { tmdbId: validTmdbId, event: validEvent, rating: validRating, sessionId: validSessionId } = parsed.data;

    try {
        await dbConnect();

        const newEvent = new UserEvent({
            userId: new Types.ObjectId(session.user.id),
            tmdbId: validTmdbId,
            event: validEvent,
            rating: validRating,
            sessionId: validSessionId,
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
