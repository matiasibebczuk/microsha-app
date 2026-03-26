export default function LoadingState({
  label = "Cargando...",
  fullscreen = false,
  compact = false,
}) {
  const containerClass = fullscreen ? "loading-screen" : "stack";
  const labelClass = compact ? "caption" : "body";

  return (
    <div className={containerClass} role="status" aria-live="polite" style={compact ? {display: 'flex', alignItems: 'center', gap: '8px'} : {textAlign: 'center', padding: '16px'}}>
      <div className="spinner">
        {[...Array(12)].map((_, i) => (
          <div key={i} style={{transform: `rotate(${i * 30}deg)`, animationDelay: `${-1.1 + (i * 0.1)}s`}}></div>
        ))}
      </div>
      {label && <span className={labelClass} style={{color: 'var(--ios-system-gray)'}}>{label}</span>}
    </div>
  );
}
