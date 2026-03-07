'use client';

import { useState, useEffect } from 'react';
import { searchUserLibrary } from '@/app/lib/actions';

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
                const filters = selectedQuality ? { quality: [selectedQuality] } : {};

                // If query is empty and no filters, skip fetching as we might want to just show initial
                // But for robust filtering, we fetch to ensure Server/Client state sync.
                const result = await searchUserLibrary(query, filters);

                if (result.success) {
                    setMovies(result.movies);
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
                                <div className="text-xs text-gray-400 mt-4">
                                    Added: {new Date(movie.addedAt).toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
