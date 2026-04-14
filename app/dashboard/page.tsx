import { auth, signOut } from '@/auth';
import { searchUserLibrary, getLibraryStats } from '@/app/lib/actions';
import HomeDashboard from '@/app/ui/home-dashboard';

export default async function DashboardPage() {
  const session = await auth();

  // Fetch the 8 most-recent movies and library stats in parallel
  const [libraryResult, statsResult] = await Promise.all([
    searchUserLibrary('', undefined, undefined, { page: 1, limit: 8 }),
    getLibraryStats(),
  ]);

  const recentMovies = libraryResult.success ? libraryResult.movies : [];
  const stats = statsResult.success
    ? statsResult.stats
    : { totalFilms: 0, in4K: 0, thisMonth: 0 };

  return (
    <div className="min-h-screen pb-12" style={{ background: 'var(--background)' }}>
      <header className="dashboard-header">
        <div className="dashboard-header-inner">
          <h1 className="dashboard-brand">CELLU<span className="dashboard-brand-dot">●</span>PHILE</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>{session?.user?.email}</span>
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/login' });
              }}
            >
              <button
                type="submit"
                className="dashboard-sign-out-btn"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <HomeDashboard recentMovies={recentMovies} stats={stats} />
      </main>
    </div>
  );
}
