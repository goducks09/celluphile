'use client';

import { useState } from 'react';
import { searchMovies, TMDBSearchResponse, TMDBMovie } from '@/app/lib/tmdb';
import { addMovieToLibrary } from '@/app/lib/actions';

export default function SearchAddMovie() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<TMDBMovie[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [selectedQualities, setSelectedQualities] = useState<Record<number, string>>({});

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setMessage('');
        try {
            const data: TMDBSearchResponse = await searchMovies(query);
            setResults(data.results);
            if (data.results.length === 0) {
                setMessage('No movies found.');
            }
        } catch (error) {
            setMessage('Failed to search movies.');
        } finally {
            setLoading(false);
        }
    };

    const handleAddMovie = async (movie: TMDBMovie) => {
        const quality = selectedQualities[movie.id];
        if (!quality) {
            setMessage(`Please select a quality format before adding ${movie.title}.`);
            return;
        }

        setMessage(`Adding ${movie.title}...`);
        try {
            const result = await addMovieToLibrary({
                tmdbId: movie.id,
                title: movie.title,
                poster: movie.poster_path || '',
                genre: movie.genre_ids.map(String), // We'll map genre IDs to names later if needed
                quality: quality as 'Digital' | 'Blu-ray' | '4K' | 'DVD',
            });
            setMessage(result.message);
            // Optionally clear the selection after successful add
            setSelectedQualities((prev) => {
                const updated = { ...prev };
                delete updated[movie.id];
                return updated;
            });
        } catch (error) {
            setMessage('Failed to add movie.');
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto my-8 p-4 bg-gray-50 rounded-lg shadow">
            <h2 className="text-2xl font-bold mb-4">Add Movies to Library</h2>

            <form onSubmit={handleSearch} className="flex gap-2 mb-6">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by title..."
                    className="flex-1 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                >
                    {loading ? 'Searching...' : 'Search'}
                </button>
            </form>

            {message && (
                <div className="mb-4 p-3 bg-blue-100 text-blue-800 rounded">
                    {message}
                </div>
            )}

            <div className="space-y-4">
                {results.map((movie) => (
                    <div key={movie.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded">
                        <div>
                            <h3 className="font-semibold">{movie.title}</h3>
                            <p className="text-sm text-gray-500">
                                {movie.release_date ? movie.release_date.split('-')[0] : 'Unknown year'}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <select
                                value={selectedQualities[movie.id] || ''}
                                onChange={(e) => setSelectedQualities({ ...selectedQualities, [movie.id]: e.target.value })}
                                className="p-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                                <option value="" disabled>Select Quality</option>
                                <option value="Digital">Digital</option>
                                <option value="Blu-ray">Blu-ray</option>
                                <option value="4K">4K</option>
                                <option value="DVD">DVD</option>
                            </select>
                            <button
                                onClick={() => handleAddMovie(movie)}
                                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                            >
                                Add to Library
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
