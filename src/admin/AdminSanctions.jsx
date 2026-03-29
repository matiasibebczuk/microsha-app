import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "../api";
import MessageBanner from "../ui/MessageBanner";
import LoadingState from "../ui/LoadingState";
import EmptyState from "../ui/EmptyState";
import { useSessionToken } from "../hooks/useSessionToken";
import { formatDateTime } from "../utils/format";

function formatReason(reason) {
  const text = String(reason || "").trim();
  return text || "Sanción manual";
}

export default function AdminSanctions({ onBack }) {
  const getToken = useSessionToken();
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [activeSanctions, setActiveSanctions] = useState([]);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [reasonDraft, setReasonDraft] = useState({});
  const [sanctioningUserId, setSanctioningUserId] = useState(null);
  const [removingUserId, setRemovingUserId] = useState(null);

  const activeIds = useMemo(() => new Set(activeSanctions.map((item) => String(item.id))), [activeSanctions]);

  const loadActiveSanctions = async () => {
    setLoading(true);
    setNotice("");
    try {
      const token = await getToken();
      if (!token) {
        setNotice("Sesión expirada");
        setActiveSanctions([]);
        return;
      }

      const res = await fetch(apiUrl("/admin/sanctions"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => []);

      if (!res.ok) {
        setNotice(json?.error || "No se pudieron cargar sanciones");
        setActiveSanctions([]);
        return;
      }

      setActiveSanctions(Array.isArray(json) ? json : []);
    } catch {
      setNotice("Error de red");
      setActiveSanctions([]);
    } finally {
      setLoading(false);
    }
  };

  const runSearch = async () => {
    const q = String(search || "").trim();
    if (!q) {
      setResults([]);
      return;
    }

    setSearching(true);
    setNotice("");
    try {
      const token = await getToken();
      if (!token) {
        setNotice("Sesión expirada");
        setResults([]);
        return;
      }

      const res = await fetch(apiUrl(`/admin/sanctions/search?q=${encodeURIComponent(q)}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => []);

      if (!res.ok) {
        setNotice(json?.error || "No se pudo buscar pasajeros");
        setResults([]);
        return;
      }

      setResults(Array.isArray(json) ? json : []);
    } catch {
      setNotice("Error de red");
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const createManualSanction = async (userId) => {
    if (sanctioningUserId) return;
    setSanctioningUserId(userId);
    setNotice("");

    try {
      const token = await getToken();
      if (!token) {
        setNotice("Sesión expirada");
        return;
      }

      const reason = formatReason(reasonDraft[userId]);
      const res = await fetch(apiUrl("/admin/sanctions"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, reason, days: 7 }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(json?.error || "No se pudo aplicar la sanción");
        return;
      }

      setReasonDraft((prev) => ({ ...prev, [userId]: "" }));
      setNotice("Sanción aplicada por 7 días");
      await loadActiveSanctions();
      await runSearch();
    } catch {
      setNotice("Error de red");
    } finally {
      setSanctioningUserId(null);
    }
  };

  const removeSanction = async (userId) => {
    if (removingUserId) return;
    setRemovingUserId(userId);
    setNotice("");

    try {
      const token = await getToken();
      if (!token) {
        setNotice("Sesión expirada");
        return;
      }

      const res = await fetch(apiUrl(`/admin/sanctions/${userId}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setNotice(json?.error || "No se pudo quitar la sanción");
        return;
      }

      setNotice("Sanción removida");
      await loadActiveSanctions();
      await runSearch();
    } catch {
      setNotice("Error de red");
    } finally {
      setRemovingUserId(null);
    }
  };

  useEffect(() => {
    void loadActiveSanctions();
  }, []);

  return (
    <div className="page fade-up">
      <header className="row-between" style={{ marginBottom: 24 }}>
        <h1 className="large-title">Sanciones</h1>
        <button className="btn-secondary" onClick={onBack}>Volver</button>
      </header>

      <MessageBanner message={notice} />

      <div className="inset-group">
        <h3 className="subheadline">Buscar pasajero</h3>
        <div className="row">
          <input
            placeholder="Nombre, DNI o número de socio"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void runSearch();
              }
            }}
          />
          <button className="btn-primary" onClick={() => void runSearch()} disabled={searching}>
            {searching ? "Buscando..." : "Buscar"}
          </button>
        </div>
      </div>

      <div className="inset-group" style={{ marginTop: 16 }}>
        <h3 className="subheadline">Sancionados activos</h3>
        {loading ? (
          <LoadingState compact />
        ) : activeSanctions.length === 0 ? (
          <EmptyState title="Sin sanciones activas" subtitle="No hay pasajeros suspendidos en este momento." />
        ) : (
          <div className="inset-list">
            {activeSanctions.map((row) => (
              <div key={row.id} className="list-item row-between">
                <div className="stack-sm">
                  <span className="body"><b>{row.name || `Usuario ${row.id}`}</b></span>
                  <span className="caption">Hasta: {formatDateTime(row.suspended_until)}</span>
                  <span className="caption">Motivo: {row.suspension_reason || "-"}</span>
                </div>
                <button
                  className="btn-secondary"
                  onClick={() => void removeSanction(row.id)}
                  disabled={removingUserId === row.id}
                >
                  {removingUserId === row.id ? "Quitando..." : "Quitar"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="inset-group" style={{ marginTop: 16 }}>
        <h3 className="subheadline">Crear sanción manual (7 días)</h3>
        {results.length === 0 ? (
          <p className="caption">Buscá un pasajero para sancionar o revisar su estado.</p>
        ) : (
          <div className="inset-list">
            {results.map((row) => {
              const isActive = activeIds.has(String(row.id));
              return (
                <div key={row.id} className="list-item stack-sm">
                  <div className="row-between" style={{ alignItems: "flex-start" }}>
                    <div className="stack-sm">
                      <span className="body"><b>{row.name || `Usuario ${row.id}`}</b></span>
                      <span className="caption">DNI: {row.dni || "-"} · Socio: {row.member_number || "-"}</span>
                      <span className="caption">Racha ausencias: {Number(row.no_show_streak || 0)}</span>
                      {isActive && row.suspended_until ? (
                        <span className="caption">Suspendido hasta: {formatDateTime(row.suspended_until)}</span>
                      ) : (
                        <span className="caption">Sin sanción activa</span>
                      )}
                    </div>
                  </div>

                  <input
                    placeholder="Motivo de sanción (opcional)"
                    value={reasonDraft[row.id] || ""}
                    onChange={(e) => setReasonDraft((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  />

                  <div className="row" style={{ gap: 8 }}>
                    <button
                      className="btn-primary"
                      onClick={() => void createManualSanction(row.id)}
                      disabled={isActive || sanctioningUserId === row.id}
                    >
                      {sanctioningUserId === row.id ? "Sancionando..." : isActive ? "Ya sancionado" : "Sancionar 7 días"}
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => void removeSanction(row.id)}
                      disabled={!isActive || removingUserId === row.id}
                    >
                      {removingUserId === row.id ? "Quitando..." : "Quitar sanción"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
