'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { addMovieToLibrary, addMovieToWishlist } from '@/app/lib/actions';
import { QUALITIES, type Quality } from '@/app/lib/schemas';
import type { SerializedMovie } from '@/app/lib/data';

interface AddToLibraryMenuProps {
    movie: SerializedMovie;
    onClose?: () => void;
    onSuccess?: (type: 'library' | 'wishlist') => void;
    className?: string;
}

export default function AddToLibraryMenu({ movie, onClose, onSuccess, className = '' }: AddToLibraryMenuProps) {
    const [loading, setLoading] = useState(false);

    const handleAddLibrary = async (quality: Quality) => {
        setLoading(true);
        if (onClose) onClose();
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
                if (onSuccess) onSuccess('library');
            } else {
                toast.error(result.message || 'Failed to add movie.', { id: toastId });
            }
        } catch (e) {
            toast.error('Error adding movie.', { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    const handleAddWishlist = async () => {
        setLoading(true);
        if (onClose) onClose();
        const toastId = toast.loading(`Adding ${movie.title} to Wishlist...`);
        try {
            const result = await addMovieToWishlist(movie.tmdbId);
            if (result.success) {
                toast.success(result.message || `${movie.title} added to Wishlist!`, { id: toastId });
                if (onSuccess) onSuccess('wishlist');
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
        <div className={`bg-gray-800 border border-gray-700 rounded-md shadow-xl overflow-hidden text-sm ${className}`}>
            <button
                onClick={() => handleAddWishlist()}
                disabled={loading}
                className="w-full text-left px-4 py-3 hover:bg-gray-700 text-gray-200 border-b border-gray-700 font-semibold text-pink-300 disabled:opacity-50"
            >
                + Add to Wishlist
            </button>
            <div className="px-4 py-2 text-xs font-semibold text-green-400 uppercase tracking-wider bg-gray-900/50">
                Add to Library as...
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
    );
}
