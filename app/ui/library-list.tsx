import { auth } from '@/auth';
import LibraryFilterAndList from './library-filter-and-list';
import { searchUserLibrary } from '@/app/lib/actions';
import { FilmIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

export default async function LibraryList() {
    const session = await auth();

    if (!session?.user?.id) {
        return <div className="text-center p-8 mt-4 rounded shadow" style={{ background: 'var(--background-card)', color: 'var(--foreground-muted)' }}>Please log in to view your library.</div>;
    }

    // Fetch initial movies (sorted by newest, max 20) via server action logic directly
    const result = await searchUserLibrary('', undefined, undefined, { page: 1, limit: 20 });

    if (!result.success) {
        return (
            <div className="w-full max-w-4xl mx-auto my-8 p-8 rounded-lg shadow text-center" style={{ background: 'var(--background-card)' }}>
                <h3 className="text-xl font-medium text-red-400">Unable to load library</h3>
                <p className="mt-2" style={{ color: 'var(--foreground-muted)' }}>
                    {result.message || 'Something went wrong while connecting to the database. Please try again later.'}
                </p>
            </div>
        );
    }

    if (!result.movies || result.movies.length === 0) {
        return (
            <div className="w-full max-w-4xl mx-auto my-12 p-12 rounded-lg shadow-sm flex flex-col items-center text-center" style={{ background: 'var(--background-card)', border: '1px solid var(--border)' }}>
                <div className="bg-indigo-900/30 p-4 rounded-full mb-6">
                    <FilmIcon className="w-12 h-12 text-indigo-400" />
                </div>
                <h3 className="text-2xl font-medium mb-2" style={{ color: 'var(--foreground)' }}>Your library is empty</h3>
                <p className="max-w-md mx-auto mb-8" style={{ color: 'var(--foreground-muted)' }}>
                    You haven&apos;t added any movies to your collection yet. Start building your personal cinematic universe by searching for your favorites!
                </p>
                <Link
                    href="/dashboard"
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                    Add Your First Movie
                </Link>
            </div>
        );
    }

    // Pass the initial server-fetched dataset into the Client Component for interactivity
    return <LibraryFilterAndList initialMovies={result.movies} initialHasMore={result.hasMore} />;
}
