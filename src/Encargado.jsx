import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { IconLogout } from "./ui/icons";
import { apiUrl } from "./api";

export default function Encargado() {
  const [trips, setTrips] = useState([]);
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
  const [lastFinishedAt, setLastFinishedAt] = useState(null);

  const getAuthHeader = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;

    if (!token) {
      throw new Error("Sesión expirada");
    }

    return { Authorization: `Bearer ${token}` };
  };

  const loadTrips = useCallback(async () => {
    try {
      const authHeader = await getAuthHeader();
      const res = await fetch(apiUrl("/trips"), {
        headers: authHeader,
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data?.error || "No se pudieron cargar los viajes");
        setTrips([]);
        return;
      }

      setTrips(Array.isArray(data) ? data : []);
    } catch (err) {
      alert(err.message || "No se pudieron cargar los viajes");
      setTrips([]);
    }
  }, []);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  const loadTripData = async (tripId) => {
    setLoadingList(true);

    try {
      const authHeader = await getAuthHeader();

      const [stateRes, passengersRes, dashboardRes] = await Promise.all([
        fetch(apiUrl(`/encargado/trips/${tripId}/state`), {
          headers: authHeader,
        }),
        fetch(apiUrl(`/encargado/trips/${tripId}/passengers`), {
          headers: authHeader,
        }),
        fetch(apiUrl(`/encargado/trips/${tripId}/dashboard`), {
          headers: authHeader,
        }),
      ]);

      const stateJson = await stateRes.json();
      const passengersJson = await passengersRes.json();
      const dashboardJson = await dashboardRes.json();

      if (stateRes.ok) {
        setTripClosed(stateJson.tripStatus === "closed");
        setStarted(Boolean(stateJson.hasActiveRun));
        setCanManage(Boolean(stateJson.canManage));
        setActiveController(stateJson.activeController || null);
        setStartedAt(stateJson.activeRunStartedAt || null);
        setLastFinishedAt(stateJson.lastFinishedAt || null);
      }

      setGroups(Array.isArray(passengersJson) ? passengersJson : []);
      setDashboard(dashboardRes.ok ? dashboardJson : null);
    } finally {
      setLoadingList(false);
    }
  };

  const startTrip = async () => {
    if (!selectedTrip) return;

    let authHeader;
    try {
      authHeader = await getAuthHeader();
    } catch (err) {
      alert(err.message);
      return;
    }

    const res = await fetch(
      apiUrl(`/encargado/trips/${selectedTrip.id}/start`),
      {
        method: "POST",
        headers: authHeader,
      }
    );

    const json = await res.json();

    if (!res.ok) {
      alert(json?.error || "No se pudo iniciar el recorrido");
      return;
    }

    setStarted(true);
    setTripClosed(true);
    setFinished(false);
    setCanManage(true);
    setStartedAt(json.startedAt || new Date().toISOString());
    await loadTripData(selectedTrip.id);
  };

  const toggleBoarded = async (reservationId, boarded) => {
    let authHeader;
    try {
      authHeader = await getAuthHeader();
    } catch (err) {
      alert(err.message);
      return;
    }

    const res = await fetch(
      apiUrl(`/encargado/reservations/${reservationId}/boarded`),
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({ boarded }),
      }
    );

    const json = await res.json();

    if (!res.ok) {
      alert(json?.error || "No se pudo actualizar asistencia");
      return;
    }

    await loadTripData(selectedTrip.id);
  };

  const finishTrip = async () => {
    if (!selectedTrip) return;

    if (!started && !tripClosed) {
      alert("Primero iniciá el recorrido.");
      return;
    }

    let authHeader;
    try {
      authHeader = await getAuthHeader();
    } catch (err) {
      alert(err.message);
      return;
    }

    const res = await fetch(
      apiUrl(`/encargado/trips/${selectedTrip.id}/finish`),
      {
        method: "POST",
        headers: authHeader,
      }
    );

    const json = await res.json();

    if (!res.ok) {
      alert(json?.error || "No se pudo finalizar el recorrido");
      return;
    }

    alert(`Recorrido finalizado. Historial run #${json.runId}`);
    setFinished(true);
    setLastFinishedAt(json.finishedAt || new Date().toISOString());
    setSelectedTrip(null);
    setStarted(false);
    setTripClosed(false);
    setGroups([]);
    setDashboard(null);
    await loadTrips();
  };

  const idaTrips = trips.filter((trip) => trip.type === "ida");
  const vueltaTrips = trips.filter((trip) => trip.type === "vuelta");

  const selectTrip = async (trip) => {
    setSelectedTrip(trip);
    setTripClosed(trip.status === "closed");
    setStarted(trip.status === "closed");
    setFinished(false);
    setCanManage(true);
    setActiveController(null);
    setStartedAt(null);
    setLastFinishedAt(null);

    await loadTripData(trip.id);
  };

  // PASO 1: elegir viaje
  if (!selectedTrip) {
    return (
      <div className="page stack">
        <div className="card stack">
          <div className="row-between">
            <div>
              <h1 className="title">🧑‍✈️ Panel Encargado</h1>
              <p className="subtitle">Seleccionar viaje</p>
            </div>
            <button className="btn-secondary btn-with-icon" onClick={() => supabase.auth.signOut()}>
              <IconLogout />
              Cerrar sesión
            </button>
          </div>

          <h3 className="section-title">Traslados de ida</h3>
          <div className="trip-grid">
            {idaTrips.length === 0 ? (
              <p className="empty">No hay traslados de ida.</p>
            ) : (
              idaTrips.map((trip) => (
                <div key={trip.id} className="list-item">
                  <button onClick={() => selectTrip(trip)}>
                    {trip.name || `Viaje ${trip.id}`} - {trip.status}
                  </button>
                </div>
              ))
            )}
          </div>

          <hr className="divider" />

          <h3 className="section-title">Traslados de vuelta</h3>
          <div className="trip-grid">
            {vueltaTrips.length === 0 ? (
              <p className="empty">No hay traslados de vuelta.</p>
            ) : (
              vueltaTrips.map((trip) => (
                <div key={trip.id} className="list-item">
                  <button onClick={() => selectTrip(trip)}>
                    {trip.name || `Viaje ${trip.id}`} - {trip.status}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // PASO 2: control del recorrido
  return (
    <div className="page stack">
      <div className="card stack">
        <div className="row-between">
          <div>
            <h1 className="title">Recorrido encargado</h1>
            <p className="subtitle">
              {selectedTrip.name || `Viaje ${selectedTrip.id}`} - {selectedTrip.type}
            </p>
          </div>
          <div className="row">
            <button className="btn-secondary" onClick={() => setSelectedTrip(null)}>Volver</button>
            <button className="btn-secondary btn-with-icon" onClick={() => supabase.auth.signOut()}>
              <IconLogout />
              Cerrar sesión
            </button>
          </div>
        </div>

        {startedAt && (
          <p className="muted">Hora de inicio: {new Date(startedAt).toLocaleString()}</p>
        )}

        {lastFinishedAt && (
          <p className="muted">Última finalización: {new Date(lastFinishedAt).toLocaleString()}</p>
        )}

        {!started ? (
          <button onClick={startTrip} disabled={tripClosed || finished || !canManage}>
            Iniciar recorrido (cierra inscripción)
          </button>
        ) : (
          <button onClick={finishTrip} disabled={finished || !canManage}>
            Finalizar recorrido y guardar historial
          </button>
        )}

        {!canManage && (
          <p className="empty">
            Modo lectura: otro encargado tiene el control del recorrido.
            {activeController?.name ? ` Encargado en control: ${activeController.name}.` : ""}
          </p>
        )}

        {started && (
          <>
            <hr className="divider" />

            {dashboard && (
              <p>
                <span className="badge">Total: {dashboard.total}</span>{" "}
                <span className="badge badge-success">Presentes: {dashboard.boarded}</span>{" "}
                <span className="badge badge-warning">Ausentes: {dashboard.missing}</span>
              </p>
            )}

            {loadingList ? (
              <p className="empty">Cargando lista...</p>
            ) : groups.length === 0 ? (
              <p className="empty">No hay pasajeros confirmados.</p>
            ) : (
              <div className="grid">
                {groups.map((group) => (
                  <div key={group.stopId} className="list-item stack-sm">
                    <b>{group.stop}</b> {group.time ? `(${group.time})` : ""}

                    {group.passengers.map((p) => (
                      <div key={p.reservationId} className="row-between">
                        <span>{p.name} - {p.phone || "Sin teléfono"} - {p.boarded ? "✅ Presente" : "❌ Ausente"}</span>
                        <div className="row">
                          <button onClick={() => toggleBoarded(p.reservationId, true)} disabled={!canManage}>Marcar presente</button>
                          <button className="btn-secondary" onClick={() => toggleBoarded(p.reservationId, false)} disabled={!canManage}>Marcar ausente</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
