import { Suspense } from 'react';
import { render, screen } from '@testing-library/react';
import { getMovieByTmdbId } from '@/app/lib/data';
import { notFound, redirect } from 'next/navigation';

jest.mock('@/app/lib/data', () => ({
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

    it('renders Suspense boundary with skeleton fallback', async () => {
        const ItemPage = (await import('@/app/(app)/library/[tmdbId]/page')).default;
        const paramsPromise = Promise.resolve({ tmdbId: '550' });
        const element = ItemPage({ params: paramsPromise });
        
        expect(element.type).toBe(Suspense);
        expect(element.props.fallback).toBeDefined();
    });

    it('calls notFound when tmdbId is not a valid number', async () => {
        const { MovieDetailContent } = await import('@/app/(app)/library/[tmdbId]/page');
        await expect(
            MovieDetailContent({ params: Promise.resolve({ tmdbId: 'abc' }) })
        ).rejects.toThrow('NEXT_NOT_FOUND');
        expect(notFound).toHaveBeenCalled();
    });

    it('redirects to library if user is not authenticated or not owner of data', async () => {
        const { MovieDetailContent } = await import('@/app/(app)/library/[tmdbId]/page');
        (getMovieByTmdbId as jest.Mock).mockResolvedValue({ success: false, message: 'Not found or forbidden' });
        
        await expect(
            MovieDetailContent({ params: Promise.resolve({ tmdbId: '550' }) })
        ).rejects.toThrow('NEXT_REDIRECT');
        
        expect(redirect).toHaveBeenCalledWith('/library');
    });

    it('renders ItemDetail component when movie is found', async () => {
        const { MovieDetailContent } = await import('@/app/(app)/library/[tmdbId]/page');
        const mockMovie = { title: 'Test Movie 123' };
        (getMovieByTmdbId as jest.Mock).mockResolvedValue({ success: true, movie: mockMovie });
        
        const Resolved = await MovieDetailContent({ params: Promise.resolve({ tmdbId: '550' }) });
        render(Resolved);
        
        expect(screen.getByTestId('item-detail')).toHaveTextContent('Test Movie 123');
        expect(getMovieByTmdbId).toHaveBeenCalledWith(550);
    });
});
