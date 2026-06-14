import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ItemDetail from '@/app/ui/item-detail';
import type { SerializedMovie } from '@/app/lib/data';
import { updateMovieInLibrary, removeMovieFromLibrary } from '@/app/lib/actions';
import { db } from '@/app/lib/db-client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

jest.mock('@/app/lib/actions', () => ({
    __esModule: true,
    updateMovieInLibrary: jest.fn(),
    removeMovieFromLibrary: jest.fn(),
}));

jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
}));

// Mock Dexie locally
const mockModify = jest.fn().mockResolvedValue(undefined);
const mockDelete = jest.fn().mockResolvedValue(undefined);
const mockEquals = jest.fn().mockReturnValue({ modify: mockModify, delete: mockDelete });
const mockWhere = jest.fn().mockReturnValue({ equals: mockEquals });
const mockDbSyncQueueAdd = jest.fn();

jest.mock('@/app/lib/db-client', () => ({
    db: {
        movies: {
            where: (...args: any[]) => mockWhere(...args),
        },
        syncQueue: {
            add: (...args: any[]) => mockDbSyncQueueAdd(...args),
        },
    },
}));

jest.mock('sonner', () => ({
    toast: {
        success: jest.fn(),
        error: jest.fn(),
        loading: jest.fn().mockReturnValue('toast-id'),
    },
}));

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ src, alt, fill, sizes, priority, ...rest }: any) => <img src={src} alt={alt} {...rest} />,
}));

const mockMovie: SerializedMovie = {
    _id: '1',
    userId: 'user1',
    tmdbId: 100,
    title: 'Test Movie',
    poster: '/test.jpg',
    genres: ['Action'],
    quality: ['Blu-ray'],
    addedAt: '2024-01-01T00:00:00.000Z',
    actors: [{ firstName: 'John', lastName: 'Doe', fullName: 'John Doe' }],
    directors: [{ firstName: 'Jane', lastName: 'Smith', fullName: 'Jane Smith' }],
    releaseDate: '2024-07-15',
    runtime: 120,
    keywords: [],
    overview: 'Test Movie Overview',
};

