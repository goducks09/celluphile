export default function Loading() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: '#1a1a2e',
    }}>
      <div style={{
        fontSize: '1.75rem',
        fontWeight: 800,
        letterSpacing: '0.08em',
        color: '#e2e2f0',
        textTransform: 'uppercase',
      }}>
        CELLUP<span style={{ color: '#4f46e5' }}>·</span>HILE
      </div>
    </div>
  );
}
