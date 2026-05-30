'use client';

import { useOptimistic, useState, useTransition } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import type { SerializedWishlistMovie } from '@/app/lib/data';
import { removeMovieFromWishlist, addMovieToLibrary } from '@/app/lib/actions';
import { QUALITIES, type Quality } from '@/app/lib/schemas';

export default function WishlistList({ initialMovies }: { initialMovies: SerializedWishlistMovie[] }) {
    const [movies, setMovies] = useState<SerializedWishlistMovie[]>(initialMovies);
    const [selectedQualities, setSelectedQualities] = useState<Record<number, string>>({});
    
    // Sort options: Date Added (default, newest first), Release Year, Title
    const [sortBy, setSortBy] = useState<'addedAt' | 'releaseDate' | 'title'>('addedAt');

    const [optimisticMovies, setOptimisticMovies] = useOptimistic(
        movies,
        (state, idToRemove: number) => state.filter(m => m.tmdbId !== idToRemove)
    );

    const [isPending, startTransition] = useTransition();

    const handleRemove = (tmdbId: number, title: string) => {
        startTransition(async () => {
            setOptimisticMovies(tmdbId);
            
            try {
                const result = await removeMovieFromWishlist(tmdbId);
                if (result.success) {
                    setMovies(prev => prev.filter(m => m.tmdbId !== tmdbId));
                    toast.success(`Removed ${title} from wishlist.`);
                } else {
                    toast.error(result.message || 'Failed to remove movie.');
                }
            } catch (error) {
                toast.error('An error occurred while removing.');
            }
        });
    };

    const handleMoveToLibrary = (movie: SerializedWishlistMovie) => {
        const quality = selectedQualities[movie.tmdbId];
        if (!quality) {
            toast.warning(`Please select a quality to move ${movie.title} to your library.`);
            return;
        }

        const loadingId = toast.loading(`Moving ${movie.title} to library...`);
        
        startTransition(async () => {
            setOptimisticMovies(movie.tmdbId);

            try {
                const result = await addMovieToLibrary({
                    tmdbId: movie.tmdbId,
                    quality: quality as Quality,
                });

                if (result.success) {
                    setMovies(prev => prev.filter(m => m.tmdbId !== movie.tmdbId));
                    toast.success(`${movie.title} moved to library!`, { id: loadingId });
                } else {
                    toast.error(result.message || 'Failed to move movie.', { id: loadingId });
                }
            } catch (error) {
                toast.error('An error occurred while moving.', { id: loadingId });
            }
        });
    };

    const sortedMovies = [...optimisticMovies].sort((a, b) => {
        if (sortBy === 'addedAt') return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        if (sortBy === 'releaseDate') {
            const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
            const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
            return dateB - dateA;
        }
        return 0;
    });

    if (optimisticMovies.length === 0) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-20" style={{ color: 'var(--foreground-muted)' }}>
                Your wishlist is empty. Search for a movie to start adding!
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-6">
                <div className="flex gap-4 items-center">
                    <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Sort by:</span>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="p-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        style={{ background: 'var(--background-input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    >
                        <option value="addedAt">Date Added</option>
                        <option value="releaseDate">Release Year</option>
                        <option value="title">Title</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {sortedMovies.map(movie => (
                    <div key={movie.tmdbId} className="flex flex-col rounded-lg shadow overflow-hidden relative group border" style={{ background: 'var(--background-card)', borderColor: 'var(--border)' }}>
                        <div className="aspect-[2/3] relative w-full" style={{ background: 'var(--background-input)' }}>
                            {movie.poster ? (
                                <Image
                                    src={`https://image.tmdb.org/t/p/w342${movie.poster}`}
                                    alt={`${movie.title} poster`}
                                    fill
                                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 200px"
                                    className="object-cover"
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center" style={{ color: 'var(--foreground-muted)' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                                    </svg>
                                </div>
                            )}
                            
                            <button
                                onClick={() => handleRemove(movie.tmdbId, movie.title)}
                                className="absolute top-2 right-2 bg-black/60 hover:bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label="Remove from wishlist"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        <div className="p-3 flex flex-col flex-1">
                            <h3 className="font-semibold text-sm line-clamp-1 flex-1" title={movie.title} style={{ color: 'var(--foreground)' }}>{movie.title}</h3>
                            <div className="text-xs mb-3" style={{ color: 'var(--foreground-muted)' }}>
                                {movie.releaseDate ? movie.releaseDate.split('-')[0] : 'Unknown'}
                            </div>
                            
                            <div className="flex flex-col gap-2 mt-auto">
                                <select
                                    value={selectedQualities[movie.tmdbId] || ''}
                                    onChange={(e) => setSelectedQualities({ ...selectedQualities, [movie.tmdbId]: e.target.value })}
                                    className="p-1 border rounded text-xs w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    style={{ background: 'var(--background-input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                                >
                                    <option value="" disabled>Select Quality</option>
                                    {QUALITIES.map((q) => (
                                        <option key={q} value={q}>{q}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => handleMoveToLibrary(movie)}
                                    className="w-full px-2 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors flex items-center justify-center gap-1"
                                >
                                    <span>Move to Library</span>
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
