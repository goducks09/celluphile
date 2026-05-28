'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getRandomMovie, type SerializedMovie } from '@/app/lib/actions';
import { db } from '@/app/lib/db-client';
import { toast } from 'sonner';

export default function RandomMovieClient({ initialMovie }: { initialMovie: SerializedMovie }) {
    const [movie, setMovie] = useState<SerializedMovie>(initialMovie);
    const [loading, setLoading] = useState(false);

    const handlePickAnother = async () => {
        if (loading) return;
        setLoading(true);

        try {
            if (!navigator.onLine) {
                // Offline fallback using Dexie
                const dexieMovies = await db.movies.toArray();
                if (dexieMovies.length === 0) {
                    toast.error('No movies offline.');
                    setLoading(false);
                    return;
                }
                const randomIdx = Math.floor(Math.random() * dexieMovies.length);
                const randomDexieMovie = dexieMovies[randomIdx];
                setMovie({
                    ...randomDexieMovie,
                    _id: '', // Not strictly needed for UI presentation
                    userId: '',
                    addedAt: typeof randomDexieMovie.addedAt === 'string' ? randomDexieMovie.addedAt : (randomDexieMovie.addedAt instanceof Date ? randomDexieMovie.addedAt.toISOString() : new Date(randomDexieMovie.addedAt).toISOString()),
                    overview: randomDexieMovie.overview || '',
                    keywords: randomDexieMovie.keywords || [],
                } as SerializedMovie);
                setLoading(false);
                return;
            }

            // Online fetching
            const res = await getRandomMovie();
            if (res.success && res.movie) {
                setMovie(res.movie);
            } else if (res.message) {
                toast.error(res.message);
            }
        } catch (error) {
            console.error('Failed to pick a random movie:', error);
            toast.error('Failed to pick another movie.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full flex flex-col items-center gap-6">
            <Link href={`/dashboard/library/${movie.tmdbId}`} className={`block w-full transition-opacity ${loading ? 'opacity-50' : 'opacity-100'} hover:scale-105 transition-transform duration-300`}>
                <div className="flex flex-col rounded-xl shadow-2xl overflow-hidden border border-[var(--border)]" style={{ background: 'var(--background-card)' }}>
                    {movie.poster ? (
                        <div className="relative w-full aspect-[2/3] bg-zinc-900">
                            <Image
                                src={`https://image.tmdb.org/t/p/w500${movie.poster}`}
                                alt={`${movie.title} poster`}
                                fill
                                sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
                                className="object-cover"
                            />
                            <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 rounded text-sm text-white font-medium border border-white/20 backdrop-blur-sm">
                                {movie.quality}
                            </div>
                        </div>
                    ) : (
                        <div className="w-full aspect-[2/3] flex items-center justify-center relative" style={{ background: 'var(--background-input)', color: 'var(--foreground-muted)' }}>
                            No Poster Available
                            <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 rounded text-sm text-white font-medium border border-white/20 backdrop-blur-sm">
                                {movie.quality}
                            </div>
                        </div>
                    )}
                    <div className="p-5 flex-1 flex flex-col justify-between" style={{ color: 'var(--foreground)' }}>
                        <div>
                            <h3 className="font-extrabold text-xl leading-tight mb-2 tracking-tight">{movie.title}</h3>
                            <div className="flex flex-wrap items-center gap-2 text-sm mb-3 font-semibold" style={{ color: 'var(--foreground-muted)' }}>
                                {movie.releaseDate && (
                                    <span>{movie.releaseDate.split('-')[0]}</span>
                                )}
                                {movie.releaseDate && movie.runtime ? <span>•</span> : null}
                                {movie.runtime ? <span>{`${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m`}</span> : null}
                            </div>
                            
                            {movie.directors && movie.directors.length > 0 && (
                                <p className="text-sm mb-2">
                                    <span style={{ color: 'var(--foreground-muted)' }}>Dir:</span> <span className="font-medium">{movie.directors.map(d => d.fullName).join(', ')}</span>
                                </p>
                            )}
                            {movie.actors && movie.actors.length > 0 && (
                                <p className="text-xs mb-1 italic truncate opacity-80" style={{ color: 'var(--foreground-muted)' }}>
                                    {movie.actors.map(a => a.fullName).join(', ')}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </Link>
            
            <button
                onClick={handlePickAnother}
                disabled={loading}
                className="w-full py-4 px-6 rounded-lg text-white font-bold text-lg shadow-lg flex items-center justify-center gap-2 hover:bg-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                style={{ backgroundColor: 'var(--accent)', cursor: loading ? 'not-allowed' : 'pointer' }}
            >
                {loading ? (
                    <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Picking...
                    </>
                ) : (
                    <>
                        <span>🎲</span> Pick Another
                    </>
                )}
            </button>
        </div>
    );
}
