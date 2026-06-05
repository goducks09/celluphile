'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { SerializedMovie, LibraryStats } from '@/app/lib/data';
import { QUALITY_COLORS } from '@/app/ui/constants';

export default function HomeDashboard({
    recentMovies,
    stats,
}: {
    recentMovies: SerializedMovie[];
    stats: LibraryStats;
}) {

    return (
        <div className="home-dashboard">
            {/* ===== Left Column: Actions + Stats ===== */}
            <section className="home-actions-col">
                <h2 className="home-section-title">Actions</h2>

                <div className="home-actions-list">
                    {/* Add a Movie */}
                    <Link href="/library" className="home-action-btn" id="action-add-movie">
                        <div className="home-action-btn-content">
                            <span className="home-action-btn-label">Add a movie</span>
                            <span className="home-action-btn-sub">Search and add to your library</span>
                        </div>
                        <span className="home-action-btn-icon">+</span>
                    </Link>

                    {/* Pick a Random Movie */}
                    <Link href="/random" className="home-action-btn home-action-btn--accent" id="action-random-movie">
                        <div className="home-action-btn-content">
                            <span className="home-action-btn-label home-action-btn-label--accent">Pick a random movie</span>
                            <span className="home-action-btn-sub">Let your library decide tonight</span>
                        </div>
                    </Link>

                    {/* Recommended For Me */}
                    <Link href="/recommendations" className="home-action-btn home-action-btn--accent" id="action-recommended">
                        <div className="home-action-btn-content">
                            <span className="home-action-btn-label home-action-btn-label--accent">Recommended for me</span>
                            <span className="home-action-btn-sub">Based on what you own</span>
                        </div>
                    </Link>
                </div>

                {/* Stats */}
                <div className="home-stats-row">
                    <div className="home-stat-card">
                        <span className="home-stat-label">Total films</span>
                        <span className="home-stat-value">{stats.totalFilms}</span>
                    </div>
                    <div className="home-stat-card">
                        <span className="home-stat-label">In 4K</span>
                        <span className="home-stat-value">{stats.in4K}</span>
                    </div>
                    <div className="home-stat-card">
                        <span className="home-stat-label">This month</span>
                        <span className="home-stat-value">{stats.thisMonth}</span>
                    </div>
                </div>
            </section>

            {/* ===== Right Column: Recently Added ===== */}
            <section className="home-library-col">
                {/* Header */}
                <div className="home-library-header">
                    <h2 className="home-section-title">Recently Added</h2>
                </div>

                {/* Movie Grid */}
                {recentMovies.length === 0 ? (
                    <div className="home-library-empty">
                        <p>Your library is empty.</p>
                    </div>
                ) : (
                    <div className="home-movie-grid">
                        {recentMovies.map((movie, index) => (
                            <Link key={movie.tmdbId} href={`/library/${movie.tmdbId}`} className="home-movie-card">
                                {/* Quality Badges */}
                                <span className={`home-quality-badge ${QUALITY_COLORS[movie.quality[0]] || 'bg-gray-500'}`}>
                                    {movie.quality.join(' + ')}
                                </span>

                                {/* Poster or Placeholder */}
                                {movie.poster ? (
                                    <Image
                                        src={`https://image.tmdb.org/t/p/w342${movie.poster}`}
                                        alt={`${movie.title} poster`}
                                        fill
                                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 200px"
                                        className="object-cover"
                                        loading={index === 0 ? 'eager' : 'lazy'}
                                    />
                                ) : (
                                    <div className="home-movie-placeholder" />
                                )}

                                {/* Info Overlay */}
                                <div className="home-movie-info">
                                    <span className="home-movie-title">{movie.title}</span>
                                    <span className="home-movie-year">
                                        {new Date(movie.addedAt).getFullYear()}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {/* View Full Library Link */}
                <div className="home-view-all">
                    <Link href="/library" className="home-view-all-link">
                        View full library →
                    </Link>
                </div>
            </section>
        </div>
    );
}
