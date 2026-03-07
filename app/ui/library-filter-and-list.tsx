'use client';

import { useState, useEffect } from 'react';
import { searchUserLibrary, removeMovieFromLibrary } from '@/app/lib/actions';
import { db } from '@/app/lib/db-client';

// We define this interface to match our populated movie document shape
interface LibraryMovie {
    _id: string;
    tmdbId: number;
    title: string;
    poster: string;
    genre: string[];
    quality: string;
    addedAt: Date;
}

export default function LibraryFilterAndList({ initialMovies }: { initialMovies: LibraryMovie[] }) {
    const [movies, setMovies] = useState<LibraryMovie[]>(initialMovies);
    const [query, setQuery] = useState('');
    const [selectedQuality, setSelectedQuality] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Debounced search and filter effect
    useEffect(() => {
        const fetchFilteredMovies = async () => {
            setLoading(true);
            setError('');
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
                    setMovies(localMovies as any[]);
                    return;
                }

                // Online Read: Query Server
                const filters = selectedQuality ? { quality: [selectedQuality as 'Digital' | 'Blu-ray' | '4K' | 'DVD'] } : {};
                const result = await searchUserLibrary(query, filters);

                if (result.success) {
                    setMovies(result.movies);
                    // Overwrite Dexie cache with fresh server state when fetching the unfiltered root library
                    const pendingOps = await db.syncQueue.count();
                    if (pendingOps === 0 && !query && !selectedQuality) {
                        await db.movies.clear();
                        const moviesToCache = result.movies.map((m: any) => ({
                            ...m,
                            addedAt: new Date(m.addedAt)
                        }));
                        await db.movies.bulkAdd(moviesToCache);
                    }
                } else {
                    setError(result.message || 'Failed to apply filters.');
                }
            } catch (err) {
                setError('An error occurred while filtering.');
            } finally {
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(() => {
            fetchFilteredMovies();
        }, 300); // 300ms debounce

        return () => clearTimeout(timeoutId);
    }, [query, selectedQuality]);

    const handleDelete = async (tmdbId: number) => {
        // Optimistically remove from UI
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
            } catch (err) {
                console.error('Failed to queue offline delete', err);
            }
            return;
        }

        try {
            const result = await removeMovieFromLibrary(tmdbId);
            if (!result.success) {
                // Re-fetch to restore state if it failed
                setError(result.message || 'Failed to remove movie.');
            } else {
                await db.movies.where('tmdbId').equals(tmdbId).delete();
            }
        } catch (err) {
            setError('An error occurred while removing the movie.');
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
                    onChange={(e) => setSelectedQuality(e.target.value)}
                    className="p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                    <option value="">All Qualities</option>
                    <option value="Digital">Digital</option>
                    <option value="Blu-ray">Blu-ray</option>
                    <option value="4K">4K</option>
                    <option value="DVD">DVD</option>
                </select>
            </div>

            {error && (
                <div className="px-4 mb-4 text-red-600 font-medium">{error}</div>
            )}

            {/* Loading State Overlay */}
            {loading && (
                <div className="px-4 mb-4 text-indigo-600 font-medium animate-pulse">Updating library...</div>
            )}

            {/* Movie Grid */}
            {movies.length === 0 && !loading ? (
                <div className="p-8 bg-white rounded-lg shadow text-center mx-4">
                    <h3 className="text-xl font-medium text-gray-700">No movies found</h3>
                    <p className="text-gray-500 mt-2">Try adjusting your search or filters.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 px-4">
                    {movies.map((movie) => (
                        <div key={movie.tmdbId} className="flex flex-col bg-white rounded-lg shadow overflow-hidden transition-transform hover:scale-105">
                            {movie.poster ? (
                                <img
                                    src={`https://image.tmdb.org/t/p/w500${movie.poster}`}
                                    alt={`${movie.title} poster`}
                                    className="w-full h-80 object-cover"
                                />
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
                                    <span>Added: {new Date(movie.addedAt).toLocaleDateString()}</span>
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
                </div>
            )}
        </div>
    );
}
