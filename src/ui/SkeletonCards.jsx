export function SkeletonCard() {
  return (
    <div className="card glass-card skeleton-card" aria-hidden="true" style={{borderRadius: 0, border: 'none', borderBottom: '0.5px solid rgba(255,255,255,0.05)', padding: '16px'}}>
      <div className="skeleton-line w-60" style={{height: '14px', marginBottom: '8px'}} />
      <div className="skeleton-line w-90" style={{height: '10px', opacity: 0.5}} />
    </div>
  );
}

export default function SkeletonCards({ count = 3 }) {
  return (
    <div className="inset-list" aria-live="polite" role="status">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={`skeleton-${index}`} />
      ))}
    </div>
  );
}
