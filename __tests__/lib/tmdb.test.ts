import { searchMovies, getMovieDetails } from '@/app/lib/tmdb';

// Mock @/auth at the top level so Jest intercepts it before module resolution
// reaches next-auth (which uses ESM and can't be parsed by Jest's CJS transform)
jest.mock('@/auth', () => ({
  auth: jest.fn().mockResolvedValue({ user: { id: 'test-user-id' } }),
}));

// Save original fetch
const originalFetch = global.fetch;

beforeEach(() => {
  // Clear env and mocks before each test
  process.env.TMDB_API_READ_ACCESS_TOKEN = 'test-token-abc123';
  jest.restoreAllMocks();
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe('searchMovies', () => {
  const mockSearchResponse = {
    page: 1,
    results: [
      {
        id: 550,
        title: 'Fight Club',
        overview: 'An insomniac...',
        poster_path: '/pB8BM7pdSp6B6Ih7QI4S2t0POI.jpg',
        release_date: '1999-10-15',
        genre_ids: [18],
        vote_average: 8.4,
      },
    ],
    total_pages: 1,
    total_results: 1,
  };

  it('returns results on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSearchResponse),
    });

    const result = await searchMovies('Fight Club');
    expect(result.results).toHaveLength(1);
    expect(result.results[0].title).toBe('Fight Club');
    expect(result.total_results).toBe(1);
    expect(result.page).toBe(1);
  });

  it('empty query returns empty results without fetching', async () => {
    global.fetch = jest.fn();

    const result = await searchMovies('');
    expect(result).toEqual({
      page: 1,
      results: [],
      total_pages: 0,
      total_results: 0,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('handles non-OK status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    await expect(searchMovies('test')).rejects.toThrow(
      'Failed to search movies. Please try again later.'
    );
  });

  it('handles network failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    await expect(searchMovies('test')).rejects.toThrow(
      'Failed to search movies. Please try again later.'
    );
  });

  it('URL-encodes the query parameter', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSearchResponse),
    });

    await searchMovies('hello world & more');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('hello%20world%20%26%20more'),
      expect.any(Object)
    );
  });

  it('passes Authorization header with Bearer token', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSearchResponse),
    });

    await searchMovies('test');
    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    expect(fetchCall[1].headers.Authorization).toBe('Bearer test-token-abc123');
  });
});

describe('getMovieDetails', () => {
  const mockDetailsResponse = {
    id: 550,
    title: 'Fight Club',
    overview: 'An insomniac...',
    poster_path: '/pB8BM7pdSp6B6Ih7QI4S2t0POI.jpg',
    release_date: '1999-10-15',
    genre_ids: [18],
    vote_average: 8.4,
    genres: [{ id: 18, name: 'Drama' }],
    runtime: 139,
    status: 'Released',
    tagline: 'Mischief. Mayhem. Soap.',
  };

  it('returns details on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDetailsResponse),
    });

    const result = await getMovieDetails(550);
    expect(result.title).toBe('Fight Club');
    expect(result.genres).toEqual([{ id: 18, name: 'Drama' }]);
    expect(result.runtime).toBe(139);
    expect(result.status).toBe('Released');
  });

  it('handles non-OK status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    await expect(getMovieDetails(999999)).rejects.toThrow(
      'Failed to fetch movie details. Please try again later.'
    );
  });

  it('handles network failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused'));

    await expect(getMovieDetails(550)).rejects.toThrow(
      'Failed to fetch movie details. Please try again later.'
    );
  });
});
