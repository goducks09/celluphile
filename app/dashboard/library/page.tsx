import SearchAddMovie from '@/app/ui/search-add-movie';
import LibraryList from '@/app/ui/library-list';
import { getUserMovieAndWishlistIds } from '@/app/lib/actions';

export default async function LibraryPage() {
  const { libraryIds = [], wishlistIds = [] } = await getUserMovieAndWishlistIds();

  return (
    <>
      <SearchAddMovie initialLibraryIds={libraryIds} initialWishlistIds={wishlistIds} />
      <LibraryList />
    </>
  );
}
