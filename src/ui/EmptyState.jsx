export default function EmptyState({ title, subtitle }) {
  return (
    <div className="card glass-card" style={{ textAlign: 'center', padding: '40px 24px', opacity: 0.8 }}>
      <p className="headline" style={{ marginBottom: '4px' }}>{title}</p>
      {subtitle ? <p className="caption">{subtitle}</p> : null}
    </div>
  );
}
