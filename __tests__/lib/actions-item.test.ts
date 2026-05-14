import { getMovieByTmdbId } from '@/app/lib/actions';
import { auth } from '@/auth';
import Movie from '@/app/models/movie';
import UserMovie from '@/app/models/userMovie';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/app/lib/mongoose', () => jest.fn());

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

// Fully mock mongoose to avoid BSON ESM import errors in jsdom
jest.mock('mongoose', () => {
    class MockObjectId {
        id: string;
        constructor(id: string) { this.id = id; }
        toString() { return this.id; }
        static isValid(id: string) { return /^[0-9a-fA-F]{24}$/.test(id); }
    }
    class MockSchema {
        index = jest.fn();
    }
    (MockSchema as any).Types = { ObjectId: MockObjectId };
    return {
        __esModule: true,
        default: { connect: jest.fn() },
        Types: { ObjectId: MockObjectId },
        Schema: MockSchema,
        model: jest.fn(),
        models: {},
    };
});

// Fully mock the movie model (no requireActual to avoid loading real mongoose)
jest.mock('@/app/models/movie', () => ({
    __esModule: true,
    default: {
        findOne: jest.fn(),
    },
}));

// Fully mock the userMovie model
jest.mock('@/app/models/userMovie', () => ({
    __esModule: true,
    default: {
        findOne: jest.fn(),
    },
}));

// Mock the user model to prevent it from importing real mongoose
jest.mock('@/app/models/user', () => ({
    __esModule: true,
    default: {},
}));

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

describe('getMovieByTmdbId action', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns error if user is unauthenticated', async () => {
        (auth as jest.Mock).mockResolvedValue(null);
        
        const result = await getMovieByTmdbId(550);
        expect(result.success).toBe(false);
        expect(result.message).toContain('You must be logged in');
    });

    it('returns error for invalid tmdbId (zero)', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: '507f1f77bcf86cd799439011' } });

        const result = await getMovieByTmdbId(0);
        expect(result.success).toBe(false);
        expect(result.message).toBe('Invalid movie ID.');
        expect(Movie.findOne).not.toHaveBeenCalled();
    });

    it('returns error for invalid tmdbId (negative)', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: '507f1f77bcf86cd799439011' } });

        const result = await getMovieByTmdbId(-1);
        expect(result.success).toBe(false);
        expect(result.message).toBe('Invalid movie ID.');
        expect(Movie.findOne).not.toHaveBeenCalled();
    });

    it('returns error if movie does not exist or does not belong to user', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: '507f1f77bcf86cd799439011' } });
        
        const mockLean = jest.fn().mockResolvedValue(null);
        (UserMovie.findOne as jest.Mock).mockReturnValue({ lean: mockLean });
        
        const result = await getMovieByTmdbId(550);
        expect(result.success).toBe(false);
        expect(result.message).toBe('Movie not found in your library.');
        expect(UserMovie.findOne).toHaveBeenCalledWith({
            userId: expect.any(Object),
            tmdbId: 550,
        });
    });

    it('returns serialized movie with _id and userId as strings', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: '507f1f77bcf86cd799439011' } });
        
        const mockLeanUser = jest.fn().mockResolvedValue({
            _id: { toString: () => 'abc123def456abc123def456' },
            userId: { toString: () => '507f1f77bcf86cd799439011' },
            tmdbId: 550,
        });
        (UserMovie.findOne as jest.Mock).mockReturnValue({ lean: mockLeanUser });

        const mockLeanMovie = jest.fn().mockResolvedValue({
            title: 'Found Movie',
            actors: [{ firstName: 'Tom', lastName: 'Hanks', fullName: 'Tom Hanks' }],
            directors: [{ firstName: 'Steven', lastName: 'Spielberg', fullName: 'Steven Spielberg' }],
            runtime: 142,
            releaseDate: '1993-06-11',
        });
        (Movie.findOne as jest.Mock).mockReturnValue({ lean: mockLeanMovie });
        
        const result = await getMovieByTmdbId(550);
        expect(result.success).toBe(true);
        expect(result.movie?.title).toBe('Found Movie');
        // Verify serialization: _id and userId are strings
        expect(typeof result.movie?._id).toBe('string');
        expect(typeof result.movie?.userId).toBe('string');
        // Verify actors/directors are plain objects
        expect(result.movie?.actors).toEqual([{ firstName: 'Tom', lastName: 'Hanks', fullName: 'Tom Hanks' }]);
        expect(result.movie?.directors).toEqual([{ firstName: 'Steven', lastName: 'Spielberg', fullName: 'Steven Spielberg' }]);
        expect(result.movie?.runtime).toBe(142);
        expect(result.movie?.releaseDate).toBe('1993-06-11');
    });

    it('returns error message when database throws', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: '507f1f77bcf86cd799439011' } });
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        (UserMovie.findOne as jest.Mock).mockImplementation(() => {
            throw new Error('DB connection lost');
        });

        const result = await getMovieByTmdbId(550);
        expect(result.success).toBe(false);
        expect(result.message).toBe('Failed to find movie.');
        
        consoleSpy.mockRestore();
    });
});
