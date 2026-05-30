import Link from 'next/link';
import { getRandomMovie } from '@/app/lib/data';
import RandomMovieClient from '@/app/ui/random-movie';

export default async function RandomPage() {
    const response = await getRandomMovie();

    if (!response.success || !response.movie) {
        return (
            <div className="stub-page">
                <div className="stub-card">
                    <span className="stub-icon">🎬</span>
                    <h2 className="stub-title">{response.message || 'Error'}</h2>
                    <p className="stub-description">
                        It looks like there are no movies available to pick from.
                    </p>
                    <Link href="/dashboard" className="stub-back-link">
                        ← Back to Dashboard
                    </Link>
                    <Link href="/library" className="stub-back-link">
                        ← Go to Library
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-2xl mx-auto py-4 md:py-6 px-4 flex flex-col items-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 text-center flex items-center justify-center gap-3">
                <span className="text-3xl md:text-4xl">🎲</span> Random Movie
            </h2>
            <RandomMovieClient initialMovie={response.movie} />
        </div>
    );
}
