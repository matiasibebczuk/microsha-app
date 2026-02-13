export function SkeletonCard() {
  return (
    <div className="list-item skeleton-card" aria-hidden="true">
      <div className="skeleton-line w-60" />
      <div className="skeleton-line w-90" />
      <div className="skeleton-line w-80" />
      <div className="skeleton-row">
        <div className="skeleton-pill" />
        <div className="skeleton-pill" />
      </div>
    </div>
  );
}

export default function SkeletonCards({ count = 3 }) {
  return (
    <div className="grid" aria-live="polite" role="status">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={`skeleton-${index}`} />
      ))}
    </div>
  );
}
