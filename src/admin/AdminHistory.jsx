import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { apiUrl } from "../api";
import LoadingState from "../ui/LoadingState";
import SkeletonCards from "../ui/SkeletonCards";

export default function AdminHistory({ onBack }) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    void (async () => {
      setLoading(true);

      try {
        const token = await getToken();
        if (!token) {
          alert("Sesión expirada");
          if (alive) setRuns([]);
          return;
        }

        const res = await fetch(apiUrl("/admin/history"), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const json = await res.json();

        if (!res.ok) {
          alert(json?.error || "No se pudo cargar historial");
          if (alive) setRuns([]);
          return;
        }

        if (alive) {
          setRuns(Array.isArray(json) ? json : []);
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

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token;
  };

  const openRun = async (runId) => {
    setDetailLoading(true);

    try {
      const token = await getToken();
      if (!token) {
        alert("Sesión expirada");
        return;
      }

      const res = await fetch(apiUrl(`/admin/history/${runId}`), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json?.error || "No se pudo cargar el detalle");
        return;
      }

      setSelected(json);
    } finally {
      setDetailLoading(false);
    }
  };

  const downloadExcel = async (runId) => {
    const token = await getToken();
    if (!token) {
      alert("Sesión expirada");
      return;
    }

    const res = await fetch(apiUrl(`/admin/history/${runId}/excel`), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      alert(text || "No se pudo descargar Excel");
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
                ? new Date(selected.run.trip_departure_datetime).toLocaleString()
                : "-"}
            </p>
            <p>
              <b>Finalizado:</b>{" "}
              {selected.run?.finished_at
                ? new Date(selected.run.finished_at).toLocaleString()
                : "-"}
            </p>
          </div>

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

        {loading ? (
          <>
            <LoadingState label="Cargando historial..." compact />
            <SkeletonCards count={3} />
          </>
        ) : runs.length === 0 ? (
          <p className="empty">No hay recorridos finalizados.</p>
        ) : (
          <div className="grid">
            {runs.map((run) => (
              <div key={run.id} className="list-item stack-sm">
                <div><b>{run.trip_name || `Trip ${run.trip_id}`}</b></div>
                <div className="muted">
                  Fecha traslado: {run.trip_departure_datetime ? new Date(run.trip_departure_datetime).toLocaleString() : "-"}
                </div>
                <div className="muted">
                  Finalizado: {run.finished_at ? new Date(run.finished_at).toLocaleString() : "-"}
                </div>
                <button onClick={() => openRun(run.id)} disabled={detailLoading}>
                  {detailLoading ? "Cargando..." : "Ver detalle"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
