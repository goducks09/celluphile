import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LibraryFilterAndList from '@/app/ui/library-filter-and-list';
import type { SerializedMovie } from '@/app/lib/data';


// Mock Dexie db
const mockDbMoviesDelete = jest.fn().mockReturnValue({ delete: jest.fn().mockResolvedValue(undefined) });
const mockDbSyncQueueAdd = jest.fn();
const mockDbSyncQueueCount = jest.fn().mockResolvedValue(0);
const mockDbMoviesClear = jest.fn();
const mockDbMoviesBulkAdd = jest.fn();
const mockDbTransaction = jest.fn().mockImplementation(async (_mode: string, _table: any, fn: () => Promise<void>) => fn());

jest.mock('@/app/lib/db-client', () => ({
  db: {
    movies: {
      where: jest.fn().mockReturnValue({
        equals: jest.fn().mockReturnValue({
          delete: jest.fn().mockResolvedValue(undefined),
        }),
      }),
      clear: (...args: any[]) => mockDbMoviesClear(...args),
      bulkAdd: (...args: any[]) => mockDbMoviesBulkAdd(...args),
      orderBy: jest.fn().mockReturnValue({
        reverse: jest.fn().mockReturnValue({
          filter: jest.fn().mockReturnValue({
            toArray: jest.fn().mockResolvedValue([]),
            filter: jest.fn().mockReturnValue({
              toArray: jest.fn().mockResolvedValue([]),
            }),
          }),
          toArray: jest.fn().mockResolvedValue([]),
        }),
      }),
    },
    syncQueue: {
      add: (...args: any[]) => mockDbSyncQueueAdd(...args),
      count: () => mockDbSyncQueueCount(),
    },
    transaction: (...args: any[]) => mockDbTransaction(...args),
  },
}));

import { toast as mockToast } from 'sonner';

// Mock sonner
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, fill, sizes, ...props }: any) => {
    // fill and sizes are Next.js-specific — drop them so they
    // don't get forwarded to the native <img> element
    return <img src={src} alt={alt} {...props} />;
  },
}));

// Mock IntersectionObserver
const mockObserve = jest.fn();
const mockDisconnect = jest.fn();
beforeAll(() => {
  global.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: mockObserve,
    disconnect: mockDisconnect,
    unobserve: jest.fn(),
  }));
});

const createMovie = (overrides: Partial<SerializedMovie> = {}): SerializedMovie => ({
  _id: '1',
  userId: 'user1',
  tmdbId: 550,
  title: 'Fight Club',
  poster: '/poster.jpg',
  genres: ['Drama'],
  quality: 'Blu-ray',
  addedAt: new Date('2024-01-01'),
  actors: [],
  directors: [],
  ...overrides,
} as SerializedMovie);

describe('LibraryFilterAndList', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        json: async () => ({
          success: true,
          movies: [createMovie()],
          hasMore: false,
        }),
      })
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders initial movies passed via props', async () => {
    const movies = [createMovie(), createMovie({ tmdbId: 551, title: 'Inception', _id: '2' })];

    await act(async () => {
      render(<LibraryFilterAndList initialMovies={movies} />);
    });

    expect(screen.getByText('Fight Club')).toBeInTheDocument();
    expect(screen.getByText('Inception')).toBeInTheDocument();
  });
  it('shows skeleton loader while filtering', async () => {
    global.fetch = jest.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({
        json: async () => ({ success: true, movies: [], hasMore: false }),
      }), 1000))
    );

    await act(async () => {
      render(<LibraryFilterAndList initialMovies={[createMovie()]} />);
    });

    // Trigger a filter change using fireEvent since userEvent doesn't work with fake timers
    const qualitySelect = screen.getByDisplayValue('All Qualities');
    await act(async () => {
      fireEvent.change(qualitySelect, { target: { value: 'Blu-ray' } });
    });

    // Advance past the debounce
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    // During loading, the MoviesSkeleton component should be rendered with ARIA roles
    const skeletons = screen.getAllByRole('status', { name: 'Loading' });
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('filter by quality calls searchUserLibrary with quality filter', async () => {
    await act(async () => {
      render(<LibraryFilterAndList initialMovies={[createMovie()]} />);
    });

    const qualitySelect = screen.getByDisplayValue('All Qualities');
    await act(async () => {
      fireEvent.change(qualitySelect, { target: { value: 'Blu-ray' } });
    });

    // Advance past debounce
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/library/search',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            query: '',
            filters: { quality: ['Blu-ray'] },
            pagination: { page: 1, limit: 20 },
          }),
        })
      );
    });
  });

  it('search debounces at 300ms', async () => {
    await act(async () => {
      render(<LibraryFilterAndList initialMovies={[createMovie()]} />);
    });

    const searchInput = screen.getByPlaceholderText(/search your library/i);

    // Type rapidly
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'F' } });
    });
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'Fi' } });
    });
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'Fig' } });
    });

    // Should not yet have called search api for these intermediate values
    const callsBeforeDebounce = (global.fetch as jest.Mock).mock.calls.length;
    expect(callsBeforeDebounce).toBe(0);

    // Now advance past debounce
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      // Should have been called with the final value
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/library/search',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            query: 'Fig',
            filters: {},
            pagination: { page: 1, limit: 20 },
          }),
        })
      );
    });
  });

  it('empty results shows "No movies found" message', async () => {
    await act(async () => {
      render(<LibraryFilterAndList initialMovies={[]} />);
    });

    expect(screen.getByText('No movies found')).toBeInTheDocument();
  });

  it('movies without poster shows "No Poster Available" placeholder', async () => {
    const movieWithoutPoster = createMovie({ poster: '' });

    await act(async () => {
      render(<LibraryFilterAndList initialMovies={[movieWithoutPoster]} />);
    });

    expect(screen.getByText('No Poster Available')).toBeInTheDocument();
  });
});
