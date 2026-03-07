import { MoviesSkeleton } from '@/app/ui/movies-skeleton';

export default function Loading() {
    return (
        <div className="w-full max-w-6xl mx-auto py-8 px-4">
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                {/* Search Bar Skeleton */}
                <div className="flex-1 h-10 bg-gray-200 rounded animate-pulse"></div>
                {/* Filter Dropdown Skeleton */}
                <div className="w-full md:w-48 h-10 bg-gray-200 rounded animate-pulse"></div>
            </div>
            {/* Grid Skeleton */}
            <MoviesSkeleton count={20} />
        </div>
    );
}
