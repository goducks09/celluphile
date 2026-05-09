import Link from 'next/link';
import Image from 'next/image';
import { getRecommendations } from '@/app/lib/actions';
import { auth } from '@/auth';

export default async function RecommendationsPage() {
    const session = await auth();
    if (!session?.user?.id) {
        return <div className="text-center p-8 mt-4 rounded shadow" style={{ background: 'var(--background-card)', color: 'var(--foreground-muted)' }}>Please log in to view recommendations.</div>;
    }

    const { success, movies, message } = await getRecommendations();

    if (!success) {
        return (
            <div className="w-full max-w-4xl mx-auto my-8 p-8 rounded-lg shadow text-center" style={{ background: 'var(--background-card)' }}>
                <h3 className="text-xl font-medium text-red-400">Unable to load recommendations</h3>
                <p className="mt-2" style={{ color: 'var(--foreground-muted)' }}>
                    {message || 'Something went wrong. Please try again later.'}
                </p>
                <Link href="/dashboard" className="inline-block mt-4 text-indigo-400 hover:text-indigo-300">
                    ← Back to Dashboard
                </Link>
            </div>
        );
    }

    if (!movies || movies.length === 0) {
        return (
            <div className="w-full max-w-4xl mx-auto my-12 p-12 rounded-lg shadow-sm flex flex-col items-center text-center" style={{ background: 'var(--background-card)', border: '1px solid var(--border)' }}>
                <div className="bg-indigo-900/30 p-4 rounded-full mb-6">
                    <span className="text-indigo-400 text-4xl">✨</span>
                </div>
                <h3 className="text-2xl font-medium mb-2" style={{ color: 'var(--foreground)' }}>Not enough data yet</h3>
                <p className="max-w-md mx-auto mb-8" style={{ color: 'var(--foreground-muted)' }}>
                    We need a few movies in your library to start recommending new ones. Add some of your favorites and check back here!
                </p>
                <Link
                    href="/dashboard/library"
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                    Go to Library
                </Link>
            </div>
        );
    }

    return (
        <div className="w-full max-w-6xl mx-auto my-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 px-4 gap-4">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">✨</span>
                    <div>
                        <h2 className="text-2xl font-bold">Recommended for You</h2>
                        <p className="text-sm mt-1" style={{ color: 'var(--foreground-muted)' }}>
                            Based on your library tastes, powered by AI similarity search.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 px-4">
                {movies.map((movie) => (
                    <div key={movie.tmdbId} className="flex flex-col rounded-lg shadow overflow-hidden transition-transform hover:scale-105" style={{ background: 'var(--background-card)' }}>
                        {movie.poster ? (
                            <div className="relative w-full h-80 group">
                                <Image
                                    src={`https://image.tmdb.org/t/p/w500${movie.poster}`}
                                    alt={`${movie.title} poster`}
                                    fill
                                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
                                    className="object-cover"
                                />
                            </div>
                        ) : (
                            <div className="w-full h-80 flex items-center justify-center" style={{ background: 'var(--background-input)', color: 'var(--foreground-muted)' }}>
                                No Poster Available
                            </div>
                        )}
                        <div className="p-4 flex-1 flex flex-col justify-between">
                            <div>
                                <h3 className="font-bold text-lg leading-tight mb-1">{movie.title}</h3>
                                <p className="text-sm mb-1 font-medium" style={{ color: 'var(--foreground-muted)' }}>
                                    {movie.releaseDate ? movie.releaseDate.split('-')[0] : ''}
                                    {movie.releaseDate && movie.runtime ? ' • ' : ''}
                                    {movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : ''}
                                </p>
                                {movie.genres && movie.genres.length > 0 && (
                                    <p className="text-xs mb-2 font-medium text-indigo-400">
                                        {movie.genres.join(', ')}
                                    </p>
                                )}
                                {movie.overview && (
                                    <p className="text-xs line-clamp-4 mt-2" style={{ color: 'var(--foreground-muted)' }}>
                                        {movie.overview}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
