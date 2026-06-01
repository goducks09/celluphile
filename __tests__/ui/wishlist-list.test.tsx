import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WishlistList from '@/app/ui/wishlist-list';
import { removeMovieFromWishlist, addMovieToLibrary } from '@/app/lib/actions';
import { toast } from 'sonner';

// Mock dependencies
jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ fill, priority, ...props }: any) => <img {...props} />,
}));

jest.mock('@/app/lib/actions', () => ({
    removeMovieFromWishlist: jest.fn(),
    addMovieToLibrary: jest.fn(),
}));

jest.mock('sonner', () => ({
    toast: {
        success: jest.fn(),
        error: jest.fn(),
        loading: jest.fn(),
        warning: jest.fn(),
    },
}));

const mockMovies: any[] = [
    {
        tmdbId: 1,
        title: 'Movie 1',
        poster: '/poster1.jpg',
        addedAt: new Date('2023-01-01T00:00:00Z'),
        releaseDate: '2023-01-01',
    },
    {
        tmdbId: 2,
        title: 'Movie 2',
        poster: null,
        addedAt: new Date('2023-01-02T00:00:00Z'),
        releaseDate: null,
    }
];

describe('WishlistList Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders empty state when no items are present', () => {
        render(<WishlistList initialMovies={[]} />);
        expect(screen.getByText(/Your wishlist is empty/i)).toBeInTheDocument();
    });

    it('renders a list of wishlist movies', () => {
        render(<WishlistList initialMovies={mockMovies} />);
        expect(screen.getByText('Movie 1')).toBeInTheDocument();
        expect(screen.getByText('Movie 2')).toBeInTheDocument();
    });

    it('optimistically removes item on Remove click', async () => {
        (removeMovieFromWishlist as jest.Mock).mockResolvedValue({ success: true });
        
        render(<WishlistList initialMovies={mockMovies} />);
        
        // Default sort is newest-first by addedAt: Movie 2 (Jan 2) renders first, Movie 1 (Jan 1) second.
        // Click the first remove button (Movie 2's card).
        const removeButtons = screen.getAllByRole('button', { name: /Remove from wishlist/i });
        fireEvent.click(removeButtons[0]);
        
        // Item should be removed from the DOM after the transition completes
        await waitFor(() => {
            expect(screen.queryByText('Movie 2')).not.toBeInTheDocument();
        });
        
        await waitFor(() => {
            expect(removeMovieFromWishlist).toHaveBeenCalledWith(2);
        });
    });

    it('disables Move to Library button without quality, then works with quality', async () => {
        let resolveServerAction: (val: any) => void;
        (addMovieToLibrary as jest.Mock).mockImplementation(() => {
            return new Promise(resolve => {
                resolveServerAction = resolve;
            });
        });
        
        render(<WishlistList initialMovies={[mockMovies[0]]} />);
        
        const moveButton = screen.getByText('Move to Library');
        
        // Click without quality
        fireEvent.click(moveButton);
        expect(toast.warning).toHaveBeenCalled();
        
        // Select quality (click the 4K checkbox in Movie 1's card)
        const fourKCheckboxes = screen.getAllByRole('checkbox', { name: /4k/i });
        fireEvent.click(fourKCheckboxes[0]);
        
        // Trigger move to library
        fireEvent.click(moveButton);
        
        // Verify optimistic (synchronous, pre-response) removal
        expect(screen.queryByText('Movie 1')).not.toBeInTheDocument();
        
        // Resolve the server action
        resolveServerAction!({ success: true });
        
        await waitFor(() => {
            expect(addMovieToLibrary).toHaveBeenCalledWith({ tmdbId: 1, quality: ['4K'] });
            expect(toast.success).toHaveBeenCalled();
        });
    });
});
