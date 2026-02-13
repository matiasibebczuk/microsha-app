import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";
import { IconEdit, IconTrash } from "../ui/icons";
import { apiUrl } from "../api";
import LoadingState from "../ui/LoadingState";
import SkeletonCards from "../ui/SkeletonCards";

export default function AdminTrips() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [passengers, setPassengers] = useState([]);
  const [passengersLoading, setPassengersLoading] = useState(false);
  const [passengerFilter, setPassengerFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [promotingId, setPromotingId] = useState(null);
  const [editingTripId, setEditingTripId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("ida");
  const [editDeparture, setEditDeparture] = useState("");
  const [editStops, setEditStops] = useState([]);
  const [editBuses, setEditBuses] = useState([]);
  const [editLoading, setEditLoading] = useState(false);

  const getAccessToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token;
  };

  const loadTrips = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getAccessToken();
      if (!token) {
        setError("Sesión expirada");
        setTrips([]);
        return;
      }

      const res = await fetch(apiUrl("/trips"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json?.error || "No se pudieron cargar los viajes");
        setTrips([]);
        return;
      }

      setTrips(Array.isArray(json) ? json : []);
    } catch {
      setError("Error de red al cargar viajes");
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const startEditTrip = async (trip) => {
    setEditingTripId(trip.id);
    setEditName(trip.name || "");
    setEditType(trip.type || "ida");
    setEditStops([]);
    setEditBuses([]);
    setEditLoading(true);

    if (trip.time) {
      const dt = new Date(trip.time);
      const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setEditDeparture(local);
    } else {
      setEditDeparture("");
    }

    try {
      const token = await getAccessToken();
      if (!token) {
        alert("Sesión expirada");
        return;
      }

      const [stopsRes, busesRes] = await Promise.all([
        fetch(apiUrl(`/trips/${trip.id}/stops`), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch(apiUrl(`/trips/${trip.id}/buses`), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      const [stopsJson, busesJson] = await Promise.all([
        stopsRes.json(),
        busesRes.json(),
      ]);

      if (!stopsRes.ok) {
        alert(stopsJson?.error || "No se pudieron cargar las paradas");
        return;
      }

      if (!busesRes.ok) {
        alert(busesJson?.error || "No se pudieron cargar los vehículos");
        return;
      }

      const normalizedStops = (Array.isArray(stopsJson) ? stopsJson : [])
        .map((stop, index) => ({
          id: stop.id,
          name: stop.name || "",
          time: stop.time || "",
          order: Number(stop.order || index + 1),
        }))
        .sort((a, b) => a.order - b.order);

      const normalizedBuses = (Array.isArray(busesJson) ? busesJson : []).map((bus) => ({
        id: bus.id,
        name: bus.name || "",
        capacity: Number(bus.capacity || 0),
      }));

      setEditStops(normalizedStops);
      setEditBuses(normalizedBuses);
    } finally {
      setEditLoading(false);
    }
  };

  const addEditBus = () => {
    setEditBuses((prev) => [...prev, { id: null, name: "", capacity: 40 }]);
  };

  const updateEditBus = (index, field, value) => {
    setEditBuses((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        [field]: field === "capacity" ? value : value,
      };
      return copy;
    });
  };

  const removeEditBus = (index) => {
    setEditBuses((prev) => prev.filter((_, idx) => idx !== index));
  };

  const addEditStop = () => {
    setEditStops((prev) => [
      ...prev,
      {
        id: null,
        name: "",
        time: "",
        order: prev.length + 1,
      },
    ]);
  };

  const updateEditStop = (index, field, value) => {
    setEditStops((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        [field]: field === "order" ? Number(value || 0) : value,
      };
      return copy;
    });
  };

  const removeEditStop = (index) => {
    setEditStops((prev) =>
      prev
        .filter((_, idx) => idx !== index)
        .map((stop, idx) => ({ ...stop, order: idx + 1 }))
    );
  };

  const normalizeStopOrders = () => {
    setEditStops((prev) => {
      const sorted = [...prev].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
      return sorted.map((stop, index) => ({ ...stop, order: index + 1 }));
    });
  };

  const saveEditTrip = async () => {
    if (!editingTripId) return;

    const token = await getAccessToken();
    if (!token) {
      alert("Sesión expirada");
      return;
    }

    const body = {
      name: editName,
      type: editType,
    };

    if (editDeparture) {
      body.departure_datetime = new Date(editDeparture).toISOString();
    }

    const res = await fetch(apiUrl(`/trips/${editingTripId}`), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const json = await res.json();

    if (!res.ok) {
      alert(json?.error || "No se pudo editar el traslado");
      return;
    }

    const cleanBuses = editBuses.map((bus) => ({
      id: bus.id || undefined,
      name: String(bus.name || "").trim(),
      capacity: Number(bus.capacity || 0),
    }));

    if (cleanBuses.length === 0) {
      alert("Debés dejar al menos un vehículo en el traslado.");
      return;
    }

    if (cleanBuses.some((bus) => !bus.name || !Number.isFinite(bus.capacity) || bus.capacity <= 0)) {
      alert("Revisá los vehículos: todos deben tener nombre y capacidad válida.");
      return;
    }

    const cleanStops = [...editStops]
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
      .map((stop, index) => ({
        id: stop.id || undefined,
        name: String(stop.name || "").trim(),
        time: String(stop.time || "").trim(),
        order: index + 1,
      }));

    if (cleanStops.length === 0) {
      alert("Debés dejar al menos una parada en el traslado.");
      return;
    }

    if (cleanStops.some((stop) => !stop.name || !stop.time)) {
      alert("Revisá las paradas: todas deben tener nombre y horario.");
      return;
    }

    const busesRes = await fetch(apiUrl(`/trips/${editingTripId}/buses/sync`), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ buses: cleanBuses }),
    });

    const busesJson = await busesRes.json();
    if (!busesRes.ok) {
      alert(busesJson?.error || "No se pudieron guardar los vehículos");
      return;
    }

    const stopsRes = await fetch(apiUrl(`/trips/${editingTripId}/stops/sync`), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ stops: cleanStops }),
    });

    const stopsJson = await stopsRes.json();
    if (!stopsRes.ok) {
      alert(stopsJson?.error || "No se pudieron guardar las paradas");
      return;
    }

    setEditingTripId(null);
    await loadTrips();
  };

  const deleteTrip = async (tripId) => {
    if (!confirm("¿Eliminar traslado? Esta acción no se puede deshacer.")) {
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      alert("Sesión expirada");
      return;
    }

    const res = await fetch(apiUrl(`/trips/${tripId}`), {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const json = await res.json();

    if (!res.ok) {
      alert(json?.error || "No se pudo eliminar traslado");
      return;
    }

    if (selectedTripId === tripId) {
      setSelectedTripId(null);
      setPassengers([]);
    }

    await loadTrips();
  };

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  const changeTripStatus = async (tripId, status) => {
    const token = await getAccessToken();

    if (!token) {
      alert("Sesión expirada");
      return;
    }

    const res = await fetch(apiUrl(`/trips/${tripId}/status`), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });

    const json = await res.json();

    if (!res.ok) {
      alert(json?.error || "No se pudo actualizar el estado");
      return;
    }

    setTrips((prev) =>
      prev.map((trip) => (trip.id === tripId ? { ...trip, status } : trip))
    );
  };

  const loadPassengers = async (tripId) => {
    const token = await getAccessToken();

    if (!token) {
      alert("Sesión expirada");
      return;
    }

    setPassengersLoading(true);

    try {
      const statusQuery =
        passengerFilter === "all" ? "" : `?status=${passengerFilter}`;

      const res = await fetch(
        apiUrl(`/admin/trips/${tripId}/reservations${statusQuery}`),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const json = await res.json();

      if (!res.ok) {
        alert(json?.error || "No se pudo cargar pasajeros");
        setPassengers([]);
        return;
      }

      setPassengers(Array.isArray(json) ? json : []);
      setSelectedTripId(tripId);
    } finally {
      setPassengersLoading(false);
    }
  };

  const promoteWaiting = async (tripId, reservationId) => {
    const token = await getAccessToken();

    if (!token) {
      alert("Sesión expirada");
      return;
    }

    setPromotingId(reservationId);

    try {
      const res = await fetch(
        apiUrl(`/admin/trips/${tripId}/promote/${reservationId}`),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const json = await res.json();

      if (!res.ok) {
        alert(json?.error || "No se pudo promover");
        return;
      }

      await loadPassengers(tripId);
      await loadTrips();
    } finally {
      setPromotingId(null);
    }
  };

  const filteredPassengers = passengers.filter((row) => {
    if (!searchText.trim()) return true;

    const value = searchText.toLowerCase().trim();
    const name = (row.users?.name || "").toLowerCase();
    const phone = String(row.users?.phone || "").toLowerCase();
    const stop = (row.stops?.name || "").toLowerCase();

    return name.includes(value) || phone.includes(value) || stop.includes(value);
  });

  const groupedByStop = filteredPassengers.reduce((acc, row) => {
    const key = row.stops?.name || "Sin parada";
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  const confirmedCount = filteredPassengers.filter((p) => p.status === "confirmed").length;
  const waitingCount = filteredPassengers.filter((p) => p.status === "waiting").length;

  const exportCsv = () => {
    if (!selectedTripId || filteredPassengers.length === 0) {
      alert("No hay pasajeros para exportar");
      return;
    }

    const rows = [
      ["TripId", "Nombre", "Telefono", "Parada", "Estado"],
      ...filteredPassengers.map((p) => [
        selectedTripId,
        p.users?.name || "",
        p.users?.phone || "",
        p.stops?.name || "",
        p.status || "",
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `trip-${selectedTripId}-passengers.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="card stack">
        <LoadingState label="Cargando viajes..." compact />
        <SkeletonCards count={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <p className="empty">{error}</p>
      </div>
    );
  }

  if (trips.length === 0) {
    return (
      <div className="card">
        <p className="empty">No hay viajes disponibles.</p>
      </div>
    );
  }

  return (
    <div className="card stack">
      <h3 className="section-title">Viajes</h3>

      <div className="trip-grid">
        {trips.map((trip) => (
          <div key={trip.id} className="list-item stack-sm">
            <b>{trip.name || `Viaje ${trip.id}`}</b>
            <div className="muted">
              Tipo: {trip.type || "-"} | Estado: {trip.status === "open" ? "🟢 Abierto" : "🔴 Cerrado"}
            </div>
            <div className="muted">Hora: {trip.time ? new Date(trip.time).toLocaleString() : "-"}</div>
            <div className="muted">Inicio recorrido: {trip.active_started_at ? new Date(trip.active_started_at).toLocaleString() : "-"}</div>
            <div className="muted">Última finalización: {trip.last_finished_at ? new Date(trip.last_finished_at).toLocaleString() : "-"}</div>
            <div className="muted">Confirmados: {trip.confirmed ?? 0} / Capacidad: {trip.capacity ?? 0}</div>
            <div className="muted">Lista de espera: {trip.waiting ?? 0}</div>
            <div className="muted">Ocupación: {trip.capacity > 0 ? Math.round(((trip.confirmed || 0) / trip.capacity) * 100) : 0}%</div>
            <div className="row">
              <button onClick={() => changeTripStatus(trip.id, "open")}>Abrir inscripción</button>
              <button className="btn-secondary" onClick={() => changeTripStatus(trip.id, "closed")}>Cerrar inscripción</button>
              <button className="btn-secondary" onClick={() => loadPassengers(trip.id)}>Ver anotados</button>
              <button className="btn-secondary btn-with-icon" onClick={() => startEditTrip(trip)}>
                <IconEdit />
                Editar
              </button>
              <button className="btn-danger btn-with-icon" onClick={() => deleteTrip(trip.id)}>
                <IconTrash />
                Eliminar
              </button>
            </div>

            {editingTripId === trip.id && (
              <div className="card card-soft stack-sm">
                <h4 className="section-title">Editar traslado</h4>
                {editLoading ? (
                  <LoadingState compact label="Cargando datos del traslado..." />
                ) : (
                  <>
                    <input
                      placeholder="Nombre"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <select value={editType} onChange={(e) => setEditType(e.target.value)}>
                      <option value="ida">Ida</option>
                      <option value="vuelta">Vuelta</option>
                    </select>
                    <input
                      type="datetime-local"
                      value={editDeparture}
                      onChange={(e) => setEditDeparture(e.target.value)}
                    />

                    <hr className="divider" />
                    <h4 className="section-title">Vehículos</h4>
                    <div className="grid">
                      {editBuses.map((bus, index) => (
                        <div key={`${bus.id || "new"}-${index}`} className="list-item row">
                          <input
                            placeholder="Nombre vehículo"
                            value={bus.name}
                            onChange={(e) => updateEditBus(index, "name", e.target.value)}
                          />
                          <input
                            type="number"
                            min="1"
                            placeholder="Capacidad"
                            value={bus.capacity}
                            onChange={(e) => updateEditBus(index, "capacity", e.target.value)}
                          />
                          <button className="btn-danger btn-with-icon" onClick={() => removeEditBus(index)}>
                            <IconTrash />
                            Eliminar
                          </button>
                        </div>
                      ))}
                    </div>
                    <button className="btn-secondary" onClick={addEditBus}>+ Agregar vehículo</button>

                    <hr className="divider" />
                    <h4 className="section-title">Paradas</h4>
                    <div className="grid">
                      {editStops.map((stop, index) => (
                        <div key={`${stop.id || "new"}-${index}`} className="list-item row">
                          <input
                            type="number"
                            min="1"
                            placeholder="Orden"
                            value={stop.order}
                            onChange={(e) => updateEditStop(index, "order", e.target.value)}
                          />
                          <input
                            placeholder="Nombre parada"
                            value={stop.name}
                            onChange={(e) => updateEditStop(index, "name", e.target.value)}
                          />
                          <input
                            type="time"
                            value={stop.time}
                            onChange={(e) => updateEditStop(index, "time", e.target.value)}
                          />
                          <button className="btn-danger btn-with-icon" onClick={() => removeEditStop(index)}>
                            <IconTrash />
                            Eliminar
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="row">
                      <button className="btn-secondary" onClick={addEditStop}>+ Agregar parada</button>
                      <button className="btn-secondary" onClick={normalizeStopOrders}>Reordenar automáticamente</button>
                    </div>

                    <div className="row">
                      <button onClick={saveEditTrip}>Guardar</button>
                      <button className="btn-secondary" onClick={() => setEditingTripId(null)}>Cancelar</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedTripId && (
        <div className="card card-soft stack">
          <h4 className="section-title">Pasajeros viaje {selectedTripId}</h4>
          <div className="row">
            <select
              value={passengerFilter}
              onChange={(e) => setPassengerFilter(e.target.value)}
            >
              <option value="all">Todos</option>
              <option value="confirmed">Confirmados</option>
              <option value="waiting">En espera</option>
            </select>
            <input
              placeholder="Buscar nombre/teléfono/parada"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <button onClick={() => loadPassengers(selectedTripId)}>Actualizar lista</button>
            <button className="btn-secondary" onClick={exportCsv}>Exportar CSV</button>
          </div>

          <p>
            <span className="badge badge-success">Confirmados: {confirmedCount}</span>{" "}
            <span className="badge badge-warning">Espera: {waitingCount}</span>
          </p>

          {passengersLoading ? (
            <LoadingState compact label="Cargando pasajeros..." />
          ) : filteredPassengers.length === 0 ? (
            <p className="empty">Sin pasajeros para este filtro.</p>
          ) : (
            Object.entries(groupedByStop).map(([stopName, rows]) => (
              <div key={stopName} className="list-item stack-sm">
                <b>Parada: {stopName}</b>
                {rows.map((row) => (
                  <div key={row.id} className="row-between">
                    <span>{row.users?.name || "Sin nombre"} - {row.status}</span>
                    {row.status === "waiting" && (
                      <button
                        onClick={() => promoteWaiting(selectedTripId, row.id)}
                        disabled={promotingId === row.id}
                      >
                        {promotingId === row.id ? "Promoviendo..." : "Promover"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
