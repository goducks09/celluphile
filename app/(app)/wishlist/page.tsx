import { getUserWishlist } from '@/app/lib/data';
import WishlistList from '@/app/ui/wishlist-list';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function WishlistPage() {
    const result = await getUserWishlist({ page: 1, limit: 100 }); // Increase limit since we don't have load-more implemented yet
    const initialMovies = result.success ? result.movies : [];

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6 mt-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{ color: 'var(--foreground)' }}>My Wishlist</h1>
            <WishlistList initialMovies={initialMovies} />
        </div>
    );
}
