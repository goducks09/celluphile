import LaunchRedirect from './launch-redirect';

/**
 * Lightweight splash page used as the PWA start_url.
 *
 * On iOS, the native splash screen is dismissed the moment WebKit
 * receives an HTTP response. If start_url pointed at a protected
 * route like /dashboard, the auth middleware's 302 redirect would
 * dismiss the splash before any HTML painted — causing a black screen.
 *
 * This page has zero server-side data dependencies so its HTML streams
 * almost instantly, replacing the native splash with a branded loading
 * state. The <LaunchRedirect /> client component then navigates to
 * /dashboard (letting middleware handle auth) while this page remains
 * visible on screen.
 */
export default function LaunchPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: '#1a1a2e',
      gap: '2rem',
    }}>
      {/* Inline keyframes — no external CSS dependency */}
      <style>{`
        @keyframes launch-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        .launch-brand {
          animation: launch-pulse 2s ease-in-out infinite;
        }
      `}</style>

      <div
        className="launch-brand"
        style={{
          fontSize: '1.75rem',
          fontWeight: 800,
          letterSpacing: '0.08em',
          color: '#e2e2f0',
          textTransform: 'uppercase' as const,
        }}
      >
        CELLUP<span style={{ color: '#4f46e5' }}>·</span>HILE
      </div>

      <LaunchRedirect />
    </div>
  );
}
