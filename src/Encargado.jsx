import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { IconLogout, IconChevronRight } from "./ui/icons";
import { apiUrl } from "./api";
import LoadingState from "./ui/LoadingState";
import SkeletonCards from "./ui/SkeletonCards";
import MessageBanner from "./ui/MessageBanner";
import EmptyState from "./ui/EmptyState";
import { useSessionToken } from "./hooks/useSessionToken";
import { formatDateTime, formatTripStatus, formatTripTitle, sortTrasladosByHora } from "./utils/format";
import { fetchWithRetry } from "./lib/fetchWithRetry";

export default function Encargado() {
  const LOCATION_INTERVAL_MS = 30000;
  const getAuthToken = useSessionToken();
  const [trips, setTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [started, setStarted] = useState(false);
  const [groups, setGroups] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [tripClosed, setTripClosed] = useState(false);
  const [finished, setFinished] = useState(false);
  const [canManage, setCanManage] = useState(true);
  const [activeController, setActiveController] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [notice, setNotice] = useState("");
  const [startingTrip, setStartingTrip] = useState(false);
  const [finishingTrip, setFinishingTrip] = useState(false);
  const [boardingReservationId, setBoardingReservationId] = useState(null);
  const [locationSharing, setLocationSharing] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationLastUpdate, setLocationLastUpdate] = useState(null);
  const [locationLastStop, setLocationLastStop] = useState(null);
  const locationTimerRef = useRef(null);

  const getAuthHeader = useCallback(async () => {
    const token = await getAuthToken();
    if (!token) throw new Error("Sesión expirada");
    return { Authorization: `Bearer ${token}` };
  }, [getAuthToken]);

  const loadTrips = useCallback(async () => {
    setLoadingTrips(true);
    try {
      const authHeader = await getAuthHeader();
      const res = await fetchWithRetry(apiUrl("/trips"), { headers: authHeader });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data?.error || "No se pudieron cargar los viajes");
        setTrips([]);
        return;
      }
      setTrips(Array.isArray(data) ? data : []);
    } catch (err) {
      setNotice(err.message || "No se pudieron cargar los viajes");
      setTrips([]);
    } finally {
      setLoadingTrips(false);
    }
  }, [getAuthHeader]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  const loadTripData = async (tripId) => {
    setLoadingList(true);
    try {
      const authHeader = await getAuthHeader();
      const [stateRes, passengersRes, dashboardRes, locationRes] = await Promise.all([
        fetchWithRetry(apiUrl(`/encargado/trips/${tripId}/state`), { headers: authHeader }),
        fetchWithRetry(apiUrl(`/encargado/trips/${tripId}/passengers`), { headers: authHeader }),
        fetchWithRetry(apiUrl(`/encargado/trips/${tripId}/dashboard`), { headers: authHeader }),
        fetchWithRetry(apiUrl(`/encargado/trips/${tripId}/location/state`), { headers: authHeader }),
      ]);
      const stateJson = await stateRes.json();
      const passengersJson = await passengersRes.json();
      const dashboardJson = await dashboardRes.json();
      const locationJson = await locationRes.json().catch(() => ({}));
      if (stateRes.ok) {
        setTripClosed(stateJson.tripStatus === "closed");
        setStarted(Boolean(stateJson.hasActiveRun));
        setCanManage(Boolean(stateJson.canManage));
        setActiveController(stateJson.activeController || null);
        setStartedAt(stateJson.activeRunStartedAt || null);
      }
      if (locationRes.ok) {
        setLocationSharing(Boolean(locationJson?.active));
        setLocationLastUpdate(locationJson?.last_update_at || null);
        setLocationLastStop(locationJson?.last_stop_name || null);
      }
      setGroups(Array.isArray(passengersJson) ? sortGroupsByTime(passengersJson) : []);
      setDashboard(dashboardRes.ok ? dashboardJson : null);
    } catch (err) {
      setNotice(err?.message || "Error de red. Intentá de nuevo.");
    } finally {
      setLoadingList(false);
    }
  };

  const sendCurrentLocation = useCallback(async (tripId, authHeader) => {
    if (!navigator.geolocation) {
      throw new Error("Tu navegador no soporta geolocalización");
    }

    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 5000,
      });
    });

    const { latitude, longitude, accuracy, heading, speed } = position.coords;
    const res = await fetch(apiUrl(`/encargado/trips/${tripId}/location/update`), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
      },
      body: JSON.stringify({
        latitude,
        longitude,
        accuracy_meters: accuracy,
        heading,
        speed,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || "No se pudo enviar la ubicación");
    }

    setLocationLastUpdate(json?.last_update_at || new Date().toISOString());
  }, []);

  useEffect(() => {
    return () => {
      if (locationTimerRef.current) {
        window.clearInterval(locationTimerRef.current);
        locationTimerRef.current = null;
      }
    };
  }, []);

  const parseTimeToMinutes = (value) => {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return Number.MAX_SAFE_INTEGER;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return Number.MAX_SAFE_INTEGER;
    return hours * 60 + minutes;
  };

  const sortGroupsByTime = (groupsArray) => {
    return [...groupsArray].sort((a, b) => {
      const aMinutes = parseTimeToMinutes(a.time);
      const bMinutes = parseTimeToMinutes(b.time);
      if (aMinutes !== bMinutes) return aMinutes - bMinutes;
      return String(a.stop || "").localeCompare(String(b.stop || ""), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
  };

  const stopLocationSharing = async () => {
    if (!selectedTrip || locationBusy) return;
    setLocationBusy(true);
    try {
      const authHeader = await getAuthHeader();
      const res = await fetch(apiUrl(`/encargado/trips/${selectedTrip.id}/location/stop`), {
        method: "POST",
        headers: authHeader,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json?.error || "No se pudo detener la ubicación");
        return;
      }

      if (locationTimerRef.current) {
        window.clearInterval(locationTimerRef.current);
        locationTimerRef.current = null;
      }

      setLocationSharing(false);
      setNotice("Ubicación detenida");
    } catch (err) {
      alert(err?.message || "No se pudo detener la ubicación");
    } finally {
      setLocationBusy(false);
    }
  };

  const startLocationSharing = async () => {
    if (!selectedTrip || locationBusy) return;
    setLocationBusy(true);
    try {
      const authHeader = await getAuthHeader();
      const startRes = await fetch(apiUrl(`/encargado/trips/${selectedTrip.id}/location/start`), {
        method: "POST",
        headers: authHeader,
      });
      const startJson = await startRes.json().catch(() => ({}));
      if (!startRes.ok) {
        alert(startJson?.error || "No se pudo iniciar la ubicación");
        return;
      }

      await sendCurrentLocation(selectedTrip.id, authHeader);

      if (locationTimerRef.current) {
        window.clearInterval(locationTimerRef.current);
      }

      locationTimerRef.current = window.setInterval(() => {
        void sendCurrentLocation(selectedTrip.id, authHeader).catch((err) => {
          console.error("[location] update error", err);
        });
      }, LOCATION_INTERVAL_MS);

      setLocationSharing(true);
      setNotice("Ubicación compartida cada 30 segundos");
    } catch (err) {
      alert(err?.message || "No se pudo iniciar la ubicación");
    } finally {
      setLocationBusy(false);
    }
  };

  const startTrip = async () => {
    if (!selectedTrip || startingTrip) return;
    setStartingTrip(true);
    let authHeader;
    try {
      try { authHeader = await getAuthHeader(); } catch (err) { alert(err.message); return; }
      const res = await fetch(apiUrl(`/encargado/trips/${selectedTrip.id}/start`), { method: "POST", headers: authHeader });
      const json = await res.json();
      if (!res.ok) { alert(json?.error || "No se pudo iniciar el recorrido"); return; }
      setStarted(true);
      setTripClosed(true);
      setFinished(false);
      setCanManage(true);
      setStartedAt(json.startedAt || new Date().toISOString());
      await loadTripData(selectedTrip.id);
    } finally {
      setStartingTrip(false);
    }
  };

  const toggleBoarded = async (reservationId, boarded) => {
    if (boardingReservationId === reservationId) return;
    setBoardingReservationId(reservationId);
    let authHeader;
    try {
      try { authHeader = await getAuthHeader(); } catch (err) { alert(err.message); return; }
      const res = await fetch(apiUrl(`/encargado/reservations/${reservationId}/boarded`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ boarded }),
      });
      const json = await res.json();
      if (!res.ok) { alert(json?.error || "No se pudo actualizar asistencia"); return; }
      await loadTripData(selectedTrip.id);
    } finally {
      setBoardingReservationId(null);
    }
  };

  const finishTrip = async () => {
    if (!selectedTrip || finishingTrip) return;
    if (!started && !tripClosed) { alert("Primero iniciá el recorrido."); return; }

    const confirmed = window.confirm("¿Seguro que querés finalizar el recorrido? Esta acción cierra el viaje actual.");
    if (!confirmed) return;

    setFinishingTrip(true);
    let authHeader;
    try {
      try { authHeader = await getAuthHeader(); } catch (err) { alert(err.message); return; }
      const res = await fetch(apiUrl(`/encargado/trips/${selectedTrip.id}/finish`), { method: "POST", headers: authHeader });
      const json = await res.json();
      if (!res.ok) { alert(json?.error || "No se pudo finalizar el recorrido"); return; }
      alert(`Recorrido finalizado. Historial run #${json.runId}`);
      if (locationTimerRef.current) {
        window.clearInterval(locationTimerRef.current);
        locationTimerRef.current = null;
      }
      setLocationSharing(false);
      setFinished(true);
      setSelectedTrip(null);
      setStarted(false);
      setTripClosed(false);
      setGroups([]);
      setDashboard(null);
      await loadTrips();
    } finally {
      setFinishingTrip(false);
    }
  };

  const selectTrip = async (trip) => {
    setSelectedTrip(trip);
    setTripClosed(trip.status === "closed");
    setStarted(trip.status === "closed");
    setFinished(false);
    setCanManage(true);
    setActiveController(null);
    setStartedAt(null);
    await loadTripData(trip.id);
  };

  const idaTrips = sortTrasladosByHora(trips.filter((trip) => String(trip.type || "").trim().toLowerCase().startsWith("ida")));
  const vueltaTrips = sortTrasladosByHora(trips.filter((trip) => {
    const normalized = String(trip.type || "").trim().toLowerCase();
    return normalized.startsWith("vuelta") || normalized.startsWith("regreso");
  }));

  const sortedGroups = sortGroupsByTime(groups);

  if (!selectedTrip) {
    return (
      <div className="page fade-up">
        <header className="row-between">
          <div className="stack-sm">
            <h1 className="large-title">Panel Encargado</h1>
            <p className="caption">Seleccionar viaje</p>
          </div>
          <button className="btn-secondary btn-with-icon" onClick={() => supabase.auth.signOut()}>
            <IconLogout />
            Salir
          </button>
        </header>

        <MessageBanner message={notice} />

        <div className="inset-group">
          <h3 className="subheadline">Traslados de Ida</h3>
          <div className="grid">
            {loadingTrips ? (
              <SkeletonCards count={2} />
            ) : idaTrips.length === 0 ? (
              <EmptyState title="No hay traslados de ida" subtitle="Publicá un viaje para comenzar." />
            ) : (
              idaTrips.map((trip) => (
                <button key={trip.id} className="list-item row-between" onClick={() => selectTrip(trip)}>
                  <div className="stack-sm">
                    <span className="body"><b>{formatTripTitle(trip.name, trip.first_time, trip.id)}</b></span>
                    <span className="caption">{formatTripStatus(trip.status)}</span>
                  </div>
                  <IconChevronRight />
                </button>
              ))
            )}
          </div>
        </div>

        <div className="inset-group">
          <h3 className="subheadline">Traslados de Vuelta</h3>
          <div className="grid">
            {loadingTrips ? (
              <SkeletonCards count={2} />
            ) : vueltaTrips.length === 0 ? (
              <EmptyState title="No hay traslados de vuelta" subtitle="Publicá un viaje para comenzar." />
            ) : (
              vueltaTrips.map((trip) => (
                <button key={trip.id} className="list-item row-between" onClick={() => selectTrip(trip)}>
                  <div className="stack-sm">
                    <span className="body"><b>{formatTripTitle(trip.name, trip.first_time, trip.id)}</b></span>
                    <span className="caption">{formatTripStatus(trip.status)}</span>
                  </div>
                  <IconChevronRight />
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page fade-up">
      <header className="row-between">
        <button className="btn-plain" onClick={() => setSelectedTrip(null)}>
          Atrás
        </button>
        {loadingList ? <span className="badge">Actualizando lista...</span> : null}
      </header>

      <section className="stack-sm">
        <h1 className="large-title">{formatTripTitle(selectedTrip.name, selectedTrip.first_time, selectedTrip.id)}</h1>
        <p className="caption">{selectedTrip.type === "ida" ? "Ida" : "Vuelta"} · {started ? "En curso" : "Listo para iniciar"}</p>
      </section>

      <div className="inset-group stack">
        <div className="card stack-sm">
          {!started ? (
            <button className="btn-primary" onClick={startTrip} disabled={tripClosed || finished || !canManage}>
              {startingTrip ? "Iniciando..." : "Iniciar recorrido"}
            </button>
          ) : (
            <button className="btn-danger" onClick={finishTrip} disabled={finished || !canManage || finishingTrip}>
              {finishingTrip ? "Finalizando..." : "Finalizar recorrido"}
            </button>
          )}

          {!canManage && (
            <p className="caption">
              Otro encargado tiene el control.
              {activeController?.name ? ` (${activeController.name})` : ""}
            </p>
          )}

          <div className="row" style={{ marginTop: 6 }}>
            {!locationSharing ? (
              <button className="btn-secondary" onClick={startLocationSharing} disabled={locationBusy || !canManage}>
                {locationBusy ? "Iniciando ubicación..." : "Compartir ubicación"}
              </button>
            ) : (
              <button className="btn-danger" onClick={stopLocationSharing} disabled={locationBusy || !canManage}>
                {locationBusy ? "Deteniendo..." : "Detener ubicación"}
              </button>
            )}
          </div>
          {locationLastUpdate ? <p className="caption">Última ubicación: {formatDateTime(locationLastUpdate)}</p> : null}
          {locationLastStop ? <p className="caption">Última parada marcada presente: {locationLastStop}</p> : null}
        </div>

        {dashboard && (
          <div className="row">
            <span className="badge">Total: {dashboard.total}</span>
            <span className="badge badge-success">Presentes: {dashboard.boarded}</span>
            <span className="badge badge-warning">Ausentes: {dashboard.missing}</span>
            <span className="badge">Espera: {dashboard.waiting || 0}</span>
          </div>
        )}
      </div>

      <MessageBanner message={notice} />

      <div className="stack">
        {loadingList && groups.length === 0 ? (
          <div className="inset-group">
            <SkeletonCards count={2} />
          </div>
        ) : sortedGroups.length === 0 ? (
          <EmptyState title="Sin pasajeros" subtitle="Nadie se anotó para este viaje todavía." />
        ) : (
          sortedGroups.map((group) => (
            <div key={group.stopId} className="inset-group">
              <div className="row-between">
                <h3 className="subheadline">{group.stop} {group.time ? `· ${group.time}` : ""}</h3>
                <div className="row">
                  <span className="badge">
                    {group.passengers.filter((p) => p.status !== "waiting").length} a subir
                  </span>
                  {group.passengers.some((p) => p.status === "waiting") ? (
                    <span className="badge badge-warning">
                      {group.passengers.filter((p) => p.status === "waiting").length} espera
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="grid">
                {group.passengers.map((p) => {
                  const isWaiting = p.status === "waiting";
                  const statusClass = isWaiting
                    ? "badge-warning"
                    : (p.boarded ? "badge-success" : "badge-warning");
                  const statusText = isWaiting
                    ? "En espera"
                    : (p.boarded ? "Presente" : "Ausente");

                  return (
                    <div key={p.reservationId} className="list-item stack-sm">
                      <div className="row-between">
                        <span className="body"><b>{p.name}</b></span>
                        <div className="row">
                          {p.phone ? (
                            <a className="btn-secondary" href={`tel:${p.phone}`}>
                              Llamar
                            </a>
                          ) : (
                            <button className="btn-secondary" type="button" disabled>
                              Sin teléfono
                            </button>
                          )}
                          <span className={`badge ${statusClass}`}>{statusText}</span>
                        </div>
                      </div>
                      <p className="caption">{p.description || "Sin descripción"}</p>

                      {!isWaiting && started ? (
                        <div className="row">
                          <button className="btn-secondary" onClick={() => toggleBoarded(p.reservationId, true)} disabled={!canManage || p.boarded || boardingReservationId === p.reservationId}>
                            Marcar Presente
                          </button>
                          <button className="btn-plain" onClick={() => toggleBoarded(p.reservationId, false)} disabled={!canManage || !p.boarded || boardingReservationId === p.reservationId}>
                            Marcar Ausente
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {startedAt && <p className="caption">Inicio: {formatDateTime(startedAt)}</p>}
    </div>
  );
}
