'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { addMovieToLibrary, addMovieToWishlist } from '@/app/lib/actions';
import { QUALITIES, type Quality } from '@/app/lib/schemas';
import type { SerializedMovie } from '@/app/lib/data';

export default function RecommendationDetailActions({ movie }: { movie: SerializedMovie }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [showLibraryOptions, setShowLibraryOptions] = useState(false);

    const handleAddWishlist = async () => {
        setLoading(true);
        const toastId = toast.loading(`Adding ${movie.title} to Wishlist...`);
        try {
            const result = await addMovieToWishlist(movie.tmdbId);
            if (result.success) {
                toast.success(result.message || `${movie.title} added to Wishlist!`, { id: toastId });
                router.push('/wishlist');
            } else {
                toast.error(result.message || 'Failed to add movie.', { id: toastId });
            }
        } catch (e) {
            toast.error('Error adding movie.', { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    const handleAddLibrary = async (quality: Quality) => {
        setLoading(true);
        setShowLibraryOptions(false);
        const toastId = toast.loading(`Adding ${movie.title} to Library...`);
        try {
            const payload = {
                tmdbId: movie.tmdbId,
                quality: [quality],
                customNotes: '',
            };
            const result = await addMovieToLibrary(payload);
            if (result.success) {
                toast.success(result.message || `${movie.title} added to Library!`, { id: toastId });
                router.push(`/library/${movie.tmdbId}`);
            } else {
                toast.error(result.message || 'Failed to add movie.', { id: toastId });
            }
        } catch (e) {
            toast.error('Error adding movie.', { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mt-6 pt-4 border-t border-[var(--border)]">
            <h3 className="item-section-label">Add to your Collection</h3>
            <div className="flex gap-4 mt-2">
                <button
                    onClick={handleAddWishlist}
                    disabled={loading}
                    className="px-4 py-2 bg-[var(--background-card)] border border-[var(--border)] rounded font-medium hover:bg-[var(--background-input)] transition-colors disabled:opacity-50"
                >
                    + Add to Wishlist
                </button>
                <div className="relative">
                    <button
                        onClick={() => setShowLibraryOptions(!showLibraryOptions)}
                        disabled={loading}
                        className="px-4 py-2 bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                        + Add to Library
                    </button>
                    {showLibraryOptions && (
                        <div className="absolute top-full left-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded-md shadow-xl z-50 overflow-hidden text-sm">
                            <div className="px-4 py-2 text-xs font-semibold text-green-400 uppercase tracking-wider bg-gray-900/50">
                                Choose Format...
                            </div>
                            {QUALITIES.map((quality) => (
                                <button
                                    key={quality}
                                    disabled={loading}
                                    onClick={() => handleAddLibrary(quality)}
                                    className="w-full text-left px-4 py-2 hover:bg-gray-700 text-gray-200 disabled:opacity-50"
                                >
                                    {quality}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
