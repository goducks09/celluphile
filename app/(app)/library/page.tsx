import SearchAddMovie from '@/app/ui/search-add-movie';
import LibraryList from '@/app/ui/library-list';
import { getUserMovieAndWishlistIds } from '@/app/lib/data';
import { searchMovies } from '@/app/lib/tmdb';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const q = params?.q || '';
  const searchPromise = q ? searchMovies(q) : null;
  const { libraryIds = [], wishlistIds = [] } = await getUserMovieAndWishlistIds();

  return (
    <>
      <SearchAddMovie 
        initialLibraryIds={libraryIds} 
        initialWishlistIds={wishlistIds} 
        searchPromise={searchPromise}
        initialQuery={q}
      />
      <LibraryList />
    </>
  );
}
