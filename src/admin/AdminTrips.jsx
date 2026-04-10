import { useCallback, useEffect, useRef, useState } from "react";
import { IconEdit, IconTrash, IconChevronRight, IconDownload } from "../ui/icons";
import { apiUrl } from "../api";
import LoadingState from "../ui/LoadingState";
import SkeletonCards from "../ui/SkeletonCards";
import MessageBanner from "../ui/MessageBanner";
import EmptyState from "../ui/EmptyState";
import Pager from "../ui/Pager";
import { useSessionToken } from "../hooks/useSessionToken";
import {
  formatDateTimeShort,
  formatOccupancy,
  formatTimeLabel,
  formatTripStatus,
  formatTripTitle,
  getArgentinaWeekdayAndTime,
  sortTrasladosByHora,
  toArgentinaDateTimeLocalInput,
} from "../utils/format";

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

function getWeekDayLabel(dayValue) {
  const day = WEEK_DAYS.find((item) => Number(item.value) === Number(dayValue));
  return day?.label || "-";
}

function formatLegacyDateTime(value) {
  return formatDateTimeShort(value);
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
  const [forcingReinforcementTripId, setForcingReinforcementTripId] = useState(null);
  const [reinforcementTargetTrip, setReinforcementTargetTrip] = useState(null);
  const [reinforcementStops, setReinforcementStops] = useState([]);
  const [reinforcementStopStats, setReinforcementStopStats] = useState({});
  const [reinforcementName, setReinforcementName] = useState("");
  const [reinforcementBusName, setReinforcementBusName] = useState("Refuerzo 1");
  const [reinforcementBusCapacity, setReinforcementBusCapacity] = useState("20");
  const [loadingReinforcementStops, setLoadingReinforcementStops] = useState(false);
  const [notice, setNotice] = useState("");
  const [groupLabel, setGroupLabel] = useState("-");
  const [passengerPage, setPassengerPage] = useState(1);
  const [selectedPassenger, setSelectedPassenger] = useState(null);
  const passengerPageSize = 20;
  const passengersSectionRef = useRef(null);
  const initialLoadDoneRef = useRef(false);
  const forcingReinforcementRef = useRef(false);

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
      setEditDeparture(toArgentinaDateTimeLocalInput(trip.time));
    } else { setEditDeparture(""); }

    if (trip.waitlist_start_day !== null && trip.waitlist_start_day !== undefined && trip.waitlist_start_time) {
      setEditWaitlistStartDay(String(trip.waitlist_start_day));
      setEditWaitlistStartTime(String(trip.waitlist_start_time).slice(0, 5));
      setEditWaitlistEnabled(true);
    } else if (trip.waitlist_start_at) {
      const startInfo = getArgentinaWeekdayAndTime(trip.waitlist_start_at);
      setEditWaitlistStartDay(String(startInfo.day ?? 1));
      setEditWaitlistStartTime(startInfo.time || "08:00");
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
      const endInfo = getArgentinaWeekdayAndTime(trip.waitlist_end_at);
      setEditWaitlistEndDay(String(endInfo.day ?? 1));
      setEditWaitlistEndTime(endInfo.time || "09:00");
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
  const editTotalCapacity = editBuses.reduce((acc, bus) => acc + Number(bus?.capacity || 0), 0);
  const setEditTotalCapacity = (nextValue) => {
    const target = Number.parseInt(nextValue, 10);
    if (!Number.isFinite(target) || target <= 0) return;

    setEditBuses((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) {
        return [{ id: null, name: "Vehículo 1", capacity: target }];
      }

      const rest = prev.slice(1);
      const restSum = rest.reduce((acc, bus) => acc + Number(bus?.capacity || 0), 0);
      const minTotal = restSum + 1;

      if (target < minTotal) {
        setNotice(`La capacidad total mínima con los demás vehículos es ${minTotal}`);
        return prev;
      }

      setNotice("");
      return [
        {
          ...prev[0],
          capacity: target - restSum,
        },
        ...rest,
      ];
    });
  };
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
      const busesRes = await fetch(apiUrl(`/trips/${editingTripId}/buses/sync`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ buses: editBuses }),
      });
      const busesJson = await busesRes.json().catch(() => ({}));
      if (!busesRes.ok) {
        alert(busesJson?.error || "No se pudo guardar la capacidad/vehículos del traslado");
        return;
      }

      const stopsRes = await fetch(apiUrl(`/trips/${editingTripId}/stops/sync`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stops: editStops }),
      });
      const stopsJson = await stopsRes.json().catch(() => ({}));
      if (!stopsRes.ok) {
        alert(stopsJson?.error || "No se pudieron guardar las paradas del traslado");
        return;
      }

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

  const openForcedReinforcement = async (trip) => {
    if (loadingReinforcementStops) return;
    setLoadingReinforcementStops(true);
    setReinforcementTargetTrip(trip);
    setReinforcementName(`${trip.name || "Traslado"} Refuerzo`);
    setReinforcementBusName("Refuerzo 1");
    setReinforcementBusCapacity("20");
    setReinforcementStopStats({});
    try {
      const token = await getAccessToken();
      if (!token) {
        setNotice("Sesión expirada");
        return;
      }
      const [res, configRes, reservationsRes] = await Promise.all([
        fetch(apiUrl(`/trips/${trip.id}/stops`), {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(apiUrl(`/trips/${trip.id}/reinforcement-config`), {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(apiUrl(`/admin/trips/${trip.id}/reservations`), {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const json = await res.json();
      const configJson = configRes.ok ? await configRes.json() : null;
      const reservationsJson = reservationsRes.ok ? await reservationsRes.json() : [];
      if (!res.ok) {
        alert(json?.error || "No se pudieron cargar paradas");
        return;
      }
      if (configRes.ok && configJson?.active) {
        alert("Ya existe un refuerzo activo para este traslado.");
        return;
      }

      const defaultSplitIds = new Set(
        Array.isArray(configJson?.split_stop_ids)
          ? configJson.split_stop_ids.map((id) => String(id))
          : []
      );

      const stopStats = (Array.isArray(reservationsJson) ? reservationsJson : []).reduce((acc, row) => {
        const key = String(row?.stop_id || "");
        if (!key) return acc;
        if (!acc[key]) {
          acc[key] = { total: 0, confirmed: 0, waiting: 0 };
        }

        acc[key].total += 1;
        if (row?.status === "confirmed") acc[key].confirmed += 1;
        if (row?.status === "waiting") acc[key].waiting += 1;
        return acc;
      }, {});

      const normalized = (Array.isArray(json) ? json : [])
        .map((stop) => ({
          ...stop,
          name: stop?.name || "",
          time: stop?.time || "",
          order: Number(stop?.order || 0),
          passengerStats: stopStats[String(stop?.id)] || { total: 0, confirmed: 0, waiting: 0 },
          selected: defaultSplitIds.has(String(stop?.id)),
        }))
        .sort((a, b) => a.order - b.order);

      if (normalized.length < 2) {
        alert("El traslado necesita al menos 2 paradas para crear refuerzo.");
        return;
      }

      if (configJson?.reinforcement_trip_name) {
        setReinforcementName(configJson.reinforcement_trip_name);
      }
      if (configJson?.reinforcement_bus_name) {
        setReinforcementBusName(configJson.reinforcement_bus_name);
      }
      if (configJson?.reinforcement_bus_capacity) {
        setReinforcementBusCapacity(String(configJson.reinforcement_bus_capacity));
      }

      setReinforcementStopStats(stopStats);
      setReinforcementStops(normalized);
    } finally {
      setLoadingReinforcementStops(false);
    }
  };

  const closeForcedReinforcement = (force = false) => {
    if (forcingReinforcementTripId && !force) return;
    setReinforcementTargetTrip(null);
    setReinforcementStops([]);
    setReinforcementStopStats({});
  };

  const toggleReinforcementStop = (index) => {
    setReinforcementStops((prev) => prev.map((stop, idx) => (
      idx === index ? { ...stop, selected: !stop.selected } : stop
    )));
  };

  const assignStopsFromIndexToReinforcement = (index) => {
    setReinforcementStops((prev) => prev.map((stop, idx) => ({
      ...stop,
      selected: idx >= index,
    })));
  };

  const forceCreateReinforcement = async () => {
    if (!reinforcementTargetTrip || forcingReinforcementTripId || forcingReinforcementRef.current) return;
    const busCapacity = Number.parseInt(reinforcementBusCapacity, 10) || 0;
    if (!reinforcementName.trim()) {
      alert("Ingresá el nombre del nuevo traslado de refuerzo.");
      return;
    }
    if (!reinforcementBusName.trim()) {
      alert("Ingresá el nombre del vehículo de refuerzo.");
      return;
    }
    if (busCapacity <= 0) {
      alert("Ingresá una capacidad válida para el vehículo de refuerzo.");
      return;
    }

    const toReinforcement = reinforcementStops.filter((stop) => stop.selected);
    if (toReinforcement.length === 0) {
      alert("Seleccioná al menos una parada para el refuerzo.");
      return;
    }
    if (toReinforcement.length === reinforcementStops.length) {
      alert("Debe quedar al menos una parada en el traslado original.");
      return;
    }

    forcingReinforcementRef.current = true;
    setForcingReinforcementTripId(reinforcementTargetTrip.id);
    try {
      const token = await getAccessToken();
      if (!token) {
        alert("Sesión expirada");
        return;
      }

      const createRes = await fetch(apiUrl(`/trips/${reinforcementTargetTrip.id}/reinforcement`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: reinforcementName.trim(),
          bus_name: reinforcementBusName.trim(),
          bus_capacity: busCapacity,
          stop_ids: toReinforcement.map((stop) => stop.id),
        }),
      });
      const createJson = await createRes.json().catch(() => ({}));
      if (!createRes.ok) {
        alert(createJson?.error || "No se pudo crear refuerzo.");
        return;
      }

      closeForcedReinforcement(true);
      await loadTrips();
      if (selectedTripId === reinforcementTargetTrip.id) {
        await loadPassengers(reinforcementTargetTrip.id);
      }
    } finally {
      forcingReinforcementRef.current = false;
      setForcingReinforcementTripId(null);
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
      setTimeout(() => {
        passengersSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
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

  const exportPassengersToCSV = async (trip) => {
    const token = await getAccessToken();
    try {
      const res = await fetch(apiUrl(`/admin/trips/${trip.id}/reservations`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        setNotice("Error al descargar pasajeros");
        return;
      }
      const reservations = await res.json();
      
      // Crear CSV con encabezados
      const headers = ["Nombre", "Rol", "Parada"];
      const rows = reservations.map(r => [
        r.users?.name || "Sin nombre",
        r.users?.description || "Sin rol",
        r.stops?.name || "Sin parada"
      ]);
      
      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
      ].join("\n");
      
      // Crear blob y descargar
      const tripName = formatTripTitle(trip.name, trip.first_time, trip.id).replace(/\s+/g, "_");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.setAttribute('href', URL.createObjectURL(blob));
      link.setAttribute('download', `anotados_${tripName}.csv`);
      link.click();
    } catch (error) {
      console.error("Error downloading passengers:", error);
      setNotice("Error al descargar pasajeros");
    }
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
  const selectedTripRef = trips.find((trip) => Number(trip?.id) === Number(selectedTripId));
  const selectedTripLabel = formatTripTitle(selectedTripRef?.name, selectedTripRef?.first_time, selectedTripId);
  const reinforcementSelectedSummary = reinforcementStops.reduce(
    (acc, stop) => {
      if (!stop?.selected) return acc;
      const stats = stop?.passengerStats || reinforcementStopStats[String(stop?.id)] || { total: 0, confirmed: 0, waiting: 0 };
      acc.stops += 1;
      acc.total += Number(stats.total || 0);
      acc.confirmed += Number(stats.confirmed || 0);
      acc.waiting += Number(stats.waiting || 0);
      return acc;
    },
    { stops: 0, total: 0, confirmed: 0, waiting: 0 }
  );

  const renderTripCard = (trip) => (
    <div key={trip.id} className="card glass-card stack-sm" style={{ padding: '20px', marginBottom: '16px' }}>
      <div className="row-between">
        <h2 className="headline">{formatTripTitle(trip.name, trip.first_time, trip.id)}</h2>
        <span className={`badge ${trip.status === 'open' ? 'badge-success' : 'badge-warning'}`}>{formatTripStatus(trip.status)}</span>
      </div>
      
      <div className="stack-sm" style={{ opacity: 0.8 }}>
        <p className="caption">Ocupación: <b>{trip.confirmed || 0}/{trip.capacity || 0}</b> ({formatOccupancy(trip.confirmed, trip.capacity)}%)</p>
        {trip.waiting > 0 && <p className="caption" style={{ color: 'var(--ios-system-orange)' }}>Lista de espera: {trip.waiting}</p>}
        {(trip.waitlist_start_day !== null && trip.waitlist_start_day !== undefined && trip.waitlist_start_time) ? (
          <>
            <p className="caption">Activación lista de espera: {getWeekDayLabel(trip.waitlist_start_day)} {String(trip.waitlist_start_time).slice(0, 5)}</p>
            {trip.waitlist_end_day !== null && trip.waitlist_end_day !== undefined && trip.waitlist_end_time ? (
              <p className="caption">Cierre lista de espera: {getWeekDayLabel(trip.waitlist_end_day)} {String(trip.waitlist_end_time).slice(0, 5)}</p>
            ) : null}
            <p className="caption">Estado actual lista de espera: <b>{trip.waitlist_active ? "Activa" : "Inactiva"}</b></p>
          </>
        ) : trip.waitlist_start_at ? (
          <>
            <p className="caption">Activación lista de espera: {formatLegacyDateTime(trip.waitlist_start_at)}</p>
            {trip.waitlist_end_at ? <p className="caption">Cierre lista de espera: {formatLegacyDateTime(trip.waitlist_end_at)}</p> : null}
            <p className="caption">Estado actual lista de espera: <b>{trip.waitlist_active ? "Activa" : "Inactiva"}</b></p>
          </>
        ) : (
          <p className="caption">Lista de espera: <b>No configurada</b></p>
        )}
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
        <button className="btn-secondary" style={{ fontSize: '12px', padding: '10px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => exportPassengersToCSV(trip)} title="Descargar lista de anotados">
          <IconDownload />
          <span>Descargar</span>
        </button>
        <button className="btn-secondary" style={{ fontSize: '12px', padding: '10px' }} onClick={() => void openForcedReinforcement(trip)} disabled={loadingReinforcementStops || forcingReinforcementTripId === trip.id}>
          {forcingReinforcementTripId === trip.id ? "Creando..." : "Refuerzo"}
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
              </div>
              <div className="row" style={{ alignItems: "center", gap: 8 }}>
                <label className="caption" style={{ minWidth: 140, margin: 0 }}>Capacidad total</label>
                <input
                  style={{ flex: 1 }}
                  type="number"
                  min="1"
                  value={editTotalCapacity || ""}
                  onChange={e => setEditTotalCapacity(e.target.value)}
                />
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

  const idaTrips = sortTrasladosByHora(trips.filter((t) => getTripTypeBucket(t.type) === "ida"));
  const vueltaTrips = sortTrasladosByHora(trips.filter((t) => getTripTypeBucket(t.type) === "vuelta"));
  const otherTrips = sortTrasladosByHora(trips.filter((t) => getTripTypeBucket(t.type) === "other"));

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
            <h1 className="headline">Pasajeros {selectedTripLabel}</h1>
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
                        <button
                          type="button"
                          className="btn-plain"
                          style={{ padding: 0, textAlign: "left" }}
                          onClick={() => setSelectedPassenger(r)}
                        >
                          <span className="body" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <b>{r.users?.name || "Sin nombre"}</b>
                            {r.status === "confirmed" && r.waiting_promoted_at ? (
                              <span
                                title="Aceptado desde lista de espera"
                                aria-label="Aceptado desde lista de espera"
                                style={{
                                  width: 9,
                                  height: 9,
                                  borderRadius: "50%",
                                  background: "#f6c945",
                                  boxShadow: "0 0 0 1px rgba(0,0,0,0.18)",
                                  display: "inline-block",
                                  flexShrink: 0,
                                }}
                              />
                            ) : null}
                          </span>
                        </button>
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
          <Pager
            page={passengerPage}
            totalPages={Math.ceil(filteredPassengers.length / passengerPageSize)}
            onPrev={() => setPassengerPage(p => Math.max(1, p - 1))}
            onNext={() => setPassengerPage(p => p + 1)}
          />
        </div>
      )}

      {selectedPassenger && (
        <div
          role="dialog"
          aria-modal="true"
          className="page fade-up"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setSelectedPassenger(null)}
        >
          <div
            className="card glass-card stack-sm"
            style={{ width: "100%", maxWidth: "520px", padding: "20px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row-between">
              <h3 className="headline" style={{ margin: 0 }}>Detalle del pasajero</h3>
              <button className="btn-secondary" type="button" onClick={() => setSelectedPassenger(null)}>
                Cerrar
              </button>
            </div>
            <div className="divider" />
            <div className="stack-sm">
              {selectedPassenger.users?.phone ? (
                <a className="btn-primary" href={`tel:${selectedPassenger.users.phone}`}>
                  Llamar
                </a>
              ) : (
                <button className="btn-secondary" type="button" disabled>
                  Sin teléfono
                </button>
              )}
              <p className="body"><b>Description:</b> {selectedPassenger.users?.description || "Sin description"}</p>
            </div>
          </div>
        </div>
      )}

      {reinforcementTargetTrip && (
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
          onClick={closeForcedReinforcement}
        >
          <div
            className="card glass-card stack-sm"
            style={{ width: "100%", maxWidth: "760px", padding: "20px", maxHeight: "90vh", overflow: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row-between">
              <h3 className="headline" style={{ margin: 0 }}>Refuerzo forzado</h3>
              <button className="btn-secondary" type="button" onClick={closeForcedReinforcement} disabled={Boolean(forcingReinforcementTripId)}>
                Cerrar
              </button>
            </div>
            <p className="caption">Traslado original: <b>{formatTripTitle(reinforcementTargetTrip.name, reinforcementTargetTrip.first_time, reinforcementTargetTrip.id)}</b></p>
            <div className="divider" />

            <div className="stack-sm">
              <input placeholder="Nombre nuevo traslado" value={reinforcementName} onChange={(e) => setReinforcementName(e.target.value)} />
              <div className="row">
                <input style={{ flex: 1 }} placeholder="Nombre vehículo" value={reinforcementBusName} onChange={(e) => setReinforcementBusName(e.target.value)} />
                <input style={{ width: '140px' }} type="number" min="1" placeholder="Capacidad" value={reinforcementBusCapacity} onChange={(e) => setReinforcementBusCapacity(e.target.value)} />
              </div>
            </div>

            <div className="divider" />
            <p className="caption">Seleccioná qué paradas pasan al nuevo traslado de refuerzo.</p>
            <div className="row">
              <span className="badge">Paradas seleccionadas: {reinforcementSelectedSummary.stops}</span>
              <span className="badge">Pasajeros: {reinforcementSelectedSummary.total}</span>
              <span className="badge badge-success">Confirmados: {reinforcementSelectedSummary.confirmed}</span>
              <span className="badge badge-warning">Espera: {reinforcementSelectedSummary.waiting}</span>
            </div>
            <div className="row">
              <button className="btn-secondary" type="button" onClick={() => setReinforcementStops((prev) => prev.map((stop) => ({ ...stop, selected: false })))}>
                Ninguna
              </button>
              <button className="btn-secondary" type="button" onClick={() => setReinforcementStops((prev) => prev.map((stop, idx) => ({ ...stop, selected: idx >= Math.ceil(prev.length / 2) })))}>
                Mitad final
              </button>
            </div>

            <div className="inset-list">
              {reinforcementStops.map((stop, idx) => (
                <div key={`${stop.id || idx}-${stop.order}`} className="list-item row-between">
                  <label className="row" style={{ alignItems: "center", gap: 8, flex: 1 }}>
                    <input type="checkbox" checked={Boolean(stop.selected)} onChange={() => toggleReinforcementStop(idx)} />
                    <span className="body" style={{ display: "grid", gap: 4 }}>
                      <span><b>{stop.name || `Parada ${idx + 1}`}</b> {stop.time ? `· ${formatTimeLabel(stop.time)}` : ""}</span>
                      <span className="caption">
                        Pasajeros: {stop?.passengerStats?.total || reinforcementStopStats[String(stop?.id)]?.total || 0}
                        {` · Confirmados: ${stop?.passengerStats?.confirmed || reinforcementStopStats[String(stop?.id)]?.confirmed || 0}`}
                        {` · Espera: ${stop?.passengerStats?.waiting || reinforcementStopStats[String(stop?.id)]?.waiting || 0}`}
                      </span>
                    </span>
                  </label>
                  <button className="btn-secondary" type="button" onClick={() => assignStopsFromIndexToReinforcement(idx)}>
                    Desde acá
                  </button>
                </div>
              ))}
            </div>

            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn-primary" type="button" onClick={forceCreateReinforcement} disabled={forcingReinforcementTripId === reinforcementTargetTrip.id}>
                {forcingReinforcementTripId === reinforcementTargetTrip.id ? "Creando refuerzo..." : "Crear refuerzo y dividir paradas"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
