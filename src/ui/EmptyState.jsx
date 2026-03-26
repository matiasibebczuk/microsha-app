export default function EmptyState({ title, subtitle }) {
  return (
    <div className="empty-state">
      <p className="empty-state-title">{title}</p>
      {subtitle ? <p className="empty-state-subtitle">{subtitle}</p> : null}
    </div>
  );
}
