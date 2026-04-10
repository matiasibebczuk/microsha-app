import { useEffect, useState } from "react";
import { apiUrl } from "../api";
import { fetchWithRetry } from "../lib/fetchWithRetry";
import LoadingState from "../ui/LoadingState";
import SkeletonCards from "../ui/SkeletonCards";
import MessageBanner from "../ui/MessageBanner";
import EmptyState from "../ui/EmptyState";
import Pager from "../ui/Pager";
import { useSessionToken } from "../hooks/useSessionToken";
import { formatDateTime, formatTripTitle } from "../utils/format";
import { IconChevronRight } from "../ui/icons";

export default function AdminHistory({ onBack }) {
  const getToken = useSessionToken();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  useEffect(() => {
    let alive = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const token = await getToken();
        if (!token) { if (alive) setRuns([]); if (alive) setError("Sesión expirada"); return; }
        const res = await fetchWithRetry(apiUrl("/admin/history"), { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (!res.ok) { if (alive) setRuns([]); if (alive) setError(json?.error || "Error"); return; }
        if (alive) { setRuns(Array.isArray(json) ? json : []); setPage(1); }
      } catch { if (alive) { setRuns([]); setError("Error de red"); } } finally { if (alive) { setLoading(false); } }
    })();
    return () => { alive = false; };
  }, [getToken]);

  const openRun = async (runId) => {
    setDetailLoading(true);
    try {
      const token = await getToken();
      if (!token) { setError("Sesión expirada"); return; }
      const res = await fetchWithRetry(apiUrl(`/admin/history/${runId}`), { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok) { setError(json?.error || "Error"); return; }
      setError(""); setSelected(json);
    } finally { setDetailLoading(false); }
  };

  const downloadExcel = async (runId) => {
    const token = await getToken();
    const res = await fetchWithRetry(apiUrl(`/admin/history/${runId}/excel`), { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { setError("No se pudo descargar Excel"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `run-${runId}.xlsx`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (selected) {
    return (
      <div className="page fade-up">
        <header className="row-between" style={{ marginBottom: 32 }}>
          <div className="stack-sm">
             <h1 className="large-title">Detalle</h1>
             <p className="caption">{formatTripTitle(selected.run?.trip_name, selected.run?.trip_departure_datetime, selected.run?.trip_id || selected.run?.id)}</p>
          </div>
          <button className="btn-secondary" onClick={() => setSelected(null)}>Atrás</button>
        </header>

        <div className="inset-group">
          <div className="card glass-card stack-sm" style={{ padding: '24px' }}>
            <div className="row-between">
               <span className="body"><b>Resumen</b></span>
               <button className="btn-plain" style={{ color: 'var(--ios-system-blue)' }} onClick={() => downloadExcel(selected.run.id)}>Excel</button>
            </div>
            <div className="row" style={{ gap: '8px' }}>
              <span className="badge">Total: {selected.summary?.total || 0}</span>
              <span className="badge badge-success">Presentes: {selected.summary?.boarded || 0}</span>
              <span className="badge badge-warning">Ausentes: {selected.summary?.missing || 0}</span>
            </div>
            <div className="divider" />
            <p className="caption">Finalizado: {selected.run?.finished_at ? formatDateTime(selected.run.finished_at) : "-"}</p>
            <p className="caption">Inició: {selected.run?.started_by_name || "-"}</p>
            <p className="caption">Finalizó: {selected.run?.finished_by_name || "-"}</p>
          </div>
        </div>

        <MessageBanner message={error} />

        <div className="inset-group" style={{ marginTop: 32 }}>
          <h3 className="subheadline">Lista de Asistencia</h3>
          <div className="inset-list">
            {(selected.passengers || []).map((p, index) => (
              <div key={index} className="card glass-card row-between" style={{ borderRadius: 0, border: 'none', borderBottom: '0.5px solid rgba(255,255,255,0.05)', padding: '16px' }}>
                <div className="stack-sm">
                  <span className="body"><b>{p.user_name || "Sin nombre"}</b></span>
                  <span className="caption">{p.stop_name || "Sin parada"}</span>
                </div>
                <span className={`badge ${p.boarded ? 'badge-success' : 'badge-warning'}`}>
                  {p.boarded ? "Subió" : "No subió"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page fade-up">
      <header className="row-between" style={{ marginBottom: 32 }}>
        <h1 className="large-title">Historial</h1>
        {onBack && <button className="btn-secondary" onClick={onBack}>Volver</button>}
      </header>

      <MessageBanner message={error} />

      {loading ? (
        <div className="inset-group">
          <SkeletonCards count={4} />
        </div>
      ) : runs.length === 0 ? (
        <EmptyState title="Cero kilómetros" subtitle="Cuando finalices traslados, vas a poder ver el historial acá." />
      ) : (
        <div className="inset-group">
          <div className="inset-list">
            {runs.slice((page - 1) * pageSize, page * pageSize).map((run) => (
              <div key={run.id} className="card glass-card row-between" onClick={() => !detailLoading && openRun(run.id)} style={{ borderRadius: 0, border: 'none', borderBottom: '0.5px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}>
                <div className="stack-sm">
                  <span className="body"><b>{formatTripTitle(run.trip_name, run.trip_departure_datetime, run.trip_id)}</b></span>
                  <span className="caption">{run.finished_at ? formatDateTime(run.finished_at) : "-"}</span>
                  <span className="caption">Inició: {run.started_by_name || "-"} · Finalizó: {run.finished_by_name || "-"}</span>
                </div>
                <IconChevronRight />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20 }}>
            <Pager
              page={page}
              totalPages={Math.max(1, Math.ceil(runs.length / pageSize))}
              onPrev={() => setPage((prev) => Math.max(1, prev - 1))}
              onNext={() => setPage((prev) => Math.min(Math.ceil(runs.length / pageSize), prev + 1))}
            />
          </div>
        </div>
      )}
    </div>
  );
}
