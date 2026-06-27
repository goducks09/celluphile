/**
 * Pure TMDB type definitions and utility helpers.
 * This file has NO 'use server' directive — it is safe to import from
 * both Server Components and Client Components.
 */

export interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date: string;
  genre_ids: number[];
  vote_average: number;
  vote_count: number;
  popularity: number;
}

export interface TMDBSearchResponse {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

export interface TMDBCrewMember {
  id: number;
  name: string;
  job: string;
}

export interface TMDBCastMember {
  id: number;
  name: string;
  order: number;
}

export interface TMDBCredits {
  cast: TMDBCastMember[];
  crew: TMDBCrewMember[];
}

export interface TMDBMovieDetails extends TMDBMovie {
  genres: { id: number; name: string }[];
  runtime: number | null;
  status: string;
  tagline: string;
  credits: TMDBCredits;
  keywords?: { keywords: { id: number; name: string }[] };
}

/**
 * Extracts cast and crew from a TMDBMovieDetails object.
 * Pure synchronous helper — no server action, no I/O.
 */
export function extractCredits(details: TMDBMovieDetails, maxCast = 5) {
  const splitName = (name: string) => {
    const parts = name.trim().split(' ');
    const lastName = parts.length > 1 ? parts.pop()! : '';
    return { firstName: parts.join(' '), lastName, fullName: name.trim() };
  };

  const actors = details.credits.cast
    .slice(0, maxCast)
    .map(c => splitName(c.name));

  const directors = details.credits.crew
    .filter(c => c.job === 'Director')
    .map(c => splitName(c.name));

  return { actors, directors };
}

/**
 * Helper to construct TMDB image URLs.
 * Bypasses external requests during E2E tests to prevent 404s and rate-limiting.
 */
export function getTMDBImageUrl(path: string | null | undefined, size: 'w342' | 'w500' = 'w500'): string {
  if (!path) return '';
  if (process.env.NEXT_PUBLIC_TEST_MODE === 'true') {
    // Return a base64 transparent GIF to avoid external image requests during testing
    return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  }
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
