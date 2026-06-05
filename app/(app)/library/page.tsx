import SearchAddMovie from '@/app/ui/search-add-movie';
import LibraryList from '@/app/ui/library-list';
import { getUserMovieAndWishlistIds } from '@/app/lib/data';
import { searchMovies } from '@/app/lib/tmdb';

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
