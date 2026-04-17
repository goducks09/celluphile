import Link from 'next/link';

export default function RecommendationsPage() {
  return (
    <div id="main-content" className="stub-page">
      <div className="stub-card">
        <span className="stub-icon">✨</span>
        <h2 className="stub-title">Recommended for Me</h2>
        <p className="stub-description">
          This feature is coming soon! We&apos;ll analyze your collection and
          suggest movies you might love.
        </p>
        <Link href="/dashboard" className="stub-back-link">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
