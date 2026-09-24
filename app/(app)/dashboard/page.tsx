import { Suspense } from 'react';
import { searchUserLibrary, getLibraryStats } from '@/app/lib/data';
import HomeDashboard from '@/app/ui/home-dashboard';

async function DashboardContent() {
    const [libraryResult, statsResult] = await Promise.all([
        searchUserLibrary('', undefined, { field: 'addedAt', order: -1 }, { page: 1, limit: 8 }),
        getLibraryStats(),
    ]);

    const recentMovies = libraryResult.success ? libraryResult.movies : [];
    const stats = statsResult.success
        ? statsResult.stats
        : { totalFilms: 0, in4K: 0, thisMonth: 0 };

    return <HomeDashboard recentMovies={recentMovies} stats={stats} />;
}

function DashboardSkeleton() {
    return (
        <div className="home-dashboard animate-pulse">
            <section className="home-actions-col">
                <div className="h-6 w-24 rounded mb-4" style={{ background: 'var(--background-input)' }} />
                <div className="home-actions-list">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="home-action-btn" style={{ background: 'var(--background-input)', height: '72px' }} />
                    ))}
                </div>
                <div className="home-stats-row">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="home-stat-card" style={{ background: 'var(--background-input)', height: '80px' }} />
                    ))}
                </div>
            </section>
            <section className="home-library-col">
                <div className="h-6 w-40 rounded mb-4" style={{ background: 'var(--background-input)' }} />
                <div className="home-movie-grid">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="aspect-[2/3] rounded" style={{ background: 'var(--background-input)' }} />
                    ))}
                </div>
            </section>
        </div>
    );
}

export default function DashboardPage() {
    return (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
            <Suspense fallback={<DashboardSkeleton />}>
                <DashboardContent />
            </Suspense>
        </main>
    );
}
