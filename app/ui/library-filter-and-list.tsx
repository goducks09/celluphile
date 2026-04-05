'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { searchUserLibrary, removeMovieFromLibrary, type SerializedMovie } from '@/app/lib/actions';
import { db } from '@/app/lib/db-client';
import { MoviesSkeleton } from '@/app/ui/movies-skeleton';
import { toast } from 'sonner';

// We use SerializedMovie for all client state

export default function LibraryFilterAndList({ initialMovies, initialHasMore }: { initialMovies: SerializedMovie[], initialHasMore?: boolean }) {
    const [movies, setMovies] = useState<SerializedMovie[]>(initialMovies);
    const [query, setQuery] = useState('');
    const [selectedQuality, setSelectedQuality] = useState<'Digital' | 'Blu-ray' | '4K' | 'DVD' | ''>('');
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(initialHasMore ?? false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const formatDate = (dateString: string | Date | number) => {
        if (!isMounted) return ''; // Fallback for server-side render to prevent hydration mismatch
        return new Date(dateString).toLocaleDateString();
    };

    // Debounced search and filter effect
    useEffect(() => {
        const fetchFilteredMovies = async () => {
            setLoading(true);
            setPage(1);
            setHasMore(false);
            try {
                if (!navigator.onLine) {
                    // Offline Read: Query Dexie local cache
                    let localQuery = db.movies.orderBy('addedAt').reverse();
                    if (selectedQuality) {
                        localQuery = localQuery.filter(m => m.quality === selectedQuality);
                    }
                    if (query && query.trim() !== '') {
                        const lowerQuery = query.toLowerCase();
                        localQuery = localQuery.filter(m => m.title.toLowerCase().includes(lowerQuery));
                    }
                    const localMovies = await localQuery.toArray();
                    setMovies(localMovies.map(m => ({
                        ...m,
                        _id: '',
                        userId: '',
                    } as SerializedMovie)));
                    return;
                }

                // Online Read: Query Server
                const filters = selectedQuality ? { quality: [selectedQuality] } : {};
                const result = await searchUserLibrary(query, filters, undefined, { page: 1, limit: 20 });

                if (result.success) {
                    setMovies(result.movies);
                    setHasMore(result.hasMore || false);
                    // Overwrite Dexie cache with fresh server state when fetching the unfiltered root library
                    const pendingOps = await db.syncQueue.count();
                    if (pendingOps === 0 && !query && !selectedQuality) {
                        const moviesToCache = result.movies.map((m) => ({
                            ...m,
                            addedAt: new Date(m.addedAt)
                        }));
                        await db.transaction('rw', db.movies, async () => {
                            await db.movies.clear();
                            await db.movies.bulkAdd(moviesToCache);
                        });
                    }
                } else {
                    toast.error(result.message || 'Failed to apply filters.');
                }
            } catch (err) {
                console.error('Failed to filter movies:', err);
                toast.error('An error occurred while filtering.');
            } finally {
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(() => {
            fetchFilteredMovies();
        }, 300); // 300ms debounce

        return () => clearTimeout(timeoutId);
    }, [query, selectedQuality]);

    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore || loading) return;
        setLoadingMore(true);
        try {
            if (!navigator.onLine) {
                setHasMore(false); // Stop the observer from retrying un-paginated offline reads
                return;
            }
            const nextPage = page + 1;
            const filters = selectedQuality ? { quality: [selectedQuality] } : {};
            const result = await searchUserLibrary(query, filters, undefined, { page: nextPage, limit: 20 });

            if (result.success) {
                setMovies(prev => [...prev, ...result.movies]);
                setHasMore(result.hasMore || false);
                setPage(nextPage);
            } else {
                toast.error(result.message || 'Failed to load more movies.');
            }
        } catch (err) {
            console.error('Failed to load more movies:', err);
            toast.error('An error occurred while loading more movies.');
        } finally {
            setLoadingMore(false);
        }
    }, [page, hasMore, loadingMore, loading, query, selectedQuality]);

    const sentinelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                loadMore();
            }
        }, { rootMargin: '100px' });

        if (sentinelRef.current) {
            observer.observe(sentinelRef.current);
        }

        return () => observer.disconnect();
    }, [loadMore]);

    const handleDelete = async (tmdbId: number) => {
        // Optimistically remove from UI
        const movieToRemove = movies.find(m => m.tmdbId === tmdbId);
        setMovies(prev => prev.filter(m => m.tmdbId !== tmdbId));

        if (!navigator.onLine) {
            try {
                // Delete from local cache and queue sync operation
                await db.movies.where('tmdbId').equals(tmdbId).delete();
                await db.syncQueue.add({
                    action: 'remove',
                    payload: { tmdbId },
                    timestamp: Date.now()
                });
                toast.success('Movie deleted offline. Will sync when reconnected.');
            } catch (err) {
                console.error('Failed to queue offline delete', err);
                toast.error('Failed to delete movie offline.');
            }
            return;
        }

        try {
            const result = await removeMovieFromLibrary(tmdbId);
            if (!result.success) {
                // Re-fetch to restore state if it failed
                if (movieToRemove) setMovies(prev => [...prev, movieToRemove]);
                toast.error(result.message || 'Failed to remove movie.');
            } else {
                await db.movies.where('tmdbId').equals(tmdbId).delete();
                toast.success('Movie removed from library.');
            }
        } catch (err) {
            if (movieToRemove) setMovies(prev => [...prev, movieToRemove]);
            console.error('Failed to remove movie:', err);
            toast.error('An error occurred while removing the movie.');
        }
    };

    return (
        <div className="w-full max-w-6xl mx-auto my-8">
            <h2 className="text-2xl font-bold mb-6 px-4">Your Movie Library</h2>

            {/* Search and Filter Controls */}
            <div className="px-4 mb-6 flex flex-col sm:flex-row gap-4">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search your library..."
                    className="flex-1 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <select
                    value={selectedQuality}
                    onChange={(e) => setSelectedQuality(e.target.value as 'Digital' | 'Blu-ray' | '4K' | 'DVD' | '')}
                    className="p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                    <option value="">All Qualities</option>
                    <option value="Digital">Digital</option>
                    <option value="Blu-ray">Blu-ray</option>
                    <option value="4K">4K</option>
                    <option value="DVD">DVD</option>
                </select>
            </div>

            {/* Loading State Overlay */}
            {loading ? (
                <div className="px-4">
                    <MoviesSkeleton />
                </div>
            ) : movies.length === 0 ? (
                <div className="p-8 bg-white rounded-lg shadow text-center mx-4">
                    <h3 className="text-xl font-medium text-gray-700">No movies found</h3>
                    <p className="text-gray-500 mt-2">Try adjusting your search or filters.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 px-4">
                    {movies.map((movie) => (
                        <div key={movie.tmdbId} className="flex flex-col bg-white rounded-lg shadow overflow-hidden transition-transform hover:scale-105">
                            {movie.poster ? (
                                <div className="relative w-full h-80">
                                    <Image
                                        src={`https://image.tmdb.org/t/p/w500${movie.poster}`}
                                        alt={`${movie.title} poster`}
                                        fill
                                        sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
                                        className="object-cover"
                                    />
                                </div>
                            ) : (
                                <div className="w-full h-80 bg-gray-200 flex items-center justify-center text-gray-500">
                                    No Poster Available
                                </div>
                            )}
                            <div className="p-4 flex-1 flex flex-col justify-between">
                                <div>
                                    <h3 className="font-bold text-lg leading-tight mb-1">{movie.title}</h3>
                                    <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
                                        <span className="bg-gray-100 px-2 py-1 rounded">{movie.quality}</span>
                                    </div>
                                </div>
                                <div className="text-xs text-gray-400 mt-4 flex justify-between items-center">
                                    <span>Added: {formatDate(movie.addedAt)}</span>
                                    <button
                                        onClick={() => handleDelete(movie.tmdbId)}
                                        className="text-red-500 hover:text-red-700 p-1"
                                        title="Remove from library"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {loadingMore && <MoviesSkeleton count={5} wrapper={false} />}
                </div>
            )}

            {/* Infinite Scroll Sentinel */}
            {movies.length > 0 && !loading && hasMore && (
                <div ref={sentinelRef} className="h-10 w-full mt-8 flex justify-center items-center">
                    {/* Optional: Add a subtle loading spinner here instead of text if preferred */}
                </div>
            )}
        </div>
    );
}
