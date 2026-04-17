import Link from 'next/link';

export default function RandomPage() {
  return (
    <div id="main-content" className="stub-page">
      <div className="stub-card">
        <span className="stub-icon">🎲</span>
        <h2 className="stub-title">Pick a Random Movie</h2>
        <p className="stub-description">
          This feature is coming soon! We&apos;ll randomly select a movie from
          your library so you never have to argue about what to watch.
        </p>
        <Link href="/dashboard" className="stub-back-link">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
