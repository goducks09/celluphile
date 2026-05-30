import { addMovieToLibrary } from '@/app/lib/actions';
import UserWishlist from '@/app/models/userWishlist';
import UserMovie from '@/app/models/userMovie';
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
jest.mock('@/auth', () => ({ auth: jest.fn().mockResolvedValue({ user: { id: '507f1f77bcf86cd799439011' } }) }));

jest.mock('@/app/models/userMovie', () => {
    const mockModel: any = jest.fn(function (this: any, data: any) {
        this.data = data;
    });
    mockModel.prototype.save = jest.fn().mockResolvedValue(true);
    mockModel.findOne = jest.fn();
    return { __esModule: true, default: mockModel };
});

jest.mock('@/app/models/userWishlist', () => ({
    __esModule: true,
    default: {
        findOneAndDelete: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
    }
}));

jest.mock('@/app/models/movie', () => ({
    __esModule: true,
    default: {
        findOne: jest.fn(),
        findOneAndUpdate: jest.fn(),
    }
}));

jest.mock('@/app/models/userEvent', () => {
    return { __esModule: true, default: function () { return { save: jest.fn().mockResolvedValue(true) }; } };
});

jest.mock('@/app/lib/tmdb', () => ({ getMovieDetails: jest.fn() }));

describe('addMovieToLibrary wishlist cleanup', () => {
    beforeEach(() => { jest.clearAllMocks(); });

    it('UserWishlist.findOneAndDelete is called before UserMovie is created', async () => {
        (UserMovie.findOne as jest.Mock).mockResolvedValueOnce(null);
        (Movie.findOne as jest.Mock).mockResolvedValueOnce({ _id: '123' });

        await addMovieToLibrary({ tmdbId: 1, quality: '4K' });
        expect(UserWishlist.findOneAndDelete).toHaveBeenCalledWith({
            userId: expect.anything(), tmdbId: 1
        });
    });

    it('If deletion succeeds but UserMovie creation fails, the catch block re-inserts UserWishlist', async () => {
        (UserMovie.findOne as jest.Mock).mockResolvedValueOnce(null);
        (Movie.findOne as jest.Mock).mockResolvedValueOnce({ _id: '123' });
        (UserWishlist.findOneAndDelete as jest.Mock).mockResolvedValueOnce({ addedAt: new Date() });

        jest.spyOn(UserMovie.prototype, 'save').mockRejectedValueOnce(new Error('Save failed'));
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        const result = await addMovieToLibrary({ tmdbId: 1, quality: '4K' });
        expect(result.success).toBe(false);
        expect(UserWishlist.create).toHaveBeenCalledWith({
            userId: expect.anything(), tmdbId: 1, addedAt: expect.any(Date)
        });

        consoleSpy.mockRestore();
    });

    it('revalidatePath(/wishlist) is called alongside library revalidation', async () => {
        (UserMovie.findOne as jest.Mock).mockResolvedValueOnce(null);
        (Movie.findOne as jest.Mock).mockResolvedValueOnce({ _id: '123' });

        await addMovieToLibrary({ tmdbId: 1, quality: '4K' });
        expect(revalidatePath).toHaveBeenCalledWith('/wishlist');
        expect(revalidatePath).toHaveBeenCalledWith('/library');
    });
});
