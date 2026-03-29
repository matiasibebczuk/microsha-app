import { useEffect, useState } from "react";
import AdminTrips from "./admin/AdminTrips";
import AdminHistory from "./admin/AdminHistory";
import AdminCreateTrip from "./admin/AdminCreateTrip";
import TemplateManager from "./TemplateManager";
import { supabase } from "./supabase";
import { IconLogout } from "./ui/icons";
import { apiUrl } from "./api";
import { useSessionToken } from "./hooks/useSessionToken";
import MessageBanner from "./ui/MessageBanner";

export default function Admin() {
  const [view, setView] = useState("list");
  const [notice, setNotice] = useState("");
  const [tripsPaused, setTripsPaused] = useState(false);
  const [togglingPause, setTogglingPause] = useState(false);
  const [copyingTrips, setCopyingTrips] = useState(false);
  const getAccessToken = useSessionToken();

  const loadFlags = async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(apiUrl("/admin/system/flags"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setTripsPaused(Boolean(json?.tripsPaused));
      }
    } catch {
      return;
    }
  };

  const toggleTripsPause = async () => {
    if (togglingPause) return;
    setTogglingPause(true);
    setNotice("");
    try {
      const token = await getAccessToken();
      if (!token) {
        setNotice("Sesión expirada");
        return;
      }

      const res = await fetch(apiUrl("/admin/system/flags"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tripsPaused: !tripsPaused,
          pauseMessage: "En mantenimiento, prueba mas tarde",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(json?.error || "No se pudo actualizar el estado");
        return;
      }
      setTripsPaused(Boolean(json?.tripsPaused));
      setNotice(Boolean(json?.tripsPaused) ? "Traslados pausados" : "Traslados reactivados");
    } catch {
      setNotice("Error de red");
    } finally {
      setTogglingPause(false);
    }
  };

  const buildTripCopyText = async () => {
    const token = await getAccessToken();
    if (!token) throw new Error("Sesión expirada");

    const tripsRes = await fetch(apiUrl("/trips"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const tripsJson = await tripsRes.json().catch(() => ([]));
    if (!tripsRes.ok) throw new Error(tripsJson?.error || "No se pudieron cargar traslados");

    const trips = Array.isArray(tripsJson) ? tripsJson : [];
    const withStops = await Promise.all(
      trips.map(async (trip) => {
        const res = await fetch(apiUrl(`/trips/${trip.id}/stops`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ([]));
        return {
          trip,
          stops: Array.isArray(json) ? json : [],
        };
      })
    );

    const bucket = {
      ida: [],
      vuelta: [],
    };

    withStops.forEach(({ trip, stops }) => {
      const normalizedType = String(trip?.type || "").trim().toLowerCase();
      const section = normalizedType.startsWith("ida") ? "ida" : "vuelta";
      const orderedStops = [...stops].sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0));
      const firstTime = orderedStops[0]?.time || trip?.first_time || "-";

      const lines = [
        `${trip?.name || `Traslado ${trip?.id || ""}`} + ${firstTime}`.trim(),
        "Encargado:",
        ...orderedStops.map((stop) => `${stop?.name || "Sin parada"} + ${stop?.time || "-"}`),
        "",
      ];

      bucket[section].push(lines.join("\n"));
    });

    const idaBlock = ["IDA", "", ...(bucket.ida.length > 0 ? bucket.ida : ["Sin traslados", ""])].join("\n");
    const vueltaBlock = ["VUELTA", "", ...(bucket.vuelta.length > 0 ? bucket.vuelta : ["Sin traslados", ""])].join("\n");

    return `${idaBlock}\n\n${vueltaBlock}`.trim();
  };

  const copyTrips = async () => {
    if (copyingTrips) return;
    setCopyingTrips(true);
    setNotice("");
    try {
      const text = await buildTripCopyText();
      await navigator.clipboard.writeText(text);
      setNotice("Traslados copiados al portapapeles");
    } catch (err) {
      setNotice(err?.message || "No se pudieron copiar los traslados");
    } finally {
      setCopyingTrips(false);
    }
  };

  useEffect(() => {
    void loadFlags();
  }, []);

  if (view === "create") {
    return <AdminCreateTrip onCreated={() => setView("list")} />;
  }

  if (view === "history") {
    return <AdminHistory onBack={() => setView("list")} />;
  }

  if (view === "templates") {
    return <TemplateManager onBack={() => setView("list")} />;
  }

  return (
    <div className="page fade-up">
      <header className="row-between">
        <div className="stack-sm">
          <h1 className="large-title">Panel Admin</h1>
          <p className="caption">Gestioná traslados y recorridos</p>
        </div>
        <button className="btn-secondary btn-with-icon" onClick={() => supabase.auth.signOut()}>
          <IconLogout />
          Salir
        </button>
      </header>

      <MessageBanner message={notice} variant="info" />

      <div className="inset-group">
        <h3 className="subheadline">Acciones principales</h3>
        <div className="grid">
          <button className="list-item row-between" onClick={() => setView("create")}>
            <span className="body"><b>Crear nuevo traslado</b></span>
            <span className="badge">Nuevo</span>
          </button>
          <button className="list-item row-between" onClick={() => setView("templates")}>
            <span className="body">Paradas predeterminadas</span>
            <span className="badge">Gestionar</span>
          </button>
          <button className="list-item row-between" onClick={() => setView("history")}>
            <span className="body">Historial de viajes</span>
            <span className="badge">Ver</span>
          </button>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.55rem" }}>
            <button className="btn-secondary" onClick={toggleTripsPause} disabled={togglingPause}>
              {togglingPause ? "Actualizando..." : tripsPaused ? "Reactivar Traslados" : "Pausar Traslados"}
            </button>
            <button className="btn-secondary" onClick={copyTrips} disabled={copyingTrips}>
              {copyingTrips ? "Copiando..." : "Copiar traslados"}
            </button>
          </div>
        </div>
      </div>

      <div className="stack">
        <div className="inset-group">
          <h3 className="subheadline">Traslados activos</h3>
          <AdminTrips />
        </div>
      </div>
    </div>
  );
}
