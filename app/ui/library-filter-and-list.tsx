'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { type SerializedMovie } from '@/app/lib/data';
import { db } from '@/app/lib/db-client';
import { QUALITIES, type Quality } from '@/app/lib/schemas';
import { MoviesSkeleton } from '@/app/ui/movies-skeleton';
import { toast } from 'sonner';

// We use SerializedMovie for all client state

export default function LibraryFilterAndList({ initialMovies, initialHasMore }: { initialMovies: SerializedMovie[], initialHasMore?: boolean }) {
    const [movies, setMovies] = useState<SerializedMovie[]>(initialMovies);
    const [query, setQuery] = useState('');
    const [selectedQuality, setSelectedQuality] = useState<Quality | ''>('');
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
                        addedAt: typeof m.addedAt === 'string' ? m.addedAt : (m.addedAt instanceof Date ? m.addedAt.toISOString() : new Date(m.addedAt).toISOString()),
                        overview: m.overview || '',
                        keywords: m.keywords || [],
                    } as SerializedMovie)));
                    return;
                }

                // Online Read: Query Server
                const filters = selectedQuality ? { quality: [selectedQuality] } : {};
                const res = await fetch('/api/library/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query, filters, pagination: { page: 1, limit: 20 } })
                });
                const result = await res.json();

                if (result.success) {
                    setMovies(result.movies);
                    setHasMore(result.hasMore || false);
                    // Overwrite Dexie cache with fresh server state when fetching the unfiltered root library
                    const pendingOps = await db.syncQueue.count();
                    if (pendingOps === 0 && !query && !selectedQuality) {
                        const moviesToCache = result.movies.map((m: SerializedMovie) => ({
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
            const res = await fetch('/api/library/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, filters, pagination: { page: nextPage, limit: 20 } })
            });
            const result = await res.json();

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
                    className="flex-1 p-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    style={{ background: 'var(--background-input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                />
                <select
                    value={selectedQuality}
                    onChange={(e) => setSelectedQuality(e.target.value as Quality | '')}
                    className="p-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    style={{ background: 'var(--background-input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                    <option value="">All Qualities</option>
                    {QUALITIES.map((q) => (
                        <option key={q} value={q}>{q}</option>
                    ))}
                </select>
            </div>

            {/* Loading State Overlay */}
            {loading ? (
                <div className="px-4">
                    <MoviesSkeleton />
                </div>
            ) : movies.length === 0 ? (
                <div className="p-8 rounded-lg shadow text-center mx-4" style={{ background: 'var(--background-card)' }}>
                    <h3 className="text-xl font-medium" style={{ color: 'var(--foreground)' }}>No movies found</h3>
                    <p className="mt-2" style={{ color: 'var(--foreground-muted)' }}>Try adjusting your search or filters.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 px-4">
                    {movies.map((movie) => (
                        <Link key={movie.tmdbId} href={`/dashboard/library/${movie.tmdbId}`} className="flex flex-col rounded-lg shadow overflow-hidden transition-transform hover:scale-105" style={{ background: 'var(--background-card)' }}>
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
                                    {movie.directors && movie.directors.length > 0 && (
                                        <p className="text-sm mb-1" style={{ color: 'var(--foreground-muted)' }}>
                                            <span className="font-semibold">Dir:</span> {movie.directors.map(d => d.fullName).join(', ')}
                                        </p>
                                    )}
                                    {movie.actors && movie.actors.length > 0 && (
                                        <p className="text-xs mb-3 italic truncate" style={{ color: 'var(--foreground-muted)' }}>
                                            {movie.actors.map(a => a.fullName).join(', ')}
                                        </p>
                                    )}
                                    <div className="flex justify-between items-center text-sm mb-2" style={{ color: 'var(--foreground-muted)' }}>
                                        <span className="px-2 py-1 rounded" style={{ background: 'var(--background-input)' }}>{movie.quality}</span>
                                    </div>
                                </div>
                                <div className="text-xs mt-4 flex justify-between items-center" style={{ color: 'var(--foreground-muted)' }}>
                                    <span>Added: {formatDate(movie.addedAt)}</span>
                                </div>
                            </div>
                        </Link>
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
