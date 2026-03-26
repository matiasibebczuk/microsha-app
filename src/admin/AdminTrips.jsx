import { useCallback, useEffect, useRef, useState } from "react";
import { IconEdit, IconTrash, IconChevronRight } from "../ui/icons";
import { apiUrl } from "../api";
import LoadingState from "../ui/LoadingState";
import SkeletonCards from "../ui/SkeletonCards";
import MessageBanner from "../ui/MessageBanner";
import EmptyState from "../ui/EmptyState";
import Pager from "../ui/Pager";
import { useSessionToken } from "../hooks/useSessionToken";
import { formatDateTime, formatOccupancy, formatTripStatus } from "../utils/format";

const WEEK_DAYS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
];

function normalizeTripType(type) {
  return String(type || "").trim().toLowerCase();
}

function getTripTypeBucket(type) {
  const normalized = normalizeTripType(type);
  if (normalized.startsWith("ida")) return "ida";
  if (normalized.startsWith("vuelta") || normalized.startsWith("regreso")) return "vuelta";
  return "other";
}

function normalizeTripsPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.trips)) return payload.trips;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

async function readJsonSafely(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function AdminTrips() {
  const getAccessToken = useSessionToken();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
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
  const [editWaitlistEnabled, setEditWaitlistEnabled] = useState(false);
  const [editWaitlistStartDay, setEditWaitlistStartDay] = useState("1");
  const [editWaitlistStartTime, setEditWaitlistStartTime] = useState("08:00");
  const [editWaitlistHasEnd, setEditWaitlistHasEnd] = useState(false);
  const [editWaitlistEndDay, setEditWaitlistEndDay] = useState("1");
  const [editWaitlistEndTime, setEditWaitlistEndTime] = useState("09:00");
  const [editStops, setEditStops] = useState([]);
  const [editBuses, setEditBuses] = useState([]);
  const [editLoading, setEditLoading] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingTripId, setDeletingTripId] = useState(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [notice, setNotice] = useState("");
  const [groupLabel, setGroupLabel] = useState("-");
  const [passengerPage, setPassengerPage] = useState(1);
  const passengerPageSize = 20;
  const passengersSectionRef = useRef(null);
  const initialLoadDoneRef = useRef(false);

  const getTokenWithRetry = useCallback(async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const token = await getAccessToken();
      if (token) return token;
      await sleep(250);
    }
    return null;
  }, [getAccessToken]);

  const loadTrips = useCallback(async () => {
    try {
      setLoading(true);
      setNotice("");
      const token = await getTokenWithRetry();
      if (!token) { setTrips([]); setNotice("Sesión expirada"); return; }
      const headers = { Authorization: `Bearer ${token}` };

      const [tripsRes, groupRes] = await Promise.all([
        fetch(apiUrl("/trips"), { headers }),
        fetch(apiUrl("/groups/me"), { headers }),
      ]);

      const [tripsJson, groupJson] = await Promise.all([
        readJsonSafely(tripsRes),
        readJsonSafely(groupRes),
      ]);

      if (groupRes.ok) {
        const gid = groupJson?.groupId || "-";
        const gname = groupJson?.groupName ? ` (${groupJson.groupName})` : "";
        setGroupLabel(`${gid}${gname}`);
      } else {
        setGroupLabel("sin grupo");
      }

      if (!tripsRes.ok) {
        setNotice(tripsJson?.error || `Error cargando traslados (${tripsRes.status})`);
        setTrips([]);
        return;
      }

      const normalizedTrips = normalizeTripsPayload(tripsJson).filter((trip) => trip && typeof trip === "object");
      setTrips(normalizedTrips);

      if (normalizedTrips.length === 0) {
        setNotice("No hay traslados para el grupo actual.");
      }
    } catch { setNotice("Error de red"); setTrips([]); } finally { setLoading(false); }
  }, [getTokenWithRetry]);

  useEffect(() => {
    if (initialLoadDoneRef.current) return;
    initialLoadDoneRef.current = true;
    void loadTrips();
  }, [loadTrips]);

  const startEditTrip = async (trip) => {
    if (editingTripId === trip.id) { setEditingTripId(null); setEditLoading(false); return; }
    setEditingTripId(trip.id);
    setEditName(trip.name || "");
    setEditType(trip.type || "ida");
    setEditStops([]);
    setEditBuses([]);
    setEditLoading(true);

    if (trip.time) {
      const dt = new Date(trip.time);
      const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setEditDeparture(local);
    } else { setEditDeparture(""); }

    if (trip.waitlist_start_day !== null && trip.waitlist_start_day !== undefined && trip.waitlist_start_time) {
      setEditWaitlistStartDay(String(trip.waitlist_start_day));
      setEditWaitlistStartTime(String(trip.waitlist_start_time).slice(0, 5));
      setEditWaitlistEnabled(true);
    } else if (trip.waitlist_start_at) {
      const dt = new Date(trip.waitlist_start_at);
      setEditWaitlistStartDay(String(dt.getDay()));
      setEditWaitlistStartTime(`${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`);
      setEditWaitlistEnabled(true);
    } else {
      setEditWaitlistStartDay("1");
      setEditWaitlistStartTime("08:00");
      setEditWaitlistEnabled(false);
    }

    if (trip.waitlist_end_day !== null && trip.waitlist_end_day !== undefined && trip.waitlist_end_time) {
      setEditWaitlistEndDay(String(trip.waitlist_end_day));
      setEditWaitlistEndTime(String(trip.waitlist_end_time).slice(0, 5));
      setEditWaitlistHasEnd(true);
    } else if (trip.waitlist_end_at) {
      const dt = new Date(trip.waitlist_end_at);
      setEditWaitlistEndDay(String(dt.getDay()));
      setEditWaitlistEndTime(`${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`);
      setEditWaitlistHasEnd(true);
    } else {
      setEditWaitlistEndDay("1");
      setEditWaitlistEndTime("09:00");
      setEditWaitlistHasEnd(false);
    }

    try {
      const token = await getAccessToken();
      if (!token) { setNotice("Sesión expirada"); return; }
      const [stopsRes, busesRes] = await Promise.all([
        fetch(apiUrl(`/trips/${trip.id}/stops`), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl(`/trips/${trip.id}/buses`), { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [stopsJson, busesJson] = await Promise.all([stopsRes.json(), busesRes.json()]);
      if (!stopsRes.ok || !busesRes.ok) { setNotice("Error cargando detalles"); return; }
      setEditStops((Array.isArray(stopsJson) ? stopsJson : []).map(s => ({...s, name: s.name || "", time: s.time || ""})).sort((a,b) => a.order - b.order));
      setEditBuses((Array.isArray(busesJson) ? busesJson : []).map(b => ({...b, name: b.name || "", capacity: Number(b.capacity || 0)})));
    } finally { setEditLoading(false); }
  };

  const addEditBus = () => setEditBuses(p => [...p, { id: null, name: "", capacity: 40 }]);
  const updateEditBus = (i, f, v) => setEditBuses(p => { const c = [...p]; c[i] = { ...c[i], [f]: v }; return c; });
  const removeEditBus = (i) => setEditBuses(p => p.filter((_, idx) => idx !== i));
  const addEditStop = () => setEditStops(p => [...p, { id: null, name: "", time: "", order: p.length + 1 }]);
  const updateEditStop = (i, f, v) => setEditStops((p) => {
    const c = [...p];

    if (f === "time") {
      const currentTime = c[i]?.time;
      const baseCurrent = currentTime ? new Date(`1970-01-01T${currentTime}`) : null;
      const baseNext = v ? new Date(`1970-01-01T${v}`) : null;

      if (!baseCurrent || Number.isNaN(baseCurrent.getTime()) || !baseNext || Number.isNaN(baseNext.getTime())) {
        c[i] = { ...c[i], time: v };
        return c;
      }

      const diffMs = baseNext.getTime() - baseCurrent.getTime();

      return c.map((stop, idx) => {
        if (!stop?.time) {
          return idx === i ? { ...stop, time: v } : stop;
        }

        const baseStop = new Date(`1970-01-01T${stop.time}`);
        if (Number.isNaN(baseStop.getTime())) {
          return idx === i ? { ...stop, time: v } : stop;
        }

        const shifted = new Date(baseStop.getTime() + diffMs);
        const hh = String(shifted.getHours()).padStart(2, "0");
        const mm = String(shifted.getMinutes()).padStart(2, "0");
        return { ...stop, time: `${hh}:${mm}` };
      });
    }

    c[i] = { ...c[i], [f]: f === "order" ? Number(v || 0) : v };
    return c;
  });
  const removeEditStop = (i) => setEditStops(p => p.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, order: idx + 1 })));

  const saveEditTrip = async () => {
    if (!editingTripId || savingEdit) return;
    setSavingEdit(true);
    const token = await getAccessToken();
    if (!token) {
      setSavingEdit(false);
      return;
    }
    try {
      const body = { name: editName, type: editType };
      if (editDeparture) body.departure_datetime = new Date(editDeparture).toISOString();
      body.waitlist_start_day = editWaitlistEnabled ? Number(editWaitlistStartDay) : null;
      body.waitlist_start_time = editWaitlistEnabled ? editWaitlistStartTime : null;
      body.waitlist_end_day = editWaitlistEnabled && editWaitlistHasEnd ? Number(editWaitlistEndDay) : null;
      body.waitlist_end_time = editWaitlistEnabled && editWaitlistHasEnd ? editWaitlistEndTime : null;
      body.waitlist_start_at = null;
      body.waitlist_end_at = null;
      const res = await fetch(apiUrl(`/trips/${editingTripId}`), { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      if (!res.ok) { alert("Error guardando traslado"); return; }
      await fetch(apiUrl(`/trips/${editingTripId}/buses/sync`), { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ buses: editBuses }) });
      await fetch(apiUrl(`/trips/${editingTripId}/stops/sync`), { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ stops: editStops }) });
      setEditingTripId(null);
      await loadTrips();
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteTrip = async (id) => {
    if (deletingTripId === id) return;
    if (!confirm("¿Eliminar?")) return;
    setDeletingTripId(id);
    const token = await getAccessToken();
    try {
      const res = await fetch(apiUrl(`/trips/${id}`), { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { alert("Error"); return; }
      if (selectedTripId === id) setSelectedTripId(null);
      await loadTrips();
    } finally {
      setDeletingTripId(null);
    }
  };

  const changeTripStatus = async (id, status) => {
    if (statusUpdatingId === id) return;
    setStatusUpdatingId(id);
    const token = await getAccessToken();
    try {
      const res = await fetch(apiUrl(`/trips/${id}/status`), { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ status }) });
      if (!res.ok) { alert("Error"); return; }
      setTrips(p => p.map(t => t.id === id ? { ...t, status } : t));
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const loadPassengers = async (id) => {
    const token = await getAccessToken();
    setPassengersLoading(true);
    try {
      const q = passengerFilter === "all" ? "" : `?status=${passengerFilter}`;
      const res = await fetch(apiUrl(`/admin/trips/${id}/reservations${q}`), { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok) { setNotice("Error"); return; }
      setPassengers(json); setSelectedTripId(id); setPassengerPage(1);
    } finally { setPassengersLoading(false); }
  };

  const promoteWaiting = async (tId, rId) => {
    const token = await getAccessToken();
    setPromotingId(rId);
    try {
      const res = await fetch(apiUrl(`/admin/trips/${tId}/promote/${rId}`), { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { await loadPassengers(tId); await loadTrips(); }
    } finally { setPromotingId(null); }
  };

  const filteredPassengers = passengers.filter(r => {
    if (!searchText.trim()) return true;
    const v = searchText.toLowerCase();
    return (r.users?.name || "").toLowerCase().includes(v) || (r.stops?.name || "").toLowerCase().includes(v);
  });

  const pagedPassengers = filteredPassengers.slice((passengerPage - 1) * passengerPageSize, passengerPage * passengerPageSize);
  const groupedByStop = pagedPassengers.reduce((a, r) => { const k = r.stops?.name || "Sin parada"; if (!a[k]) a[k] = []; a[k].push(r); return a; }, {});
  const confirmedCount = filteredPassengers.filter(p => p.status === "confirmed").length;
  const waitingCount = filteredPassengers.filter(p => p.status === "waiting").length;

  const renderTripCard = (trip) => (
    <div key={trip.id} className="card glass-card stack-sm" style={{ padding: '20px', marginBottom: '16px' }}>
      <div className="row-between">
        <h2 className="headline">{trip.name || trip.id}</h2>
        <span className={`badge ${trip.status === 'open' ? 'badge-success' : 'badge-warning'}`}>{formatTripStatus(trip.status)}</span>
      </div>
      
      <div className="stack-sm" style={{ opacity: 0.8 }}>
        <p className="caption">Inicia: {formatDateTime(trip.time)}</p>
        <p className="caption">Ocupación: <b>{trip.confirmed || 0}/{trip.capacity || 0}</b> ({formatOccupancy(trip.confirmed, trip.capacity)}%)</p>
        {trip.waiting > 0 && <p className="caption" style={{ color: 'var(--ios-system-orange)' }}>Lista de espera: {trip.waiting}</p>}
      </div>

      <div className="divider" />

      <div className="row" style={{ flexWrap: 'wrap', gap: '8px' }}>
        <button className="btn-secondary" style={{ fontSize: '14px', flex: 1 }} onClick={() => changeTripStatus(trip.id, trip.status === 'open' ? 'closed' : 'open')} disabled={statusUpdatingId === trip.id}>
          {statusUpdatingId === trip.id ? 'Actualizando...' : (trip.status === 'open' ? 'Cerrar' : 'Abrir')}
        </button>
        <button className="btn-secondary" style={{ fontSize: '14px', flex: 1 }} onClick={() => loadPassengers(trip.id)}>
          Pasajeros
        </button>
        <button className="btn-secondary" style={{ fontSize: '14px', padding: '10px' }} onClick={() => startEditTrip(trip)}>
          <IconEdit />
        </button>
        <button className="btn-plain" style={{ color: 'var(--ios-system-red)', padding: '10px' }} onClick={() => deleteTrip(trip.id)} disabled={deletingTripId === trip.id}>
          <IconTrash />
        </button>
      </div>

      {editingTripId === trip.id && (
        <div className="stack fade-up" style={{ marginTop: 24, padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.1)' }}>
          <h3 className="subheadline">Editar Parámetros</h3>
          {editLoading ? <LoadingState compact /> : (
            <div className="stack-sm">
              <input placeholder="Nombre" value={editName} onChange={e => setEditName(e.target.value)} />
              <div className="row">
                <select style={{ flex: 1 }} value={editType} onChange={e => setEditType(e.target.value)}>
                   <option value="ida">Ida</option><option value="vuelta">Vuelta</option>
                </select>
                <input style={{ flex: 2 }} type="datetime-local" value={editDeparture} onChange={e => setEditDeparture(e.target.value)} />
              </div>

              <div className="divider" />
              <h4 className="caption" style={{fontWeight: 'bold'}}>Lista de espera</h4>
              <label className="row" style={{ alignItems: "center", gap: 8 }}>
                <input style={{ width: 'auto', marginBottom: 0 }} type="checkbox" checked={editWaitlistEnabled} onChange={e => setEditWaitlistEnabled(e.target.checked)} />
                <span className="body">Activar lista de espera</span>
              </label>
              {editWaitlistEnabled && (
                <div className="stack-sm">
                  <div className="row">
                    <select style={{ flex: 1 }} value={editWaitlistStartDay} onChange={e => setEditWaitlistStartDay(e.target.value)}>
                      {WEEK_DAYS.map((day) => <option key={day.value} value={String(day.value)}>{day.label}</option>)}
                    </select>
                    <input style={{ flex: 1 }} type="time" value={editWaitlistStartTime} onChange={e => setEditWaitlistStartTime(e.target.value)} />
                  </div>
                  <label className="row" style={{ alignItems: "center", gap: 8 }}>
                    <input style={{ width: 'auto', marginBottom: 0 }} type="checkbox" checked={editWaitlistHasEnd} onChange={e => setEditWaitlistHasEnd(e.target.checked)} />
                    <span className="body">Programar cierre</span>
                  </label>
                  {editWaitlistHasEnd && (
                    <div className="row">
                      <select style={{ flex: 1 }} value={editWaitlistEndDay} onChange={e => setEditWaitlistEndDay(e.target.value)}>
                        {WEEK_DAYS.map((day) => <option key={day.value} value={String(day.value)}>{day.label}</option>)}
                      </select>
                      <input style={{ flex: 1 }} type="time" value={editWaitlistEndTime} onChange={e => setEditWaitlistEndTime(e.target.value)} />
                    </div>
                  )}
                </div>
              )}

              <div className="divider" />
              <h4 className="caption" style={{fontWeight: 'bold'}}>Vehículos</h4>
              {editBuses.map((b, i) => (
                <div key={i} className="row">
                  <input style={{ flex: 2 }} placeholder="Bus/Combi" value={b.name} onChange={e => updateEditBus(i, "name", e.target.value)} />
                  <input style={{ flex: 1 }} type="number" value={b.capacity} onChange={e => updateEditBus(i, "capacity", e.target.value)} />
                  <button className="btn-plain" onClick={() => removeEditBus(i)}><IconTrash/></button>
                </div>
              ))}
              <button className="btn-plain" onClick={addEditBus}>+ Agregar vehículo</button>

              <div className="divider" />
              <h4 className="caption" style={{fontWeight: 'bold'}}>Paradas</h4>
              {editStops.map((s, i) => (
                <div key={i} className="row">
                  <input style={{ width: '40px' }} type="number" value={s.order} onChange={e => updateEditStop(i, "order", e.target.value)} />
                  <input style={{ flex: 1 }} placeholder="Nombre" value={s.name} onChange={e => updateEditStop(i, "name", e.target.value)} />
                  <input style={{ width: '100px' }} type="time" value={s.time} onChange={e => updateEditStop(i, "time", e.target.value)} />
                  <button className="btn-plain" onClick={() => removeEditStop(i)}><IconTrash/></button>
                </div>
              ))}
              <button className="btn-plain" onClick={addEditStop}>+ Agregar parada</button>

              <div className="row" style={{ marginTop: 16 }}>
                <button className="btn-primary" style={{ flex: 1 }} onClick={saveEditTrip} disabled={savingEdit}>{savingEdit ? 'Guardando...' : 'Guardar Cambios'}</button>
                <button className="btn-secondary" onClick={() => setEditingTripId(null)} disabled={savingEdit}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const idaTrips = trips.filter((t) => getTripTypeBucket(t.type) === "ida");
  const vueltaTrips = trips.filter((t) => getTripTypeBucket(t.type) === "vuelta");
  const otherTrips = trips.filter((t) => getTripTypeBucket(t.type) === "other");

  return (
    <div className="stack fade-up">
      <MessageBanner message={notice} />
      
      {loading ? (
        <div className="inset-group"><SkeletonCards count={3} /></div>
      ) : (
        <div className="stack">
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <span className="badge">Grupo: {groupLabel}</span>
            <span className="badge">Traslados: {trips.length}</span>
            <button className="btn-secondary" onClick={() => void loadTrips()}>Refrescar traslados</button>
          </div>
          <div className="inset-group">
            <h3 className="subheadline">Traslados de Ida</h3>
            {idaTrips.length === 0 ? (
              <EmptyState title="Sin traslados de ida" subtitle="No hay viajes de ida para mostrar." />
            ) : (
              idaTrips.map(renderTripCard)
            )}
          </div>
          <div className="inset-group">
            <h3 className="subheadline">Traslados de Vuelta</h3>
            {vueltaTrips.length === 0 ? (
              <EmptyState title="Sin traslados de vuelta" subtitle="No hay viajes de vuelta para mostrar." />
            ) : (
              vueltaTrips.map(renderTripCard)
            )}
          </div>
          {otherTrips.length > 0 ? (
            <div className="inset-group">
              <h3 className="subheadline">Otros traslados</h3>
              {otherTrips.map(renderTripCard)}
            </div>
          ) : null}
        </div>
      )}

      {selectedTripId && (
        <div ref={passengersSectionRef} className="page fade-up">
          <header className="stack-sm" style={{ marginBottom: 24 }}>
            <h1 className="headline">Pasajeros viaje {selectedTripId}</h1>
            <div className="row">
               <span className="badge badge-success">{confirmedCount} Confirmados</span>
               <span className="badge badge-warning">{waitingCount} Espera</span>
            </div>
          </header>

          <div className="card glass-card stack-sm" style={{ padding: '16px', marginBottom: 20 }}>
            <div className="row">
              <select style={{ width: '120px' }} value={passengerFilter} onChange={e => setPassengerFilter(e.target.value)}>
                <option value="all">Filtro</option><option value="confirmed">Conf.</option><option value="waiting">Wait.</option>
              </select>
              <input placeholder="Buscar..." value={searchText} onChange={e => setSearchText(e.target.value)} />
            </div>
            <button className="btn-secondary" style={{ width: '100%' }} onClick={() => loadPassengers(selectedTripId)}>Refrescar</button>
          </div>

          {passengersLoading ? <LoadingState compact /> : (
            Object.entries(groupedByStop).map(([stop, rows]) => (
              <div key={stop} className="inset-group">
                <h3 className="subheadline">{stop}</h3>
                <div className="inset-list">
                  {rows.map(r => (
                    <div key={r.id} className="card glass-card row-between" style={{ borderRadius: 0, border: 'none', borderBottom: '0.5px solid rgba(255,255,255,0.05)', padding: '12px 16px' }}>
                      <div className="stack-sm">
                        <span className="body"><b>{r.users?.name || "Sin nombre"}</b></span>
                        <span className="caption">{r.users?.phone || "Sin tel"}</span>
                      </div>
                      <div className="row">
                         {r.status === 'waiting' ? (
                           <button className="btn-secondary" style={{ fontSize: '12px', padding: '6px 10px' }} onClick={() => promoteWaiting(selectedTripId, r.id)} disabled={promotingId === r.id}>
                             Promover
                           </button>
                         ) : <span className="badge badge-success">Conf.</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
