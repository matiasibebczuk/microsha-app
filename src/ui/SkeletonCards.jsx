export function SkeletonCard() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div className="skeleton-line w-60" />
      <div className="skeleton-line w-90" />
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
