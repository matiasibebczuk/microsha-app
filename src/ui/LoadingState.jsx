export default function LoadingState({
  label = "Cargando...",
  fullscreen = false,
  compact = false,
}) {
  if (fullscreen) {
    return (
      <div className="loading-screen" role="status" aria-live="polite">
        <div className="loading-inline">
          <span className="loader" aria-hidden="true" />
          {label ? <span className="loading-label">{label}</span> : null}
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? "loading-inline" : "stack"} role="status" aria-live="polite">
      <div className={compact ? "loading-inline" : "loading-block"}>
        <span className={compact ? "loader loader-sm" : "loader"} aria-hidden="true" />
        {label ? <span className="loading-label">{label}</span> : null}
      </div>
    </div>
  );
}
