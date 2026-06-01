'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { db } from '@/app/lib/db-client';
import { type SerializedMovie } from '@/app/lib/data';
import { updateMovieInLibrary, removeMovieFromLibrary } from '@/app/lib/actions';
import { QUALITIES, type Quality } from '@/app/lib/schemas';

export default function ItemDetail({ movie: initialMovie }: { movie: SerializedMovie }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [movie, setMovie] = useState<SerializedMovie>(initialMovie);
    const [isEditing, setIsEditing] = useState(false);
    const [editQuality, setEditQuality] = useState<Quality[]>(
        Array.isArray(movie.quality) ? movie.quality : [movie.quality as Quality]
    );
    const [editNotes, setEditNotes] = useState(movie.customNotes || '');
    const [isDeleting, setIsDeleting] = useState(false);

    // Formats e.g., 142 -> 2h 22m
    const formatRuntime = (runtime?: number) => {
        if (!runtime) return null;
        const hours = Math.floor(runtime / 60);
        const mins = runtime % 60;
        return `${hours}h ${mins}m`;
    };

    // Formats date nicely
    const formatDate = (dateString?: string | Date) => {
        if (!dateString) return null;
        const d = new Date(dateString);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
    };

    const handleSave = () => {
        startTransition(async () => {
            const updateData = { quality: editQuality, customNotes: editNotes };

            // Optimistic UI update
            const updatedMovie: SerializedMovie = { ...movie, quality: editQuality, customNotes: editNotes };
            setMovie(updatedMovie);

            if (!navigator.onLine) {
                try {
                    // Update local Dexie DB and queue sync operation for when we are back online
                    await db.movies.where('tmdbId').equals(movie.tmdbId).modify(updateData);
                    await db.syncQueue.add({
                        action: 'update',
                        payload: { tmdbId: movie.tmdbId, ...updateData },
                        timestamp: Date.now()
                    });
                    toast.success('Offline: Changes saved locally.');
                } catch (error) {
                    console.error('Failed to queue update', error);
                    toast.error('Failed to save changes offline.');
                }
                setIsEditing(false);
                return;
            }

            // NOTE: toast.loading only fires for the online flow!
            const loadingToast = toast.loading('Saving changes...');
            try {
                const result = await updateMovieInLibrary(movie.tmdbId, updateData);
                if (result.success) {
                    toast.success('Changes saved!', { id: loadingToast });
                    // If it successfully updated on the server, update the local Dexie cache
                    await db.movies.where('tmdbId').equals(movie.tmdbId).modify(updateData).catch(e => console.error("Cache update failed", e));
                } else {
                    toast.error(result.message || 'Failed to save changes.', { id: loadingToast });
                    setMovie(movie); // Revert optimistic update
                }
            } catch (error) {
                toast.error('An error occurred while saving.', { id: loadingToast });
                setMovie(movie); // Revert optimistic update
            } finally {
                setIsEditing(false);
            }
        });
    };

    const handleCancelEdit = () => {
        setEditQuality(Array.isArray(movie.quality) ? movie.quality : [movie.quality as Quality]);
        setEditNotes(movie.customNotes || '');
        setIsEditing(false);
    };

    const handleDelete = () => {
        startTransition(async () => {
            if (!navigator.onLine) {
                try {
                    await db.movies.where('tmdbId').equals(movie.tmdbId).delete();
                    await db.syncQueue.add({
                        action: 'remove',
                        payload: { tmdbId: movie.tmdbId },
                        timestamp: Date.now()
                    });
                    toast.success('Offline: Movie deleted locally. Returning to library.');
                    router.push('/library');
                } catch (err) {
                    console.error('Failed to queue offline delete', err);
                    toast.error('Failed to delete movie offline.');
                    setIsDeleting(false);
                }
                return;
            }

            const loadingToast = toast.loading('Removing movie...');
            try {
                const result = await removeMovieFromLibrary(movie.tmdbId);
                if (result.success) {
                    toast.success('Movie removed from library.', { id: loadingToast });
                    await db.movies.where('tmdbId').equals(movie.tmdbId).delete().catch(e => console.error("Cache update failed", e));
                    router.push('/library');
                } else {
                    toast.error(result.message || 'Failed to remove movie.', { id: loadingToast });
                    setIsDeleting(false);
                }
            } catch (error) {
                toast.error('An error occurred.', { id: loadingToast });
                setIsDeleting(false);
            }
        });
    };

    return (
        <div className="item-page">
            <div className="item-hero">
                <div className="item-poster-wrap">
                    {movie.poster ? (
                        <Image
                            src={`https://image.tmdb.org/t/p/w500${movie.poster}`}
                            alt={`${movie.title} poster`}
                            fill
                            sizes="(max-width: 768px) 100vw, 300px"
                            className="object-cover"
                            loading="eager"
                            fetchPriority="high"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[var(--background-input)] text-[var(--foreground-muted)]">
                            No Poster Available
                        </div>
                    )}
                </div>

                <div className="item-info">
                    <h1 className="item-title">{movie.title}</h1>

                    <div className="item-meta-row">
                        {movie.releaseDate && <span>{formatDate(movie.releaseDate)}</span>}
                        {movie.releaseDate && movie.runtime ? <span>•</span> : null}
                        {movie.runtime ? <span>{formatRuntime(movie.runtime)}</span> : null}
                    </div>

                    {movie.genres && movie.genres.length > 0 && (
                        <div className="item-meta-row">
                            {movie.genres.map((g: string) => (
                                <span key={g} className="item-badge">{g}</span>
                            ))}
                        </div>
                    )}

                    {isEditing ? (
                        <div className="mt-4 bg-[var(--background-card)] p-4 rounded-lg border border-[var(--border)]">
                            <h3 className="text-sm font-semibold mb-3 text-[var(--accent-light)]">Edit Metadata</h3>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1 text-[var(--foreground-muted)]">Quality</label>
                                <div className="flex flex-wrap gap-3">
                                    {QUALITIES.map((q) => (
                                        <label key={q} className="flex items-center gap-2 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                value={q}
                                                checked={editQuality.includes(q)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setEditQuality([...editQuality, q]);
                                                    } else {
                                                        setEditQuality(editQuality.filter((v) => v !== q));
                                                    }
                                                }}
                                                className="accent-indigo-500 w-4 h-4"
                                            />
                                            <span className="text-sm">{q}</span>
                                        </label>
                                    ))}
                                </div>
                                {editQuality.length === 0 && (
                                    <p className="text-xs text-red-400 mt-1">Please select at least one quality format.</p>
                                )}
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1 text-[var(--foreground-muted)]">Notes</label>
                                <textarea
                                    value={editNotes}
                                    onChange={(e) => setEditNotes(e.target.value)}
                                    placeholder="Add custom notes..."
                                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-[var(--background-input)] border-[var(--border)] text-[var(--foreground)]"
                                    rows={3}
                                    maxLength={500}
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSave}
                                    className="px-4 py-2 bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-light)] transition"
                                >
                                    Save Changes
                                </button>
                                <button
                                    onClick={handleCancelEdit}
                                    className="px-4 py-2 bg-transparent text-[var(--foreground-muted)] border border-[var(--border)] rounded hover:bg-[var(--background-input)] transition"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-2 text-sm font-medium flex flex-wrap gap-1">
                            {(Array.isArray(movie.quality) ? movie.quality : [movie.quality]).map((q) => (
                                <span key={q} className="item-badge item-badge--quality">{q}</span>
                            ))}
                        </div>
                    )}

                    {!isEditing && movie.customNotes && (
                        <div className="mt-2 text-[var(--foreground-muted)] italic format-break-words whitespace-pre-wrap">
                            "{movie.customNotes}"
                        </div>
                    )}

                    <div className="mt-4 flex flex-col">
                        <h3 className="item-section-label">Overview</h3>
                        <p className="text-[var(--foreground-muted)]">{movie.overview}</p>
                    </div>

                    <div className="mt-4 flex flex-col gap-4">
                        {movie.directors && movie.directors.length > 0 && (
                            <div>
                                <h3 className="item-section-label">Director</h3>
                                <p className="text-[var(--foreground-muted)]">{movie.directors.map((d: any) => d.fullName).join(', ')}</p>
                            </div>
                        )}

                        {movie.actors && movie.actors.length > 0 && (
                            <div>
                                <h3 className="item-section-label">Cast</h3>
                                <div className="item-cast-list">
                                    {movie.actors.slice(0, 5).map((a: any) => (
                                        <span key={`${a.firstName}-${a.lastName}`} className="item-cast-chip">
                                            {a.fullName}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <h3 className="item-section-label">Added to Library</h3>
                            <p className="text-sm text-[var(--foreground-muted)]">{formatDate(movie.addedAt)}</p>
                        </div>
                    </div>

                    <div className="item-actions">
                        {!isEditing && (
                            <button className="item-edit-btn" onClick={() => setIsEditing(true)}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                                Edit Metadata
                            </button>
                        )}
                        <button className="item-delete-btn" onClick={() => setIsDeleting(true)}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Remove
                        </button>
                    </div>
                </div>
            </div>

            {isDeleting && (
                <div className="item-confirm-overlay">
                    <div className="item-confirm-dialog">
                        <h3 className="text-lg font-bold mb-2">Remove Movie</h3>
                        <p className="text-sm text-[var(--foreground-muted)] mb-6">
                            Are you sure you want to remove <strong className="text-[var(--foreground)]">{movie.title}</strong> from your library? This cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setIsDeleting(false)}
                                className="px-4 py-2 border border-[var(--border)] rounded text-sm font-medium hover:bg-[var(--background-input)] transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 transition"
                            >
                                Confirm Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
