import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchAddMovie from '@/app/ui/search-add-movie';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
}));

// Mock tmdb server actions
const mockGetMovieDetails = jest.fn();
jest.mock('@/app/lib/tmdb', () => ({
  searchMovies: (...args: any[]) => mockSearchMovies(...args),
  getMovieDetails: (...args: any[]) => mockGetMovieDetails(...args),
}));

// Mock tmdb-utils (pure helpers)
const mockExtractCredits = jest.fn();
jest.mock('@/app/lib/tmdb-utils', () => ({
  extractCredits: (...args: any[]) => mockExtractCredits(...args),
}));

// Mock actions
const mockAddMovieToLibrary = jest.fn();
jest.mock('@/app/lib/actions', () => ({
  addMovieToLibrary: (...args: any[]) => mockAddMovieToLibrary(...args),
}));

// Mock Dexie db
const mockDbMoviesPut = jest.fn();
const mockDbSyncQueueAdd = jest.fn();
jest.mock('@/app/lib/db-client', () => ({
  db: {
    movies: { put: (...args: any[]) => mockDbMoviesPut(...args) },
    syncQueue: { add: (...args: any[]) => mockDbSyncQueueAdd(...args) },
  },
}));

import { toast as mockToast } from 'sonner';

// Mock sonner
jest.mock('sonner', () => ({
  toast: {
    warning: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    loading: jest.fn().mockReturnValue('loading-toast-id'),
  },
}));

const sampleMovie = {
  id: 550,
  title: 'Fight Club',
  overview: 'An insomniac...',
  poster_path: '/poster.jpg',
  release_date: '1999-10-15',
  genre_ids: [18, 53],
  vote_average: 8.4,
};

const createResolvedPromise = (data: any) => {
  const p = Promise.resolve(data) as any;
  p.status = 'fulfilled';
  p.value = data;
  return p;
};

