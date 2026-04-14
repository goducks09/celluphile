'use client';

import { useState } from 'react';
import { searchMovies, TMDBSearchResponse, TMDBMovie } from '@/app/lib/tmdb';
import { addMovieToLibrary } from '@/app/lib/actions';
import { db } from '@/app/lib/db-client';
import { QUALITIES, type Quality } from '@/app/lib/schemas';
import { toast } from 'sonner';

export default function SearchAddMovie() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<TMDBMovie[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedQualities, setSelectedQualities] = useState<Record<number, string>>({});

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

    const handleAddMovie = async (movie: TMDBMovie) => {
        const quality = selectedQualities[movie.id];
        if (!quality) {
            toast.warning(`Please select a quality format before adding ${movie.title}.`);
            return;
        }

        const loadingToastId = toast.loading(`Adding ${movie.title}...`);

        const payload = {
            tmdbId: movie.id,
            title: movie.title,
            poster: movie.poster_path || '',
            genre: movie.genre_ids.map(String),
            quality: quality as Quality,
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
                toast.success(`${movie.title} added offline. Will sync when connected.`, { id: loadingToastId });
                setSelectedQualities((prev) => {
                    const updated = { ...prev };
                    delete updated[movie.id];
                    return updated;
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
                // Only clear the selection after successful add
                setSelectedQualities((prev) => {
                    const updated = { ...prev };
                    delete updated[movie.id];
                    return updated;
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
        <div className="w-full max-w-2xl mx-auto my-8 p-4 rounded-lg shadow" style={{ background: 'var(--background-card)' }}>
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
                {results.map((movie) => (
                    <div key={movie.id} className="flex items-center justify-between p-3 border rounded" style={{ background: 'var(--background-input)', borderColor: 'var(--border)' }}>
                        <div>
                            <h3 className="font-semibold">{movie.title}</h3>
                            <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                                {movie.release_date ? movie.release_date.split('-')[0] : 'Unknown year'}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <select
                                value={selectedQualities[movie.id] || ''}
                                onChange={(e) => setSelectedQualities({ ...selectedQualities, [movie.id]: e.target.value })}
                                className="p-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                style={{ background: 'var(--background-input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                            >
                                <option value="" disabled>Select Quality</option>
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
                ))}
            </div>
        </div>
    );
}
