import { getRandomMovie } from '@/app/lib/actions';
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
    return {
        __esModule: true,
        default: { connect: jest.fn() },
        Types: { ObjectId: MockObjectId },
        Schema: jest.fn(),
        model: jest.fn(),
        models: {},
    };
});

// Fully mock the movie model (no requireActual to avoid loading real mongoose)
jest.mock('@/app/models/movie', () => ({
    __esModule: true,
    default: {
        aggregate: jest.fn(),
    },
}));

// Fully mock the userMovie model
jest.mock('@/app/models/userMovie', () => ({
    __esModule: true,
    default: {
        aggregate: jest.fn(),
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

describe('getRandomMovie action', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns error if user is unauthenticated', async () => {
        (auth as jest.Mock).mockResolvedValue(null);
        
        const result = await getRandomMovie();
        expect(result.success).toBe(false);
        expect(result.message).toContain('You must be logged in');
    });

    it('returns empty library message if aggregation returns no results', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: '507f1f77bcf86cd799439011' } });
        
        (UserMovie.aggregate as jest.Mock).mockResolvedValue([]);
        
        const result = await getRandomMovie();
        expect(result.success).toBe(false);
        expect(result.message).toBe('Your library is empty.');
        expect(UserMovie.aggregate).toHaveBeenCalledWith([
            { $match: { userId: expect.any(Object) } },
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
    });

    it('returns serialized movie on happy path', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: '507f1f77bcf86cd799439011' } });
        
        const mockMovie = {
            _id: { toString: () => 'abc123def456abc123def456' },
            userId: { toString: () => '507f1f77bcf86cd799439011' },
            tmdbId: 550,
            movieDetails: {
                title: 'Random Movie',
                actors: [{ firstName: 'Tom', lastName: 'Hanks', fullName: 'Tom Hanks' }],
                directors: [{ firstName: 'Steven', lastName: 'Spielberg', fullName: 'Steven Spielberg' }],
                runtime: 142,
                releaseDate: '1993-06-11',
            }
        };
        (UserMovie.aggregate as jest.Mock).mockResolvedValue([mockMovie]);
        
        const result = await getRandomMovie();
        expect(result.success).toBe(true);
        expect(result.movie?.title).toBe('Random Movie');
        expect(typeof result.movie?._id).toBe('string');
        expect(typeof result.movie?.userId).toBe('string');
        expect(result.movie?.actors).toEqual([{ firstName: 'Tom', lastName: 'Hanks', fullName: 'Tom Hanks' }]);
    });

    it('returns error message when database throws', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: '507f1f77bcf86cd799439011' } });

        (UserMovie.aggregate as jest.Mock).mockImplementation(() => {
            throw new Error('DB connection lost');
        });

        const result = await getRandomMovie();
        expect(result.success).toBe(false);
        expect(result.message).toBe('Failed to get a random movie.');
    });
});
