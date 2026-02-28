const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_READ_ACCESS_TOKEN = process.env.TMDB_API_READ_ACCESS_TOKEN;

const fetchOptions = {
    method: 'GET',
    headers: {
        accept: 'application/json',
        Authorization: `Bearer ${TMDB_API_READ_ACCESS_TOKEN}`,
    },
};

export interface TMDBMovie {
    id: number;
    title: string;
    overview: string;
    poster_path: string | null;
    release_date: string;
    genre_ids: number[];
    vote_average: number;
}

export interface TMDBSearchResponse {
    page: number;
    results: TMDBMovie[];
    total_pages: number;
    total_results: number;
}

export interface TMDBMovieDetails extends TMDBMovie {
    genres: { id: number; name: string }[];
    runtime: number | null;
    status: string;
    tagline: string;
}

/**
 * Search for movies by title
 * Includes rate limiting implicit from Vercel edge/serverless fetching setup,
 * though a custom rate limiter could be added. TMDB allows 50 reqs/sec.
 */
export async function searchMovies(query: string, page: number = 1): Promise<TMDBSearchResponse> {
    if (!query) {
        return { page: 1, results: [], total_pages: 0, total_results: 0 };
    }

    const url = `${TMDB_API_BASE_URL}/search/movie?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=${page}`;

    try {
        const response = await fetch(url, fetchOptions);

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
    const url = `${TMDB_API_BASE_URL}/movie/${id}?language=en-US`;

    try {
        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
            throw new Error(`TMDB API Error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`Error fetching movie details for ID ${id}:`, error);
        throw new Error('Failed to fetch movie details. Please try again later.');
    }
}
