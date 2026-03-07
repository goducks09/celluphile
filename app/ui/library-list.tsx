import { auth } from '@/auth';
import LibraryFilterAndList from './library-filter-and-list';
import { searchUserLibrary } from '@/app/lib/actions';

export default async function LibraryList() {
    const session = await auth();

    if (!session?.user?.id) {
        return <div className="text-center p-8 mt-4 bg-white rounded shadow text-gray-600">Please log in to view your library.</div>;
    }

    // Fetch initial movies (sorted by newest, max 20) via server action logic directly
    const result = await searchUserLibrary('', undefined, undefined, { page: 1, limit: 20 });

    if (!result.success) {
        return (
            <div className="w-full max-w-4xl mx-auto my-8 p-8 bg-white rounded-lg shadow text-center">
                <h3 className="text-xl font-medium text-red-700">Unable to load library</h3>
                <p className="text-gray-600 mt-2">
                    {result.message || 'Something went wrong while connecting to the database. Please try again later.'}
                </p>
            </div>
        );
    }

    if (!result.movies || result.movies.length === 0) {
        return (
            <div className="w-full max-w-4xl mx-auto my-8 p-8 bg-white rounded-lg shadow text-center">
                <h3 className="text-xl font-medium text-gray-700">Your library is empty</h3>
                <p className="text-gray-500 mt-2">Search for movies above to add them to your collection.</p>
            </div>
        );
    }

    // Pass the initial server-fetched dataset into the Client Component for interactivity
    return <LibraryFilterAndList initialMovies={result.movies} initialHasMore={result.hasMore} />;
}
