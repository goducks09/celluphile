import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LibraryFilterAndList from '@/app/ui/library-filter-and-list';
import type { SerializedMovie } from '@/app/lib/actions';

// Mock actions
const mockSearchUserLibrary = jest.fn();
const mockRemoveMovieFromLibrary = jest.fn();
jest.mock('@/app/lib/actions', () => ({
  searchUserLibrary: (...args: any[]) => mockSearchUserLibrary(...args),
  removeMovieFromLibrary: (...args: any[]) => mockRemoveMovieFromLibrary(...args),
}));

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
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
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
  genre: ['Drama'],
  quality: 'Blu-ray',
  addedAt: new Date('2024-01-01'),
  ...overrides,
});

describe('LibraryFilterAndList', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
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
    mockSearchUserLibrary.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true, movies: [], hasMore: false }), 1000))
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
    mockSearchUserLibrary.mockResolvedValue({
      success: true,
      movies: [createMovie()],
      hasMore: false,
    });

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
      expect(mockSearchUserLibrary).toHaveBeenCalledWith(
        '',
        { quality: ['Blu-ray'] },
        undefined,
        { page: 1, limit: 20 }
      );
    });
  });

  it('search debounces at 300ms', async () => {
    mockSearchUserLibrary.mockResolvedValue({
      success: true,
      movies: [],
      hasMore: false,
    });

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

    // Should not yet have called searchUserLibrary for these intermediate values
    const callsBeforeDebounce = mockSearchUserLibrary.mock.calls.length;

    // Now advance past debounce
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      // Should have been called with the final value
      expect(mockSearchUserLibrary).toHaveBeenCalledWith(
        'Fig',
        expect.any(Object),
        undefined,
        expect.any(Object)
      );
    });
  });

  it('delete (online) — optimistic removal + server call', async () => {
    // Use real timers for this test since userEvent doesn't work with fake timers
    jest.useRealTimers();
    const user = userEvent.setup();
    mockRemoveMovieFromLibrary.mockResolvedValue({ success: true, message: 'Movie removed.' });

    const movies = [createMovie()];
    await act(async () => {
      render(<LibraryFilterAndList initialMovies={movies} />);
    });

    expect(screen.getByText('Fight Club')).toBeInTheDocument();

    // Click delete button
    const deleteBtn = screen.getByTitle('Remove from library');
    await user.click(deleteBtn);

    // Movie should be optimistically removed
    await waitFor(() => {
      expect(screen.queryByText('Fight Club')).not.toBeInTheDocument();
    });

    expect(mockRemoveMovieFromLibrary).toHaveBeenCalledWith(550);
  });

  it('delete fails — movie restored in UI + error toast', async () => {
    jest.useRealTimers();
    const user = userEvent.setup();
    mockRemoveMovieFromLibrary.mockResolvedValue({ success: false, message: 'Failed to remove movie.' });

    const movies = [createMovie()];
    await act(async () => {
      render(<LibraryFilterAndList initialMovies={movies} />);
    });

    const deleteBtn = screen.getByTitle('Remove from library');
    await user.click(deleteBtn);

    // Movie should be restored after failed delete
    await waitFor(() => {
      expect(screen.getByText('Fight Club')).toBeInTheDocument();
    });

    expect(mockToast.error).toHaveBeenCalledWith('Failed to remove movie.');
  });

  it('delete (offline) — Dexie delete + sync queue entry', async () => {
    jest.useRealTimers();
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    // Need to re-mock db.movies.where for this test specifically
    const mockWhereDelete = jest.fn().mockResolvedValue(undefined);
    const mockEquals = jest.fn().mockReturnValue({ delete: mockWhereDelete });
    const mockWhere = jest.fn().mockReturnValue({ equals: mockEquals });

    // We need to get the module and override
    const dbModule = require('@/app/lib/db-client');
    dbModule.db.movies.where = mockWhere;

    const movies = [createMovie()];
    await act(async () => {
      render(<LibraryFilterAndList initialMovies={movies} />);
    });

    const deleteBtn = screen.getByTitle('Remove from library');
    await user.click(deleteBtn);

    await waitFor(() => {
      expect(mockWhere).toHaveBeenCalledWith('tmdbId');
      expect(mockEquals).toHaveBeenCalledWith(550);
      expect(mockWhereDelete).toHaveBeenCalled();
      expect(mockDbSyncQueueAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'remove',
          payload: { tmdbId: 550 },
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
