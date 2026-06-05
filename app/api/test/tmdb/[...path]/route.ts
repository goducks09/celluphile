import { NextRequest, NextResponse } from 'next/server';

/**
 * Mock TMDB API route — only active in test mode.
 * Serves fixture-equivalent data so both client-side AND server-side
 * TMDB calls are mocked when TMDB_API_BASE_URL points here.
 */

const MOCK_MOVIES = [
    {
        id: 27205,
        title: 'Inception',
        overview: 'Cobb, a skilled thief...',
        poster_path: '/9gk7adZA282A81YvJeeJKx8.jpg',
        release_date: '2010-07-15',
        genre_ids: [28, 878, 12],
        vote_average: 8.4,
    },
    {
        id: 550,
        title: 'Fight Club',
        overview: 'A ticking-time-bomb insomniac...',
        poster_path: '/pB8BM2eb9.jpg',
        release_date: '1999-10-15',
        genre_ids: [18],
        vote_average: 8.4,
    },
    {
        id: 603,
        title: 'The Matrix',
        overview: 'Set in the 22nd century...',
        poster_path: '/f89U3ADilZD.jpg',
        release_date: '1999-03-30',
        genre_ids: [28, 878],
        vote_average: 8.2,
    },
    {
        id: 578,
        title: 'Jaws',
        overview: 'When an insatiable great white shark...',
        poster_path: '/s2xcqSFfT6.jpg',
        release_date: '1975-06-20',
        genre_ids: [27, 53, 12],
        vote_average: 7.7,
    },
];

const MOCK_DETAILS: Record<number, object> = {
    27205: {
        id: 27205,
        title: 'Inception',
        overview: 'Cobb, a skilled thief...',
        poster_path: '/9gk7adZA282A81YvJeeJKx8.jpg',
        release_date: '2010-07-15',
        genres: [
            { id: 28, name: 'Action' },
            { id: 878, name: 'Science Fiction' },
            { id: 12, name: 'Adventure' },
        ],
        genre_ids: [28, 878, 12],
        runtime: 148,
        status: 'Released',
        tagline: 'Your mind is the scene of the crime.',
        vote_average: 8.4,
        credits: { cast: [{ id: 1, name: 'Leonardo DiCaprio', fullName: 'Leonardo DiCaprio', order: 0 }], crew: [{ id: 2, name: 'Christopher Nolan', fullName: 'Christopher Nolan', job: 'Director' }] }
    },
    550: {
        id: 550,
        title: 'Fight Club',
        overview: 'A ticking-time-bomb insomniac...',
        poster_path: '/pB8BM2eb9.jpg',
        release_date: '1999-10-15',
        genres: [{ id: 18, name: 'Drama' }],
        genre_ids: [18],
        runtime: 139,
        status: 'Released',
        tagline: 'Mischief. Mayhem. Soap.',
        vote_average: 8.4,
        credits: { cast: [{ id: 3, name: 'Brad Pitt', fullName: 'Brad Pitt', order: 0 }], crew: [{ id: 4, name: 'David Fincher', fullName: 'David Fincher', job: 'Director' }] }
    },
    603: {
        id: 603,
        title: 'The Matrix',
        overview: 'Set in the 22nd century...',
        poster_path: '/f89U3ADilZD.jpg',
        release_date: '1999-03-30',
        genres: [
            { id: 28, name: 'Action' },
            { id: 878, name: 'Science Fiction' },
        ],
        genre_ids: [28, 878],
        runtime: 136,
        status: 'Released',
        tagline: 'Welcome to the Real World.',
        vote_average: 8.2,
        credits: { cast: [{ id: 5, name: 'Keanu Reeves', fullName: 'Keanu Reeves', order: 0 }], crew: [{ id: 6, name: 'Lana Wachowski', fullName: 'Lana Wachowski', job: 'Director' }] }
    },
    578: {
        id: 578,
        title: 'Jaws',
        overview: 'When an insatiable great white shark...',
        poster_path: '/s2xcqSFfT6.jpg',
        release_date: '1975-06-20',
        genres: [
            { id: 27, name: 'Horror' },
            { id: 53, name: 'Thriller' },
            { id: 12, name: 'Adventure' },
        ],
        genre_ids: [27, 53, 12],
        runtime: 124,
        status: 'Released',
        tagline: "Don't go in the water.",
        vote_average: 7.7,
        credits: { cast: [{ id: 7, name: 'Roy Scheider', fullName: 'Roy Scheider', order: 0 }], crew: [{ id: 8, name: 'Steven Spielberg', fullName: 'Steven Spielberg', job: 'Director' }] }
    },
};

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    if (process.env.TEST_MODE !== 'true') {
        return NextResponse.json(
            { error: 'This route is only available in the test environment.' },
            { status: 403 }
        );
    }

    const { path } = await params;
    const joinedPath = path.join('/');

    // Handle /search/movie?query=...
    if (joinedPath === 'search/movie') {
        const query = request.nextUrl.searchParams.get('query')?.toLowerCase() || '';
        const filtered = query
            ? MOCK_MOVIES.filter((m) => m.title.toLowerCase().includes(query))
            : MOCK_MOVIES;

        return NextResponse.json({
            page: 1,
            results: filtered,
            total_pages: 1,
            total_results: filtered.length,
        });
    }

    // Handle /movie/:id
    const movieMatch = joinedPath.match(/^movie\/(\d+)$/);
    if (movieMatch) {
        const movieId = parseInt(movieMatch[1], 10);
        const details = MOCK_DETAILS[movieId];
        if (details) {
            return NextResponse.json(details);
        }
        return NextResponse.json({ status_message: 'Movie not found.' }, { status: 404 });
    }

    // Fallback for any other TMDB path
    return NextResponse.json({});
}
