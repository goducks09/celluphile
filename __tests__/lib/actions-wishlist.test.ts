import { addMovieToWishlist, removeMovieFromWishlist } from '@/app/lib/actions';
import { getUserWishlist, getUserMovieAndWishlistIds } from '@/app/lib/data';
import UserWishlist from '@/app/models/userWishlist';
import UserMovie from '@/app/models/userMovie';
import UserEvent from '@/app/models/userEvent';
import Movie from '@/app/models/movie';
import { revalidatePath } from 'next/cache';

jest.mock('@/app/lib/mongoose', () => jest.fn());

jest.mock('mongoose', () => {
    class MockObjectId {
        id: string;
        constructor(id: string) { this.id = id; }
        toString() { return this.id; }
        static isValid(id: string) { return /^[0-9a-fA-F]{24}$/.test(id); }
    }
    class MockSchema { index = jest.fn(); }
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

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/auth', () => ({
    auth: jest.fn().mockResolvedValue({ user: { id: '507f1f77bcf86cd799439011' } })
}));

jest.mock('@/app/models/userMovie', () => ({
    __esModule: true,
    default: {
        findOne: jest.fn(),
        distinct: jest.fn(),
    }
}));

jest.mock('@/app/models/userWishlist', () => {
    const mockModel: any = jest.fn(function(this: any, data: any) {
        this.data = data;
        this.save = jest.fn().mockResolvedValue(true);
    });
    mockModel.findOne = jest.fn();
    mockModel.findOneAndDelete = jest.fn();
    mockModel.aggregate = jest.fn();
    mockModel.distinct = jest.fn();
    return { __esModule: true, default: mockModel };
});

jest.mock('@/app/models/userEvent', () => {
    const mockModel: any = jest.fn(function(this: any, data: any) {
        this.data = data;
        this.save = jest.fn().mockResolvedValue(true);
    });
    return { __esModule: true, default: mockModel };
});

jest.mock('@/app/models/movie', () => ({
    __esModule: true,
    default: {
        findOne: jest.fn(),
        findOneAndUpdate: jest.fn(),
    }
}));

jest.mock('@/app/lib/tmdb', () => ({
    getMovieDetails: jest.fn(),
}));

describe('Wishlist Server Actions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('addMovieToWishlist', () => {
        it('successfully adds to wishlist and logs event', async () => {
            (UserMovie.findOne as jest.Mock).mockResolvedValueOnce(null);
            (UserWishlist.findOne as jest.Mock).mockResolvedValueOnce(null);
            (Movie.findOne as jest.Mock).mockResolvedValueOnce({ _id: '123' });

            const res = await addMovieToWishlist(123);
            expect(res.success).toBe(true);
            expect(res.message).toBe('Movie added to wishlist.');

            // Verify UserWishlist constructor was called
            expect(UserWishlist).toHaveBeenCalledWith(expect.objectContaining({
                tmdbId: 123
            }));

            // Verify UserEvent was logged
            expect(UserEvent).toHaveBeenCalledWith(expect.objectContaining({
                tmdbId: 123,
                event: 'wishlisted'
            }));

            // Verify revalidatePath was called
            expect(revalidatePath).toHaveBeenCalledWith('/wishlist');
        });
    });

    describe('removeMovieFromWishlist', () => {
        it('calls delete, logs event and revalidates', async () => {
            (UserWishlist.findOneAndDelete as jest.Mock).mockResolvedValueOnce({ _id: '123' });
            
            const res = await removeMovieFromWishlist(123);
            expect(res.success).toBe(true);

            // Verify UserEvent was logged
            expect(UserEvent).toHaveBeenCalledWith(expect.objectContaining({
                tmdbId: 123,
                event: 'unwishlisted'
            }));

            // Verify revalidatePath was called
            expect(revalidatePath).toHaveBeenCalledWith('/wishlist');
        });
    });

    describe('getUserWishlist', () => {
        it('returns paginated wishlist movies', async () => {
            (UserWishlist.aggregate as jest.Mock).mockResolvedValueOnce([
                { _id: '1', userId: '2', tmdbId: 1, addedAt: new Date(), movieDetails: {} }
            ]);
            const res = await getUserWishlist();
            expect(res.success).toBe(true);
            expect(res.hasMore).toBe(false);
        });
    });

    describe('getUserMovieAndWishlistIds', () => {
        it('returns distinct arrays', async () => {
            (UserMovie.distinct as jest.Mock).mockResolvedValueOnce([1]);
            (UserWishlist.distinct as jest.Mock).mockResolvedValueOnce([2]);
            const res = await getUserMovieAndWishlistIds();
            expect(res.success).toBe(true);
            expect(res.libraryIds).toEqual([1]);
            expect(res.wishlistIds).toEqual([2]);
        });
    });
});
