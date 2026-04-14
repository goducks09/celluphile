export function MoviesSkeleton({ count = 20, wrapper = true }: { count?: number; wrapper?: boolean }) {
    const items = Array.from({ length: count }).map((_, i) => (
        <div key={`skeleton-${i}`} role="status" aria-label="Loading" className="relative group rounded overflow-hidden shadow-sm animate-pulse aspect-[2/3]" style={{ background: 'var(--background-card)' }}>
            {/* Placeholder for the poster */}
            <div className="absolute inset-0" style={{ background: 'var(--background-input)' }}></div>
        </div>
    ));

    if (!wrapper) return <>{items}</>;

    return (
        <div role="status" aria-busy="true" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 mt-6">
            {items}
        </div>
    );
}
