import { auth } from '@/auth';
import { searchUserLibrary, getLibraryStats } from '@/app/lib/data';
import HomeDashboard from '@/app/ui/home-dashboard';

export default async function DashboardPage() {
  const session = await auth();

  // Fetch the 8 most-recent movies and library stats in parallel
  const [libraryResult, statsResult] = await Promise.all([
    searchUserLibrary('', undefined, { field: 'addedAt', order: -1 }, { page: 1, limit: 8 }),
    getLibraryStats(),
  ]);

  const recentMovies = libraryResult.success ? libraryResult.movies : [];
  const stats = statsResult.success
    ? statsResult.stats
    : { totalFilms: 0, in4K: 0, thisMonth: 0 };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
      <HomeDashboard recentMovies={recentMovies} stats={stats} />
    </main>
  );
}
