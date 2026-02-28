'use server';

import dbConnect from './mongoose';
import Movie from '../models/movie';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { Types } from 'mongoose';

export async function addMovieToLibrary(movieData: {
    tmdbId: number;
    title: string;
    poster: string;
    genre: string[];
    quality: 'Digital' | 'Blu-ray' | '4K' | 'DVD';
    customNotes?: string;
}) {
    const session = await auth();

    if (!session?.user?.id) {
        return { success: false, message: 'You must be logged in to add a movie.' };
    }

    if (!Types.ObjectId.isValid(session.user.id)) {
        return { success: false, message: 'Invalid session.' };
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
    const session = await auth();

    if (!session?.user?.id) {
        return { success: false, message: 'You must be logged in to remove a movie.' };
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

export async function updateMovieInLibrary(
    tmdbId: number,
    updateData: { quality?: 'Digital' | 'Blu-ray' | '4K' | 'DVD'; customNotes?: string }
) {
    const session = await auth();

    if (!session?.user?.id) {
        return { success: false, message: 'You must be logged in to update a movie.' };
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
