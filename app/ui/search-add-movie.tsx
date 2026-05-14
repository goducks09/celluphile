'use client';

import { useState } from 'react';
import { searchMovies, getMovieDetails, TMDBSearchResponse, TMDBMovie } from '@/app/lib/tmdb';
import { extractCredits } from '@/app/lib/tmdb-utils';
import { addMovieToLibrary, addMovieToWishlist, removeMovieFromWishlist } from '@/app/lib/actions';
import { db } from '@/app/lib/db-client';
import { QUALITIES, type Quality } from '@/app/lib/schemas';
import { toast } from 'sonner';

export default function SearchAddMovie({
    initialLibraryIds = [],
    initialWishlistIds = []
}: {
    initialLibraryIds?: number[];
    initialWishlistIds?: number[];
}) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<TMDBMovie[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedQualities, setSelectedQualities] = useState<Record<number, string>>({});
    
    const [libraryIds, setLibraryIds] = useState<Set<number>>(new Set(initialLibraryIds));
    const [wishlistIds, setWishlistIds] = useState<Set<number>>(new Set(initialWishlistIds));

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        try {
            const data: TMDBSearchResponse = await searchMovies(query);
            setResults(data.results);
            if (data.results.length === 0) {
                toast.info('No movies found for that query.');
            }
        } catch (error) {
            console.error('Failed to search TMDB:', error);
            toast.error('Failed to search TMDB for movies.');
        } finally {
            setLoading(false);
        }
    };

    const handleWishlistToggle = async (movie: TMDBMovie) => {
        const isWishlisted = wishlistIds.has(movie.id);
        const loadingToastId = toast.loading(isWishlisted ? `Removing ${movie.title} from wishlist...` : `Adding ${movie.title} to wishlist...`);

        // Optimistic UI update
        setWishlistIds(prev => {
            const next = new Set(prev);
            if (isWishlisted) next.delete(movie.id);
            else next.add(movie.id);
            return next;
        });

        if (!navigator.onLine) {
            try {
                if (isWishlisted) {
                    await db.wishlist.delete(movie.id);
                    await db.syncQueue.add({
                        action: 'wishlist-remove',
                        payload: { tmdbId: movie.id },
                        timestamp: Date.now()
                    });
                    toast.success(`${movie.title} removed from wishlist offline.`, { id: loadingToastId });
                } else {
                    let details;
                    try {
                        details = await getMovieDetails(movie.id);
                    } catch (error) {
                        // revert
                        setWishlistIds(prev => {
                            const next = new Set(prev);
                            next.delete(movie.id);
                            return next;
                        });
                        console.error('Failed to get enhanced movie details:', error);
                        toast.error(`Failed to fetch details for ${movie.title}.`, { id: loadingToastId });
                        return;
                    }
                    
                    const payload = {
                        tmdbId: movie.id,
                        title: movie.title,
                        poster: movie.poster_path || '',
                        genres: details.genres.map((g: any) => g.name),
                        addedAt: new Date(),
                        releaseDate: details.release_date || undefined,
                    };
                    
                    await db.wishlist.put(payload);
                    await db.syncQueue.add({
                        action: 'wishlist-add',
                        payload: { tmdbId: movie.id },
                        timestamp: Date.now()
                    });
                    toast.success(`${movie.title} added to wishlist offline.`, { id: loadingToastId });
                }
            } catch (err) {
                // revert
                setWishlistIds(prev => {
                    const next = new Set(prev);
                    if (isWishlisted) next.add(movie.id);
                    else next.delete(movie.id);
                    return next;
                });
                console.error('Offline operation failed:', err);
                toast.error('Failed to save operation offline.', { id: loadingToastId });
            }
            return;
        }

        try {
            const result = isWishlisted 
                ? await removeMovieFromWishlist(movie.id)
                : await addMovieToWishlist(movie.id);

            if (result.success) {
                toast.success(result.message || (isWishlisted ? 'Removed from wishlist.' : 'Added to wishlist.'), { id: loadingToastId });
            } else {
                // revert
                setWishlistIds(prev => {
                    const next = new Set(prev);
                    if (isWishlisted) next.add(movie.id);
                    else next.delete(movie.id);
                    return next;
                });
                toast.error(result.message || 'Failed to update wishlist.', { id: loadingToastId });
            }
        } catch (error) {
            // revert
            setWishlistIds(prev => {
                const next = new Set(prev);
                if (isWishlisted) next.add(movie.id);
                else next.delete(movie.id);
                return next;
            });
            console.error('Wishlist action failed:', error);
            toast.error('Failed to update wishlist.', { id: loadingToastId });
        }
    };

    const handleAddMovie = async (movie: TMDBMovie) => {
        const quality = selectedQualities[movie.id];
        if (!quality) {
            toast.warning(`Please select a quality format before adding ${movie.title}.`);
            return;
        }

        const loadingToastId = toast.loading(`Adding ${movie.title}...`);

        let details;
        try {
            details = await getMovieDetails(movie.id);
        } catch (error) {
            console.error('Failed to get enhanced movie details:', error);
            toast.error(`Failed to fetch details for ${movie.title}.`, { id: loadingToastId });
            return;
        }

        const { actors, directors } = extractCredits(details);

        const payload = {
            tmdbId: movie.id,
            title: movie.title,
            poster: movie.poster_path || '',
            genres: details.genres.map((g: any) => g.name),
            quality: quality as Quality,
            actors,
            directors,
            releaseDate: details.release_date || undefined,
            runtime: details.runtime ?? undefined,
        };

        if (!navigator.onLine) {
            try {
                // Add to Dexie cache for immediate UI viewing
                await db.movies.put({ ...payload, addedAt: new Date() });
                // Push to sync queue
                await db.syncQueue.add({
                    action: 'add',
                    payload: payload,
                    timestamp: Date.now()
                });
                
                // If it was in wishlist, also optimistically remove it offline
                if (wishlistIds.has(movie.id)) {
                    await db.wishlist.delete(movie.id);
                    await db.syncQueue.add({
                        action: 'wishlist-remove',
                        payload: { tmdbId: movie.id },
                        timestamp: Date.now()
                    });
                }
                
                toast.success(`${movie.title} added offline. Will sync when connected.`, { id: loadingToastId });
                setSelectedQualities((prev) => {
                    const updated = { ...prev };
                    delete updated[movie.id];
                    return updated;
                });
                
                setLibraryIds(prev => new Set(prev).add(movie.id));
                setWishlistIds(prev => {
                    const next = new Set(prev);
                    next.delete(movie.id);
                    return next;
                });
            } catch (err) {
                console.error('Failed to cache movie offline:', err);
                toast.error('Failed to save movie offline.', { id: loadingToastId });
            }
            return;
        }

        try {
            const result = await addMovieToLibrary(payload);
            if (result.success) {
                toast.success(result.message || 'Movie added to library!', { id: loadingToastId });
                setSelectedQualities((prev) => {
                    const updated = { ...prev };
                    delete updated[movie.id];
                    return updated;
                });
                setLibraryIds(prev => new Set(prev).add(movie.id));
                setWishlistIds(prev => {
                    const next = new Set(prev);
                    next.delete(movie.id);
                    return next;
                });
            } else {
                toast.error(result.message || 'Failed to add movie.', { id: loadingToastId });
            }
        } catch (error) {
            console.error('Failed to add movie across network link:', error);
            toast.error('Failed to add movie across network link.', { id: loadingToastId });
        }
    };

    return (
        <div className="w-full max-w-3xl mx-auto my-8 p-4 rounded-lg shadow" style={{ background: 'var(--background-card)' }}>
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>Add Movies to Library</h2>

            <form onSubmit={handleSearch} className="flex gap-2 mb-6">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by title..."
                    className="flex-1 p-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    style={{ background: 'var(--background-input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                />
                <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                >
                    {loading ? 'Searching...' : 'Search'}
                </button>
            </form>

            <div className="space-y-4">
                {results.map((movie) => {
                    const inLibrary = libraryIds.has(movie.id);
                    const inWishlist = wishlistIds.has(movie.id);

                    return (
                        <div key={movie.id} className="flex items-center justify-between p-3 border rounded flex-wrap gap-4" style={{ background: 'var(--background-input)', borderColor: 'var(--border)' }}>
                            <div className="flex-1 min-w-[200px]">
                                <h3 className="font-semibold">{movie.title}</h3>
                                <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                                    {movie.release_date ? movie.release_date.split('-')[0] : 'Unknown year'}
                                </p>
                                {inLibrary && (
                                    <span className="inline-block mt-1 px-2 py-1 text-xs bg-gray-200 text-gray-800 rounded">In Library</span>
                                )}
                            </div>
                            
                            {!inLibrary && (
                                <div className="flex items-center gap-3 ml-auto flex-wrap justify-end">
                                    <button
                                        onClick={() => handleWishlistToggle(movie)}
                                        className={`px-3 py-1 text-sm rounded border ${
                                            inWishlist 
                                            ? 'bg-pink-100 text-pink-700 border-pink-300 hover:bg-pink-200' 
                                            : 'bg-transparent border-gray-300 hover:bg-gray-100'
                                        }`}
                                    >
                                        {inWishlist ? '♥ In Wishlist (Undo)' : '♡ Add to Wishlist'}
                                    </button>
                                    
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={selectedQualities[movie.id] || ''}
                                            onChange={(e) => setSelectedQualities({ ...selectedQualities, [movie.id]: e.target.value })}
                                            className="p-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            style={{ background: 'var(--background-input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                                        >
                                            <option value="" disabled>Quality</option>
                                            {QUALITIES.map((q) => (
                                                <option key={q} value={q}>{q}</option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={() => handleAddMovie(movie)}
                                            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                                        >
                                            Add to Library
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
