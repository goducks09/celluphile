import { Suspense } from 'react';
import { getUserWishlist } from '@/app/lib/data';
import WishlistList from '@/app/ui/wishlist-list';

async function WishlistContent() {
    const result = await getUserWishlist({ page: 1, limit: 100 });
    const initialMovies = result.success ? result.movies : [];
    return <WishlistList initialMovies={initialMovies} />;
}

export default function WishlistPage() {
    return (
        <div>
            <h1 className="text-3xl font-bold mb-6 mt-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{ color: 'var(--foreground)' }}>My Wishlist</h1>
            <Suspense fallback={
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 mt-6">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="animate-pulse bg-gray-300 dark:bg-gray-700 aspect-[2/3] rounded" />
                        ))}
                    </div>
                </div>
            }>
                <WishlistContent />
            </Suspense>
        </div>
    );
}
