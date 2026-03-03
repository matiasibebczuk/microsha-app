import { useEffect, useState } from "react";
import { apiUrl } from "../api";
import LoadingState from "../ui/LoadingState";
import SkeletonCards from "../ui/SkeletonCards";
import MessageBanner from "../ui/MessageBanner";
import EmptyState from "../ui/EmptyState";
import Pager from "../ui/Pager";
import { useSessionToken } from "../hooks/useSessionToken";
import { formatDateTime } from "../utils/format";

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
        if (!token) {
          if (alive) setRuns([]);
          if (alive) setError("Sesión expirada");
          return;
        }

        const res = await fetch(apiUrl("/admin/history"), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const json = await res.json();

        if (!res.ok) {
          if (alive) setRuns([]);
          if (alive) setError(json?.error || "No se pudo cargar historial");
          return;
        }

        if (alive) {
          setRuns(Array.isArray(json) ? json : []);
          setPage(1);
        }
      } catch {
        if (alive) {
          setRuns([]);
          setError("No se pudo conectar para cargar historial");
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const openRun = async (runId) => {
    setDetailLoading(true);

    try {
      const token = await getToken();
      if (!token) {
        setError("Sesión expirada");
        return;
      }

      const res = await fetch(apiUrl(`/admin/history/${runId}`), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json?.error || "No se pudo cargar el detalle");
        return;
      }

      setError("");
      setSelected(json);
    } finally {
      setDetailLoading(false);
    }
  };

  const downloadExcel = async (runId) => {
    const token = await getToken();
    if (!token) {
      setError("Sesión expirada");
      return;
    }

    const res = await fetch(apiUrl(`/admin/history/${runId}/excel`), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      setError(text || "No se pudo descargar Excel");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `run-${runId}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (selected) {
    return (
      <div className="page stack">
        <div className="card stack">
          <h1 className="title">📜 Detalle del recorrido</h1>

          <div className="stack-sm muted">
            <p><b>Traslado:</b> {selected.run?.trip_name || `Trip ${selected.run?.trip_id || "-"}`}</p>
            <p>
              <b>Fecha del traslado:</b>{" "}
              {selected.run?.trip_departure_datetime
                ? formatDateTime(selected.run.trip_departure_datetime)
                : "-"}
            </p>
            <p>
              <b>Finalizado:</b>{" "}
              {selected.run?.finished_at
                ? formatDateTime(selected.run.finished_at)
                : "-"}
            </p>
          </div>

          <MessageBanner message={error} />

          <p>
            <span className="badge">Total: {selected.summary?.total || 0}</span>{" "}
            <span className="badge badge-success">Subieron: {selected.summary?.boarded || 0}</span>{" "}
            <span className="badge badge-warning">No subieron: {selected.summary?.missing || 0}</span>
          </p>

          <div className="row">
            <button onClick={() => downloadExcel(selected.run.id)}>Descargar Excel</button>
            <button className="btn-secondary" onClick={() => setSelected(null)}>Volver al historial</button>
          </div>

          <hr className="divider" />

          <div className="grid">
            {(selected.passengers || []).map((p, index) => (
              <div key={`${p.user_name}-${index}`} className="list-item">
                {p.user_name || "Sin nombre"} - {p.phone || "Sin teléfono"} - {p.stop_name || "Sin parada"} - {p.boarded ? "✅ Subió" : "❌ No subió"}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page stack">
      <div className="card stack">
        <div className="row-between">
          <h1 className="title">📜 Historial</h1>
          {onBack && <button className="btn-secondary" onClick={onBack}>Volver</button>}
        </div>

        <MessageBanner message={error} />

        {loading ? (
          <>
            <LoadingState label="Cargando historial..." compact />
            <SkeletonCards count={3} />
          </>
        ) : runs.length === 0 ? (
          <EmptyState
            title="No hay recorridos finalizados"
            subtitle="Cuando finalices recorridos aparecerán aquí."
          />
        ) : (
          <div className="grid">
            {runs
              .slice((page - 1) * pageSize, page * pageSize)
              .map((run) => (
              <div key={run.id} className="list-item stack-sm">
                <div><b>{run.trip_name || `Trip ${run.trip_id}`}</b></div>
                <div className="muted">
                  Fecha traslado: {run.trip_departure_datetime ? formatDateTime(run.trip_departure_datetime) : "-"}
                </div>
                <div className="muted">
                  Finalizado: {run.finished_at ? formatDateTime(run.finished_at) : "-"}
                </div>
                <button onClick={() => openRun(run.id)} disabled={detailLoading}>
                  {detailLoading ? "Cargando..." : "Ver detalle"}
                </button>
              </div>
            ))}

            <Pager
              page={page}
              totalPages={Math.max(1, Math.ceil(runs.length / pageSize))}
              onPrev={() => setPage((prev) => Math.max(1, prev - 1))}
              onNext={() =>
                setPage((prev) => Math.min(Math.ceil(runs.length / pageSize), prev + 1))
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
