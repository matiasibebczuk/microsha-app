import { useEffect, useState } from "react";
import AdminTrips from "./admin/AdminTrips";
import AdminHistory from "./admin/AdminHistory";
import AdminCreateTrip from "./admin/AdminCreateTrip";
import AdminSanctions from "./admin/AdminSanctions";
import TemplateManager from "./TemplateManager";
import { supabase } from "./supabase";
import { IconLogout } from "./ui/icons";
import { apiUrl } from "./api";
import { useSessionToken } from "./hooks/useSessionToken";
import MessageBanner from "./ui/MessageBanner";
import { formatTripTitle, formatTimeLabel } from "./utils/format";

export default function Admin() {
  const SHOW_ACTIVE_TRIPS_TITLE = false;
  const WEEK_DAYS = [
    { value: 0, label: "Domingo" },
    { value: 1, label: "Lunes" },
    { value: 2, label: "Martes" },
    { value: 3, label: "Miércoles" },
    { value: 4, label: "Jueves" },
    { value: 5, label: "Viernes" },
    { value: 6, label: "Sábado" },
  ];
  const [view, setView] = useState("list");
  const [notice, setNotice] = useState("");
  const [tripsPaused, setTripsPaused] = useState(false);
  const [scheduledPauseEnabled, setScheduledPauseEnabled] = useState(false);
  const [scheduledPauseDay, setScheduledPauseDay] = useState("1");
  const [scheduledPauseTime, setScheduledPauseTime] = useState("08:00");
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [togglingPause, setTogglingPause] = useState(false);
  const [copyingTrips, setCopyingTrips] = useState(false);
  const getAccessToken = useSessionToken();

  const scheduledDayLabel = WEEK_DAYS.find((day) => String(day.value) === String(scheduledPauseDay))?.label || "-";
  const scheduledLabel = `Programado para los ${scheduledDayLabel} - ${formatTimeLabel(scheduledPauseTime)}`;

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
        setScheduledPauseEnabled(Boolean(json?.scheduledPauseEnabled));
        setScheduledPauseDay(String(json?.scheduledPauseDay ?? "1"));
        setScheduledPauseTime(String(json?.scheduledPauseTime || "08:00").slice(0, 5));
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
      const tripTitle = formatTripTitle(trip?.name, firstTime, trip?.id);

      const lines = [
        tripTitle,
        "Encargado:",
        ...orderedStops.map((stop) => `${stop?.name || "Sin parada"} - ${formatTimeLabel(stop?.time)}`),
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

  const saveScheduledPause = async () => {
    if (savingSchedule) return;
    setSavingSchedule(true);
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
          scheduledPauseEnabled: true,
          scheduledPauseDay: Number(scheduledPauseDay),
          scheduledPauseTime,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(json?.error || "No se pudo programar la pausa");
        return;
      }

      setScheduledPauseEnabled(Boolean(json?.scheduledPauseEnabled));
      setScheduledPauseDay(String(json?.scheduledPauseDay ?? scheduledPauseDay));
      setScheduledPauseTime(String(json?.scheduledPauseTime || scheduledPauseTime).slice(0, 5));
      setShowScheduleModal(false);
      setNotice("Pausa semanal programada");
    } catch {
      setNotice("Error de red");
    } finally {
      setSavingSchedule(false);
    }
  };

  const disableScheduledPause = async () => {
    if (savingSchedule) return;
    setSavingSchedule(true);
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
          scheduledPauseEnabled: false,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(json?.error || "No se pudo quitar la programación");
        return;
      }

      setScheduledPauseEnabled(Boolean(json?.scheduledPauseEnabled));
      setShowScheduleModal(false);
      setNotice("Programación de pausa desactivada");
    } catch {
      setNotice("Error de red");
    } finally {
      setSavingSchedule(false);
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

  if (view === "sanctions") {
    return <AdminSanctions onBack={() => setView("list")} />;
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
          <button className="list-item row-between" onClick={() => setView("sanctions")}>
            <span className="body">Sanciones</span>
            <span className="badge">Gestionar</span>
          </button>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.55rem" }}>
            <button className="btn-secondary" onClick={toggleTripsPause} disabled={togglingPause}>
              {togglingPause ? "Actualizando..." : tripsPaused ? "Reactivar Traslados" : "Pausar Traslados"}
            </button>
            <button className="btn-secondary" onClick={copyTrips} disabled={copyingTrips}>
              {copyingTrips ? "Copiando..." : "Copiar traslados"}
            </button>
          </div>
          <button className="btn-secondary" onClick={() => setShowScheduleModal(true)}>
            Programar pausa de traslados
          </button>
          {scheduledPauseEnabled ? <p className="caption">{scheduledLabel}</p> : null}
        </div>
      </div>

      <div className="stack">
        <div className="inset-group">
          {SHOW_ACTIVE_TRIPS_TITLE ? <h3 className="subheadline">Traslados activos</h3> : null}
          <AdminTrips />
        </div>
      </div>

      {showScheduleModal ? (
        <div
          role="dialog"
          aria-modal="true"
          className="page fade-up"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 55,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setShowScheduleModal(false)}
        >
          <div
            className="card glass-card stack-sm"
            style={{ width: "100%", maxWidth: "520px", padding: "20px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row-between">
              <h3 className="headline" style={{ margin: 0 }}>Programar pausa semanal</h3>
              <button className="btn-secondary" type="button" onClick={() => setShowScheduleModal(false)} disabled={savingSchedule}>
                Cerrar
              </button>
            </div>
            <div className="divider" />
            <div className="row">
              <select style={{ flex: 1 }} value={scheduledPauseDay} onChange={(e) => setScheduledPauseDay(e.target.value)}>
                {WEEK_DAYS.map((day) => (
                  <option key={day.value} value={String(day.value)}>{day.label}</option>
                ))}
              </select>
              <input style={{ flex: 1 }} type="time" value={scheduledPauseTime} onChange={(e) => setScheduledPauseTime(e.target.value)} />
            </div>
            <p className="caption">{scheduledLabel}</p>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn-primary" type="button" onClick={saveScheduledPause} disabled={savingSchedule} style={{ flex: 1 }}>
                {savingSchedule ? "Guardando..." : "Guardar programación"}
              </button>
              <button className="btn-secondary" type="button" onClick={disableScheduledPause} disabled={savingSchedule} style={{ flex: 1 }}>
                Quitar programación
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
