import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RandomMovieClient from '@/app/ui/random-movie';
import { getRandomMovie } from '@/app/lib/actions';
import { db } from '@/app/lib/db-client';
import { toast } from 'sonner';

jest.mock('@/app/lib/actions', () => ({
    getRandomMovie: jest.fn(),
}));

jest.mock('@/app/lib/db-client', () => ({
    db: {
        movies: {
            toArray: jest.fn(),
        },
    },
}));

jest.mock('sonner', () => ({
    toast: {
        error: jest.fn(),
    },
}));

// Mock next/image
jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: any) => {
        // eslint-disable-next-line @next/next/no-img-element
        return <img {...props} alt={props.alt} />
    },
}));

const mockMovie = {
    _id: '1',
    userId: '123',
    tmdbId: 100,
    title: 'Initial Random Movie',
    quality: '4K',
    addedAt: new Date().toISOString(),
    poster: '/poster1.jpg',
    actors: [],
    directors: [],
    genre: [],
    releaseDate: '2020-01-01',
    runtime: 120,
};

const mockMovie2 = {
    _id: '2',
    userId: '123',
    tmdbId: 200,
    title: 'Second Random Movie',
    quality: '1080p',
    addedAt: new Date().toISOString(),
    poster: '/poster2.jpg',
    actors: [],
    directors: [],
    genre: [],
    releaseDate: '2021-01-01',
    runtime: 90,
};

describe('RandomMovieClient', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    });

    it('renders initial movie title, year, and quality badge', () => {
        render(<RandomMovieClient initialMovie={mockMovie} />);
        expect(screen.getByText('Initial Random Movie')).toBeInTheDocument();
        expect(screen.getByText('2020')).toBeInTheDocument();
        expect(screen.getByText('4K')).toBeInTheDocument();
        expect(screen.getByText('2h 0m')).toBeInTheDocument();
    });

    it('movie poster renders with correct src', () => {
        render(<RandomMovieClient initialMovie={mockMovie} />);
        const images = screen.getAllByRole('img');
        expect(images[0]).toHaveAttribute('src', expect.stringContaining('/poster1.jpg'));
    });

    it('movie card links to /dashboard/library/{tmdbId}', () => {
        render(<RandomMovieClient initialMovie={mockMovie} />);
        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', '/dashboard/library/100');
    });

    it('Pick Another button calls getRandomMovie and updates the displayed movie', async () => {
        (getRandomMovie as jest.Mock).mockResolvedValue({ success: true, movie: mockMovie2 });
        
        render(<RandomMovieClient initialMovie={mockMovie} />);
        
        const button = screen.getByRole('button', { name: /Pick Another/i });
        fireEvent.click(button);
        
        await waitFor(() => {
            expect(getRandomMovie).toHaveBeenCalledTimes(1);
        });
        
        expect(screen.getByText('Second Random Movie')).toBeInTheDocument();
    });

    it('Pick Another button is disabled while loading', async () => {
        let resolvePromise: any;
        (getRandomMovie as jest.Mock).mockReturnValue(new Promise(resolve => {
            resolvePromise = resolve;
        }));
        
        render(<RandomMovieClient initialMovie={mockMovie} />);
        
        const button = screen.getByRole('button', { name: /Pick Another/i });
        fireEvent.click(button);
        
        expect(screen.getByRole('button')).toBeDisabled();
        expect(screen.getByText(/Picking.../i)).toBeInTheDocument();
        
        resolvePromise({ success: true, movie: mockMovie2 });
        
        await waitFor(() => {
            expect(screen.getByText('Second Random Movie')).toBeInTheDocument();
            expect(screen.getByRole('button')).not.toBeDisabled();
        });
    });

    it('getRandomMovie fails -> shows error toast, keeps existing movie displayed', async () => {
        (getRandomMovie as jest.Mock).mockResolvedValue({ success: false, message: 'Server error' });
        
        render(<RandomMovieClient initialMovie={mockMovie} />);
        
        const button = screen.getByRole('button', { name: /Pick Another/i });
        fireEvent.click(button);
        
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Server error');
        });
        
        expect(screen.getByText('Initial Random Movie')).toBeInTheDocument();
    });

    it('Offline: Pick Another draws from Dexie cache and updates displayed movie', async () => {
        Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
        (db.movies.toArray as jest.Mock).mockResolvedValue([mockMovie2]);
        
        render(<RandomMovieClient initialMovie={mockMovie} />);
        
        const button = screen.getByRole('button', { name: /Pick Another/i });
        fireEvent.click(button);
        
        await waitFor(() => {
            expect(db.movies.toArray).toHaveBeenCalledTimes(1);
        });
        
        expect(screen.getByText('Second Random Movie')).toBeInTheDocument();
        expect(getRandomMovie).not.toHaveBeenCalled();
    });

    it('Offline with empty Dexie cache -> shows "No movies offline." toast', async () => {
        Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
        (db.movies.toArray as jest.Mock).mockResolvedValue([]);
        
        render(<RandomMovieClient initialMovie={mockMovie} />);
        
        const button = screen.getByRole('button', { name: /Pick Another/i });
        fireEvent.click(button);
        
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('No movies offline.');
        });
        
        expect(screen.getByText('Initial Random Movie')).toBeInTheDocument();
    });
});
