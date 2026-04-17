import SearchAddMovie from '@/app/ui/search-add-movie';
import LibraryList from '@/app/ui/library-list';

export default function LibraryPage() {
  return (
    <div id="main-content">
      <SearchAddMovie />
      <LibraryList />
    </div>
  );
}
