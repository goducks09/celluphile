import { MoviesSkeleton } from '@/app/ui/movies-skeleton';

export default function Loading() {
    return (
        <div className="pt-8">
            <h2 className="home-section-title mb-4 animate-pulse">Loading...</h2>
            <MoviesSkeleton count={1} />
        </div>
    );
}