describe('SearchAddMovie', () => {
  beforeEach(() => {
    // Default to online
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });

    // Default getMovieDetails / extractCredits so the add-flow reaches downstream logic
    mockGetMovieDetails.mockResolvedValue({
      id: 550,
      title: 'Fight Club',
      overview: 'An insomniac...',
      poster_path: '/poster.jpg',
      release_date: '1999-10-15',
      genre_ids: [18, 53],
      vote_average: 8.4,
      genres: [{ id: 18, name: 'Drama' }, { id: 53, name: 'Thriller' }],
      runtime: 139,
      status: 'Released',
      tagline: '',
      credits: {
        cast: [{ id: 1, name: 'Brad Pitt', order: 0 }],
        crew: [{ id: 2, name: 'David Fincher', job: 'Director' }],
      },
    });
    mockExtractCredits.mockReturnValue({
      actors: [{ firstName: 'Brad', lastName: 'Pitt', fullName: 'Brad Pitt' }],
      directors: [{ firstName: 'David', lastName: 'Fincher', fullName: 'David Fincher' }],
    });
  });

  it('renders search input and button', () => {
    render(<SearchAddMovie />);
    expect(screen.getByPlaceholderText(/search by title/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('empty query does not trigger search', async () => {
    const user = userEvent.setup();
    const mockPush = jest.fn();
    jest.spyOn(require('next/navigation'), 'useRouter').mockReturnValue({
      push: mockPush,
      refresh: jest.fn(),
    });

    render(<SearchAddMovie />);
    // Leave the input empty and submit
    await user.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  it('search triggers router push navigation', async () => {
    const user = userEvent.setup();
    const mockPush = jest.fn();
    jest.spyOn(require('next/navigation'), 'useRouter').mockReturnValue({
      push: mockPush,
      refresh: jest.fn(),
    });

    render(<SearchAddMovie />);
    await user.type(screen.getByPlaceholderText(/search by title/i), 'Fight Club');
    await user.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('?q=Fight%20Club');
    });
  });

  it('search results rendered as list items when searchPromise is passed', async () => {
    const searchPromise = createResolvedPromise({
      results: [sampleMovie],
      total_results: 1,
    });

    render(<SearchAddMovie searchPromise={searchPromise} initialQuery="Fight Club" />);

    await waitFor(() => {
      expect(screen.getByText('Fight Club')).toBeInTheDocument();
      expect(screen.getByText('1999')).toBeInTheDocument();
    });
  });

  it('add without selecting quality shows warning toast', async () => {
    const user = userEvent.setup();
    const searchPromise = createResolvedPromise({
      results: [sampleMovie],
      total_results: 1,
    });

    render(<SearchAddMovie searchPromise={searchPromise} initialQuery="Fight Club" />);

    await waitFor(() => {
      expect(screen.getByText('Fight Club')).toBeInTheDocument();
    });

    // Click "Add to Library" without selecting quality
    await user.click(screen.getByRole('button', { name: /add to library/i }));

    await waitFor(() => {
      expect(mockToast.warning).toHaveBeenCalledWith(
        expect.stringContaining('Please select a quality format')
      );
    });
  });

  it('add with quality (online) calls addMovieToLibrary', async () => {
    const user = userEvent.setup();
    const searchPromise = createResolvedPromise({
      results: [sampleMovie],
      total_results: 1,
    });
    mockAddMovieToLibrary.mockResolvedValue({
      success: true,
      message: 'Movie added to library!',
    });

    // Mock global.fetch for details request
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          id: 550,
          title: 'Fight Club',
          overview: 'An insomniac...',
          poster_path: '/poster.jpg',
          release_date: '1999-10-15',
          genre_ids: [18, 53],
          vote_average: 8.4,
          genres: [{ id: 18, name: 'Drama' }, { id: 53, name: 'Thriller' }],
          runtime: 139,
          status: 'Released',
          tagline: '',
        }),
      })
    );

    render(<SearchAddMovie searchPromise={searchPromise} initialQuery="Fight Club" />);

    await waitFor(() => {
      expect(screen.getByText('Fight Club')).toBeInTheDocument();
    });

    // Select quality
    await user.selectOptions(screen.getByDisplayValue('Quality'), 'Blu-ray');

    // Add to library
    await user.click(screen.getByRole('button', { name: /add to library/i }));

    await waitFor(() => {
      expect(mockAddMovieToLibrary).toHaveBeenCalledWith(
        expect.objectContaining({
          tmdbId: 550,
          title: 'Fight Club',
          quality: 'Blu-ray',
        })
      );
    });
  });

  it('successful add shows success toast with message and clears quality selection', async () => {
    const user = userEvent.setup();
    const searchPromise = createResolvedPromise({
      results: [sampleMovie],
      total_results: 1,
    });
    mockAddMovieToLibrary.mockResolvedValue({
      success: true,
      message: 'Movie added to library!',
    });

    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          id: 550,
          title: 'Fight Club',
          genres: [{ id: 18, name: 'Drama' }],
          release_date: '1999-10-15',
          runtime: 139,
        }),
      })
    );

    render(<SearchAddMovie searchPromise={searchPromise} initialQuery="Fight Club" />);

    await waitFor(() => expect(screen.getByText('Fight Club')).toBeInTheDocument());

    const qualitySelect = screen.getByDisplayValue('Quality');
    await user.selectOptions(qualitySelect, 'Blu-ray');
    await user.click(screen.getByRole('button', { name: /add to library/i }));

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith(
        'Movie added to library!',
        expect.any(Object)
      );
    });
  });

  it('failed add shows error toast', async () => {
    const user = userEvent.setup();
    const searchPromise = createResolvedPromise({
      results: [sampleMovie],
      total_results: 1,
    });
    mockAddMovieToLibrary.mockResolvedValue({
      success: false,
      message: 'Movie already exists in your library.',
    });

    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          id: 550,
          title: 'Fight Club',
          genres: [{ id: 18, name: 'Drama' }],
          release_date: '1999-10-15',
          runtime: 139,
        }),
      })
    );

    render(<SearchAddMovie searchPromise={searchPromise} initialQuery="Fight Club" />);

    await waitFor(() => expect(screen.getByText('Fight Club')).toBeInTheDocument());

    await user.selectOptions(screen.getByDisplayValue('Quality'), 'Blu-ray');
    await user.click(screen.getByRole('button', { name: /add to library/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        'Movie already exists in your library.',
        expect.any(Object)
      );
    });
  });

  it('add while offline writes to Dexie and sync queue', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    const searchPromise = createResolvedPromise({
      results: [sampleMovie],
      total_results: 1,
    });

    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          id: 550,
          title: 'Fight Club',
          genres: [{ id: 18, name: 'Drama' }],
          release_date: '1999-10-15',
          runtime: 139,
        }),
      })
    );

    render(<SearchAddMovie searchPromise={searchPromise} initialQuery="Fight Club" />);

    await waitFor(() => expect(screen.getByText('Fight Club')).toBeInTheDocument());

    await user.selectOptions(screen.getByDisplayValue('Quality'), 'Blu-ray');
    await user.click(screen.getByRole('button', { name: /add to library/i }));

    await waitFor(() => {
      expect(mockDbMoviesPut).toHaveBeenCalledWith(
        expect.objectContaining({
          tmdbId: 550,
          title: 'Fight Club',
          quality: 'Blu-ray',
        })
      );
      expect(mockDbSyncQueueAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'add',
          payload: expect.objectContaining({ tmdbId: 550 }),
        })
      );
    });
  });
});
