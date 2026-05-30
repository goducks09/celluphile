import { MoviesSkeleton } from '@/app/ui/movies-skeleton';

export default function Loading() {
    return (
        <div className="pt-8">
            <h2 className="home-section-title mb-4 animate-pulse">Loading Recommendations...</h2>
            <MoviesSkeleton count={4} />
        </div>
    );
}
