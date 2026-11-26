function formatUpdateTime(value) {
  if (!value) return "Actualizando";
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}

export default function LiveSyncIndicator({
  status,
  syncing,
  lastUpdated,
  changed,
  syncError,
}) {
  const statusLabel = {
    connected: "En vivo",
    connecting: "Conectando",
    disconnected: "Desconectado",
    offline: "Sin conexión",
    error: "Reconexión pendiente",
  }[status] || "Sin conexión";

  return (
    <div
      className={`live-sync-indicator live-sync-${status}${changed ? " live-sync-changed" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="live-sync-dot" aria-hidden="true" />
      <span>{syncError ? "Error al sincronizar" : syncing ? "Sincronizando…" : statusLabel}</span>
      {lastUpdated ? <span className="live-sync-time">· {formatUpdateTime(lastUpdated)}</span> : null}
      {changed && !syncing ? <span className="live-sync-change">Actualizado</span> : null}
    </div>
  );
}