describe('ItemDetail Component', () => {
    let originalOnLine: boolean;
    const mockPush = jest.fn();

    beforeEach(() => {
        originalOnLine = navigator.onLine;
        Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
        (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
        jest.clearAllMocks();
    });

    afterEach(() => {
        Object.defineProperty(navigator, 'onLine', { value: originalOnLine });
    });

    // ============================================================
    // View mode rendering
    // ============================================================

    it('renders movie details correctly (view mode)', () => {
        render(<ItemDetail movie={mockMovie} />);
        expect(screen.getByText('Test Movie')).toBeInTheDocument();
        expect(screen.getByText('2h 0m')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('Blu-ray')).toBeInTheDocument();
    });

    it('formats release date as Month DD, YYYY', () => {
        render(<ItemDetail movie={mockMovie} />);
        expect(screen.getByText('July 15, 2024')).toBeInTheDocument();
    });

    it('hides runtime when not present', () => {
        const movieNoRuntime = { ...mockMovie, runtime: undefined };
        render(<ItemDetail movie={movieNoRuntime} />);
        expect(screen.queryByText(/h.*m/)).toBeNull();
    });

    it('hides directors section when directors array is empty', () => {
        const movieNoDirectors = { ...mockMovie, directors: [] };
        render(<ItemDetail movie={movieNoDirectors} />);
        expect(screen.queryByText('Director')).toBeNull();
    });

    it('hides cast section when actors array is empty', () => {
        const movieNoActors = { ...mockMovie, actors: [] };
        render(<ItemDetail movie={movieNoActors} />);
        expect(screen.queryByText('Cast')).toBeNull();
    });

    it('hides release date when not present', () => {
        const movieNoDate = { ...mockMovie, releaseDate: undefined };
        render(<ItemDetail movie={movieNoDate} />);
        expect(screen.queryByText('July 15, 2024')).toBeNull();
    });

    it('shows "No Poster Available" when poster is empty', () => {
        const movieNoPoster = { ...mockMovie, poster: '' };
        render(<ItemDetail movie={movieNoPoster} />);
        expect(screen.getByText('No Poster Available')).toBeInTheDocument();
    });

    // ============================================================
    // Edit flow — online
    // ============================================================

    it('handles online update functionality', async () => {
        const user = userEvent.setup();
        (updateMovieInLibrary as jest.Mock).mockResolvedValue({ success: true });

        render(<ItemDetail movie={mockMovie} />);

        await user.click(screen.getByRole('button', { name: /Edit/i }));

        const notesTextarea = screen.getByPlaceholderText('Add custom notes...');
        await user.type(notesTextarea, 'Great movie!');

        await user.click(screen.getByRole('button', { name: /Save Changes/i }));

        await waitFor(() => {
            expect(updateMovieInLibrary).toHaveBeenCalledWith(100, expect.objectContaining({
                customNotes: 'Great movie!',
                quality: ['Blu-ray']
            }));
        });

        expect(toast.success).toHaveBeenCalledWith('Changes saved!', { id: 'toast-id' });
        expect(mockModify).toHaveBeenCalled(); // verified cache update
    });

    it('reverts optimistic update when online save fails', async () => {
        const user = userEvent.setup();
        (updateMovieInLibrary as jest.Mock).mockResolvedValue({ success: false, message: 'Server error' });

        render(<ItemDetail movie={mockMovie} />);

        await user.click(screen.getByRole('button', { name: /Edit/i }));

        // Check '4K' checkbox (Blu-ray is already checked)
        await user.click(screen.getByRole('checkbox', { name: /4k/i }));

        await user.click(screen.getByRole('button', { name: /Save Changes/i }));

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Server error', { id: 'toast-id' });
        });

        // After revert, the original quality badge should be visible again
        expect(screen.getByText('Blu-ray')).toBeInTheDocument();
    });

    // ============================================================
    // Edit flow — offline
    // ============================================================

    it('handles offline update functionality via Dexie', async () => {
        Object.defineProperty(navigator, 'onLine', { value: false });
        const user = userEvent.setup();

        render(<ItemDetail movie={mockMovie} />);

        await user.click(screen.getByRole('button', { name: /Edit/i }));
        const notesTextarea = screen.getByPlaceholderText('Add custom notes...');
        await user.type(notesTextarea, 'Offline edit');

        await user.click(screen.getByRole('button', { name: /Save Changes/i }));

        await waitFor(() => {
            expect(mockWhere).toHaveBeenCalledWith('tmdbId');
            expect(mockEquals).toHaveBeenCalledWith(100);
            expect(mockModify).toHaveBeenCalledWith(expect.objectContaining({ customNotes: 'Offline edit' }));
            expect(mockDbSyncQueueAdd).toHaveBeenCalledWith(expect.objectContaining({ action: 'update' }));
        });

        expect(toast.success).toHaveBeenCalledWith('Offline: Changes saved locally.');
        expect(updateMovieInLibrary).not.toHaveBeenCalled();
    });

    // ============================================================
    // Cancel edit
    // ============================================================

    it('discards changes and exits edit mode on Cancel', async () => {
        const user = userEvent.setup();
        render(<ItemDetail movie={mockMovie} />);

        // Enter edit mode
        await user.click(screen.getByRole('button', { name: /Edit/i }));
        expect(screen.getByPlaceholderText('Add custom notes...')).toBeInTheDocument();

        // Check 4K checkbox to change quality
        await user.click(screen.getByRole('checkbox', { name: /4k/i }));

        // Cancel
        await user.click(screen.getByRole('button', { name: /Cancel/i }));

        // Should exit edit mode — edit form gone, quality badge shows original value
        expect(screen.queryByPlaceholderText('Add custom notes...')).toBeNull();
        expect(screen.getByText('Blu-ray')).toBeInTheDocument();
        expect(updateMovieInLibrary).not.toHaveBeenCalled();
    });

    // ============================================================
    // Delete flow — online
    // ============================================================

    it('handles online delete functionality', async () => {
        const user = userEvent.setup();
        (removeMovieFromLibrary as jest.Mock).mockResolvedValue({ success: true });

        render(<ItemDetail movie={mockMovie} />);

        await user.click(screen.getByRole('button', { name: /Remove/i }));

        // Confirmation dialog test
        expect(screen.getByText(/Are you sure you want to remove/i)).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /Confirm Delete/i }));

        await waitFor(() => {
            expect(removeMovieFromLibrary).toHaveBeenCalledWith(100);
        });

        expect(mockDelete).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledWith('Movie removed from library.', { id: 'toast-id' });
        expect(mockPush).toHaveBeenCalledWith('/library');
    });

    it('stays on page and shows error when online delete fails', async () => {
        const user = userEvent.setup();
        (removeMovieFromLibrary as jest.Mock).mockResolvedValue({ success: false, message: 'DB error' });

        render(<ItemDetail movie={mockMovie} />);

        await user.click(screen.getByRole('button', { name: /Remove/i }));
        await user.click(screen.getByRole('button', { name: /Confirm Delete/i }));

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('DB error', { id: 'toast-id' });
        });

        // Should NOT have navigated away
        expect(mockPush).not.toHaveBeenCalled();
        // Title should still be visible (still on page)
        expect(screen.getByText('Test Movie')).toBeInTheDocument();
    });

    // ============================================================
    // Delete flow — offline
    // ============================================================

    it('handles offline delete functionality via Dexie', async () => {
        Object.defineProperty(navigator, 'onLine', { value: false });
        const user = userEvent.setup();

        render(<ItemDetail movie={mockMovie} />);

        await user.click(screen.getByRole('button', { name: /Remove/i }));
        await user.click(screen.getByRole('button', { name: /Confirm Delete/i }));

        await waitFor(() => {
            expect(mockWhere).toHaveBeenCalledWith('tmdbId');
            expect(mockEquals).toHaveBeenCalledWith(100);
            expect(mockDelete).toHaveBeenCalled();
            expect(mockDbSyncQueueAdd).toHaveBeenCalledWith(expect.objectContaining({ action: 'remove' }));
        });

        expect(toast.success).toHaveBeenCalledWith('Offline: Movie deleted locally. Returning to library.');
        expect(mockPush).toHaveBeenCalledWith('/library');
        expect(removeMovieFromLibrary).not.toHaveBeenCalled();
    });

    // ============================================================
    // Cancel delete dialog
    // ============================================================

    it('dismisses confirmation dialog on Cancel without deleting', async () => {
        const user = userEvent.setup();
        render(<ItemDetail movie={mockMovie} />);

        // Open dialog
        await user.click(screen.getByRole('button', { name: /Remove/i }));
        expect(screen.getByText(/Are you sure you want to remove/i)).toBeInTheDocument();

        // Cancel it
        await user.click(screen.getByRole('button', { name: /^Cancel$/i }));

        // Dialog should be gone
        expect(screen.queryByText(/Are you sure you want to remove/i)).toBeNull();

        // Nothing should have been called
        expect(removeMovieFromLibrary).not.toHaveBeenCalled();
        expect(mockPush).not.toHaveBeenCalled();
    });

    // ============================================================
    // Recommendation mode
    // ============================================================

    describe('recommendation mode', () => {
        it('renders movie details but hides library-specific fields', () => {
            render(<ItemDetail movie={mockMovie} mode="recommendation" />);
            
            // Should render title and details
            expect(screen.getByText('Test Movie')).toBeInTheDocument();
            expect(screen.getByText('John Doe')).toBeInTheDocument();
            
            // Should NOT render Edit/Remove buttons
            expect(screen.queryByRole('button', { name: /Edit/i })).toBeNull();
            expect(screen.queryByRole('button', { name: /Remove/i })).toBeNull();
            
            // Should NOT render "Added to Library" section
            expect(screen.queryByText('Added to Library')).toBeNull();
            
            // Should NOT render quality badges
            expect(screen.queryByText('Blu-ray')).toBeNull();
        });

        it('renders children in the action slot', () => {
            render(
                <ItemDetail movie={mockMovie} mode="recommendation">
                    <button>Custom Action</button>
                </ItemDetail>
            );
            
            // Should render the custom child
            expect(screen.getByRole('button', { name: 'Custom Action' })).toBeInTheDocument();
        });
    });
});
