import 'server-only';
import { auth } from '@/auth';
import { Types, type Document } from 'mongoose';
import dbConnect from './mongoose';
import Movie from '../models/movie';
import User from '../models/user';
import UserMovie from '../models/userMovie';
import UserEvent from '../models/userEvent';
import UserWishlist from '../models/userWishlist';
import { NotificationType } from './notifications/registry';
import { z } from 'zod';
import { getMovieDetails } from './tmdb';
import type { Session } from 'next-auth';
import type { IMovie, IActor, IDirector } from '../models/movie';
import type { Quality } from './schemas';
import { searchFiltersSchema, searchQuerySchema, searchSortSchema, searchPaginationSchema, movieIdSchema } from './schemas';

// --- Shared Types and Helpers from actions.ts ---
export type BaseSerializedMovie = Omit<IMovie, '_id' | 'lastFetched' | 'embedding' | keyof Document> & {
    _id: string;
    userId: string;
    addedAt: string;
};

export type SerializedMovie = BaseSerializedMovie & {
    quality: Quality[];
    customNotes?: string;
};

export type SerializedWishlistMovie = BaseSerializedMovie;

export interface LibraryStats {
    totalFilms: number;
    in4K: number;
    thisMonth: number;
}

type SessionSuccess = { session: Session & { user: { id: string } }; error?: never };
type SessionError = { error: { success: false; message: string }; session?: never };

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

export function serializeBaseMovie(baseObj: any, movieDetails: any): BaseSerializedMovie {
    return {
        _id: baseObj._id.toString(),
        userId: baseObj.userId.toString(),
        tmdbId: baseObj.tmdbId,
        addedAt: (() => {
            const d = baseObj.addedAt ? new Date(baseObj.addedAt) : new Date();
            return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
        })(),
        title: movieDetails.title,
        poster: movieDetails.poster || '',
        overview: movieDetails.overview || '',
        genres: movieDetails.genres || [],
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

export function serializeMovie(doc: any): SerializedMovie {
    const userMovie = doc.userMovie || doc;
    const movieDetails = doc.movieDetails || doc;
    return {
        ...serializeBaseMovie(userMovie, movieDetails),
        quality: userMovie.quality,
        customNotes: userMovie.customNotes,
    };
}

export function serializeWishlistMovie(doc: any): SerializedWishlistMovie {
    const userWishlist = doc;
    const movieDetails = doc.movieDetails || doc;
    return serializeBaseMovie(userWishlist, movieDetails);
}

// --- Extracted Data Fetching Functions ---
export async function getUserWishlist(
    pagination?: z.infer<typeof searchPaginationSchema>
): Promise<{ success: boolean; message?: string; movies: SerializedWishlistMovie[]; hasMore?: boolean; page?: number }> {
    const { session, error } = await getValidatedSession('view wishlist');
    if (error) return { ...error, movies: [] };

    const parsedPagination = searchPaginationSchema.safeParse(pagination || { page: 1, limit: 20 });
    if (!parsedPagination.success) {
        return { success: false, message: 'Invalid pagination.', movies: [] };
    }

    const { page, limit } = parsedPagination.data;

    try {
        await dbConnect();
        const userId = new Types.ObjectId(session.user.id);

        const pipeline: any[] = [
            { $match: { userId } },
            { $sort: { addedAt: -1 } },
            {
                $lookup: {
                    from: 'movies',
                    localField: 'tmdbId',
                    foreignField: 'tmdbId',
                    as: 'movieDetails'
                }
            },
            { $unwind: '$movieDetails' },
            { $skip: (page - 1) * limit },
            { $limit: limit + 1 }
        ];

        const rawResult = await UserWishlist.aggregate(pipeline);
        const hasMore = rawResult.length > limit;
        const pageMovies = hasMore ? rawResult.slice(0, limit) : rawResult;

        return {
            success: true,
            movies: pageMovies.map(serializeWishlistMovie),
            hasMore,
            page
        };
    } catch (err) {
        console.error('Error fetching wishlist:', err);
        return { success: false, message: 'Failed to fetch wishlist.', movies: [] };
    }
}

export async function getUserMovieAndWishlistIds(): Promise<{ success: boolean; libraryIds: number[]; wishlistIds: number[]; message?: string }> {
    const { session, error } = await getValidatedSession('fetch user library state');
    if (error) return { ...error, libraryIds: [], wishlistIds: [] };

    try {
        await dbConnect();
        const userId = new Types.ObjectId(session.user.id);

        const [libraryIds, wishlistIds] = await Promise.all([
            UserMovie.distinct('tmdbId', { userId }),
            UserWishlist.distinct('tmdbId', { userId })
        ]);

        return {
            success: true,
            libraryIds,
            wishlistIds
        };
    } catch (err) {
        console.error('Error fetching IDs:', err);
        return { success: false, message: 'Failed to fetch IDs.', libraryIds: [], wishlistIds: [] };
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

            if (safeFilters?.genres && safeFilters.genres.length > 0) {
                pipeline.push({ $match: { genres: { $in: safeFilters.genres } } });
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

            if (safeFilters?.genres && safeFilters.genres.length > 0) {
                pipeline.push({ $match: { 'movieDetails.genres': { $in: safeFilters.genres } } });
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
                    in4K: { $sum: { $cond: [{ $in: ['4K', '$quality'] }, 1, 0] } },
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

export async function getNotificationPreferences(): Promise<{ success: boolean; message?: string; preferences?: Record<NotificationType, boolean> }> {
    const { session, error } = await getValidatedSession('fetch notification preferences');
    if (error) return { ...error, preferences: undefined };

    try {
        await dbConnect();
        const user = await User.findById(session.user.id).lean();
        if (!user) {
            return { success: false, message: 'User not found' };
        }
        return { success: true, preferences: user.notificationPreferences as any };
    } catch (err) {
        console.error('Failed to fetch preferences:', err);
        return { success: false, message: 'Database error' };
    }
}

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
            quality: [] as Quality[], // recommendations don't have a stored quality
            addedAt: new Date().toISOString(),
            customNotes: '',
            title: m.title,
            poster: m.poster || '',
            overview: m.overview || '',
            genres: m.genres || [],
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

