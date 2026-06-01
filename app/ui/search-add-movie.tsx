'use client';

import { useState, useTransition, use, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import type { TMDBSearchResponse, TMDBMovie } from '@/app/lib/tmdb-utils';
import { extractCredits } from '@/app/lib/tmdb-utils';
import { addMovieToLibrary, addMovieToWishlist, removeMovieFromWishlist } from '@/app/lib/actions';
import { db } from '@/app/lib/db-client';
import { QUALITIES, type Quality } from '@/app/lib/schemas';
import { toast } from 'sonner';

function SearchResults({ 
    searchPromise,
    libraryIds,
    wishlistIds,
    handleWishlistToggle,
    selectedQualities,
    setSelectedQualities,
    handleAddMovie
}: {
    searchPromise: Promise<TMDBSearchResponse>;
    libraryIds: Set<number>;
    wishlistIds: Set<number>;
    handleWishlistToggle: (movie: TMDBMovie) => void;
    selectedQualities: Record<number, Quality[]>;
    setSelectedQualities: (val: Record<number, Quality[]>) => void;
    handleAddMovie: (movie: TMDBMovie) => void;
}) {
    const data = use(searchPromise);
    const results = data?.results || [];

    if (results.length === 0) {
        return <div className="p-4 text-center text-gray-500">No movies found.</div>;
    }

    return (
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
                                
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Format:</span>
                                    <div className="flex flex-wrap gap-2">
                                        {QUALITIES.map((q) => {
                                            const current = selectedQualities[movie.id] || [];
                                            return (
                                                <label key={q} className="flex items-center gap-1 cursor-pointer text-xs select-none">
                                                    <input
                                                        type="checkbox"
                                                        value={q}
                                                        checked={current.includes(q)}
                                                        onChange={(e) => {
                                                            const prev = selectedQualities[movie.id] || [];
                                                            const next = e.target.checked
                                                                ? [...prev, q]
                                                                : prev.filter((v) => v !== q);
                                                            setSelectedQualities({ ...selectedQualities, [movie.id]: next });
                                                        }}
                                                        className="accent-indigo-500 w-3.5 h-3.5"
                                                    />
                                                    {q}
                                                </label>
                                            );
                                        })}
                                    </div>
                                    <button
                                        onClick={() => handleAddMovie(movie)}
                                        className="mt-1 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
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
    );
}

export default function SearchAddMovie({
    initialLibraryIds = [],
    initialWishlistIds = [],
    searchPromise,
    initialQuery = ''
}: {
    initialLibraryIds?: number[];
    initialWishlistIds?: number[];
    searchPromise?: Promise<TMDBSearchResponse> | null;
    initialQuery?: string;
}) {
    const router = useRouter();
    const [query, setQuery] = useState(initialQuery);
    const [isPending, startTransition] = useTransition();
    const [selectedQualities, setSelectedQualities] = useState<Record<number, Quality[]>>({});
    
    const [libraryIds, setLibraryIds] = useState<Set<number>>(new Set(initialLibraryIds));
    const [wishlistIds, setWishlistIds] = useState<Set<number>>(new Set(initialWishlistIds));

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;
        startTransition(() => {
            router.push(`?q=${encodeURIComponent(query)}`);
        });
    };

    const fetchDetails = async (id: number) => {
        const res = await fetch(`/api/tmdb/details?id=${id}`);
        if (!res.ok) throw new Error('Failed to fetch details');
        return await res.json();
    };

    const handleWishlistToggle = (movie: TMDBMovie) => {
        startTransition(async () => {
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
                            details = await fetchDetails(movie.id);
                        } catch (error) {
                            setWishlistIds(prev => { const next = new Set(prev); next.delete(movie.id); return next; });
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
                    setWishlistIds(prev => {
                        const next = new Set(prev);
                        if (isWishlisted) next.add(movie.id); else next.delete(movie.id);
                        return next;
                    });
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
                    setWishlistIds(prev => {
                        const next = new Set(prev);
                        if (isWishlisted) next.add(movie.id); else next.delete(movie.id);
                        return next;
                    });
                    toast.error(result.message || 'Failed to update wishlist.', { id: loadingToastId });
                }
            } catch (error) {
                setWishlistIds(prev => {
                    const next = new Set(prev);
                    if (isWishlisted) next.add(movie.id); else next.delete(movie.id);
                    return next;
                });
                toast.error('Failed to update wishlist.', { id: loadingToastId });
            }
        });
    };

    const handleAddMovie = (movie: TMDBMovie) => {
        startTransition(async () => {
            const quality = selectedQualities[movie.id];
            if (!quality || quality.length === 0) {
                toast.warning(`Please select at least one quality format before adding ${movie.title}.`);
                return;
            }

            const loadingToastId = toast.loading(`Adding ${movie.title}...`);

            let details;
            try {
                details = await fetchDetails(movie.id);
            } catch (error) {
                toast.error(`Failed to fetch details for ${movie.title}.`, { id: loadingToastId });
                return;
            }

            const { actors, directors } = extractCredits(details);

            const payload = {
                tmdbId: movie.id,
                title: movie.title,
                poster: movie.poster_path || '',
                genres: details.genres.map((g: any) => g.name),
                quality: quality as Quality[],
                actors,
                directors,
                releaseDate: details.release_date || undefined,
                runtime: details.runtime ?? undefined,
            };

            if (!navigator.onLine) {
                try {
                    await db.movies.put({ ...payload, addedAt: new Date() });
                    await db.syncQueue.add({ action: 'add', payload, timestamp: Date.now() });
                    
                    if (wishlistIds.has(movie.id)) {
                        await db.wishlist.delete(movie.id);
                        await db.syncQueue.add({ action: 'wishlist-remove', payload: { tmdbId: movie.id }, timestamp: Date.now() });
                    }
                    
                    toast.success(`${movie.title} added offline. Will sync when connected.`, { id: loadingToastId });
                    setSelectedQualities((prev) => { const updated = { ...prev }; delete updated[movie.id]; return updated; });
                    setLibraryIds(prev => new Set(prev).add(movie.id));
                    setWishlistIds(prev => { const next = new Set(prev); next.delete(movie.id); return next; });
                } catch (err) {
                    toast.error('Failed to save movie offline.', { id: loadingToastId });
                }
                return;
            }

            try {
                const result = await addMovieToLibrary(payload);
                if (result.success) {
                    toast.success(result.message || 'Movie added to library!', { id: loadingToastId });
                    setSelectedQualities((prev) => { const updated = { ...prev }; delete updated[movie.id]; return updated; });
                    setLibraryIds(prev => new Set(prev).add(movie.id));
                    setWishlistIds(prev => { const next = new Set(prev); next.delete(movie.id); return next; });
                } else {
                    toast.error(result.message || 'Failed to add movie.', { id: loadingToastId });
                }
            } catch (error) {
                toast.error('Failed to add movie across network link.', { id: loadingToastId });
            }
        });
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
                    disabled={isPending}
                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                >
                    {isPending ? 'Searching...' : 'Search'}
                </button>
            </form>

            {searchPromise && (
                <Suspense fallback={<div className="p-4 text-center text-gray-500">Loading results...</div>}>
                    <SearchResults 
                        searchPromise={searchPromise}
                        libraryIds={libraryIds}
                        wishlistIds={wishlistIds}
                        handleWishlistToggle={handleWishlistToggle}
                        selectedQualities={selectedQualities}
                        setSelectedQualities={setSelectedQualities}
                        handleAddMovie={handleAddMovie}
                    />
                </Suspense>
            )}
        </div>
    );
}
