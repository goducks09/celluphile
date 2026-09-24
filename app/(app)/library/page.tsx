import { Suspense } from 'react';
import SearchAddMovie from '@/app/ui/search-add-movie';
import LibraryList from '@/app/ui/library-list';
import { getUserMovieAndWishlistIds } from '@/app/lib/data';
import { searchMovies } from '@/app/lib/tmdb';
import { MoviesSkeleton } from '@/app/ui/movies-skeleton';

export const instant = {
    unstable_samples: [{ searchParams: { q: null } }],
};

async function LibraryContent({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
    const params = await searchParams;
    const q = params?.q || '';
    const searchPromise = q ? searchMovies(q) : null;
    const { libraryIds = [], wishlistIds = [] } = await getUserMovieAndWishlistIds();

    return (
        <>
            <SearchAddMovie
                initialLibraryIds={libraryIds}
                initialWishlistIds={wishlistIds}
                searchPromise={searchPromise}
                initialQuery={q}
            />
            <LibraryList />
        </>
    );
}

export default function LibraryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
    return (
        <Suspense fallback={
            <div className="w-full max-w-6xl mx-auto py-8 px-4">
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    {/* Search Bar Skeleton */}
                    <div className="flex-1 h-10 rounded animate-pulse" style={{ background: 'var(--background-input)' }} />
                    {/* Filter Dropdown Skeleton */}
                    <div className="w-full md:w-48 h-10 rounded animate-pulse" style={{ background: 'var(--background-input)' }} />
                </div>
                {/* Grid Skeleton */}
                <MoviesSkeleton count={20} />
            </div>
        }>
            <LibraryContent searchParams={searchParams} />
        </Suspense>
    );
}
