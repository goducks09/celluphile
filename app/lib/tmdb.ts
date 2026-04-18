'use server';

import { auth } from '@/auth';
import { z } from 'zod';
import { movieIdSchema, searchQuerySchema } from './schemas';
import type { TMDBSearchResponse, TMDBMovieDetails } from './tmdb-utils';

const TMDB_API_BASE_URL = process.env.TMDB_API_BASE_URL || 'https://api.themoviedb.org/3';
const getFetchOptions = () => ({
    method: 'GET',
    headers: {
        accept: 'application/json',
        Authorization: `Bearer ${process.env.TMDB_API_READ_ACCESS_TOKEN}`,
    },
});

// All TMDB type definitions live in ./tmdb-utils to keep this server-action
// file free of synchronous exports (Next.js requires all exports from a
// 'use server' file to be async functions).
export type { TMDBMovie, TMDBSearchResponse, TMDBMovieDetails } from './tmdb-utils';

/**
 * Search for movies by title
 * Includes rate limiting implicit from Vercel edge/serverless fetching setup,
 * though a custom rate limiter could be added. TMDB allows 50 reqs/sec.
 */
export async function searchMovies(query: string, page: number = 1): Promise<TMDBSearchResponse> {
    const session = await auth();
    if (!session?.user) {
        throw new Error('Unauthorized request.');
    }

    const parsedQuery = searchQuerySchema.safeParse(query);
    const parsedPage = z.number().int().positive().safeParse(page);

    if (!parsedQuery.success || !parsedPage.success) {
        throw new Error('Invalid search parameters.');
    }

    const safeQuery = parsedQuery.data;
    const safePage = parsedPage.data;

    if (!safeQuery) {
        return { page: 1, results: [], total_pages: 0, total_results: 0 };
    }

    const url = `${TMDB_API_BASE_URL}/search/movie?query=${encodeURIComponent(safeQuery)}&include_adult=false&language=en-US&page=${safePage}`;

    try {
        const response = await fetch(url, getFetchOptions());

        if (!response.ok) {
            throw new Error(`TMDB API Error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error searching movies:', error);
        throw new Error('Failed to search movies. Please try again later.');
    }
}

/**
 * Fetch detailed information for a specific movie by its TMDB ID
 */
export async function getMovieDetails(id: number): Promise<TMDBMovieDetails> {
    const session = await auth();
    if (!session?.user) {
        throw new Error('Unauthorized request.');
    }

    const parsedId = movieIdSchema.safeParse(id);
    if (!parsedId.success) {
        throw new Error('Invalid movie ID.');
    }

    const url = `${TMDB_API_BASE_URL}/movie/${parsedId.data}?language=en-US&append_to_response=credits`;

    try {
        const response = await fetch(url, getFetchOptions());

        if (!response.ok) {
            throw new Error(`TMDB API Error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`Error fetching movie details for ID ${id}:`, error);
        throw new Error('Failed to fetch movie details. Please try again later.');
    }
}

