import { render, screen } from '@testing-library/react';
import { getMovieByTmdbId } from '@/app/lib/actions';
import { notFound, redirect } from 'next/navigation';

jest.mock('@/app/lib/actions', () => ({
  getMovieByTmdbId: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
  redirect: jest.fn(() => { throw new Error('NEXT_REDIRECT'); }),
}));

jest.mock('@/app/ui/item-detail', () => ({
  __esModule: true,
  default: ({ movie }: any) => <div data-testid="item-detail">{movie.title}</div>,
}));

describe('ItemPage Server Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('calls notFound when tmdbId is not a valid number', async () => {
        const ItemPage = (await import('@/app/dashboard/library/[tmdbId]/page')).default;
        await expect(
            ItemPage({ params: Promise.resolve({ tmdbId: 'abc' }) })
        ).rejects.toThrow('NEXT_NOT_FOUND');
        expect(notFound).toHaveBeenCalled();
    });

    it('redirects to library if user is not authenticated or not owner of data', async () => {
        const ItemPage = (await import('@/app/dashboard/library/[tmdbId]/page')).default;
        (getMovieByTmdbId as jest.Mock).mockResolvedValue({ success: false, message: 'Not found or forbidden' });
        
        await expect(
            ItemPage({ params: Promise.resolve({ tmdbId: '550' }) })
        ).rejects.toThrow('NEXT_REDIRECT');
        
        expect(redirect).toHaveBeenCalledWith('/dashboard/library');
    });

    it('renders ItemDetail component when movie is found', async () => {
        const ItemPage = (await import('@/app/dashboard/library/[tmdbId]/page')).default;
        const mockMovie = { title: 'Test Movie 123' };
        (getMovieByTmdbId as jest.Mock).mockResolvedValue({ success: true, movie: mockMovie });
        
        const Resolved = await ItemPage({ params: Promise.resolve({ tmdbId: '550' }) });
        render(Resolved);
        
        expect(screen.getByTestId('item-detail')).toHaveTextContent('Test Movie 123');
        expect(getMovieByTmdbId).toHaveBeenCalledWith(550);
    });
});
