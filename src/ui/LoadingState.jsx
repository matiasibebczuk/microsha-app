export default function LoadingState({
  label = "Cargando...",
  fullscreen = false,
  compact = false,
}) {
  const wrapperClass = fullscreen
    ? "loading-screen"
    : compact
      ? "loading-inline"
      : "loading-block";

  return (
    <div className={wrapperClass} role="status" aria-live="polite">
      <span className={compact ? "loader loader-sm" : "loader"} aria-hidden="true" />
      <span className="loading-label">{label}</span>
    </div>
  );
}
