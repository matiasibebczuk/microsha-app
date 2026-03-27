import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { apiUrl } from "../api";
import { IconTrash } from "../ui/icons";

const WEEK_DAYS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
];

const DAY_MINUTES = 24 * 60;

function parseTimeToMinutes(value) {
  if (typeof value !== "string") return null;
  const [hh, mm] = value.split(":");
  const h = Number(hh);
  const m = Number(mm);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function minutesToTime(totalMinutes) {
  const normalized = ((totalMinutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const hh = String(Math.floor(normalized / 60)).padStart(2, "0");
  const mm = String(normalized % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function AdminCreateTrip({ onCreated }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("ida");
  const [waitlistEnabled, setWaitlistEnabled] = useState(false);
  const [waitlistStartDay, setWaitlistStartDay] = useState("4");
  const [waitlistStartTime, setWaitlistStartTime] = useState("14:00");
  const [waitlistHasEnd, setWaitlistHasEnd] = useState(false);
  const [waitlistEndDay, setWaitlistEndDay] = useState("1");
  const [waitlistEndTime, setWaitlistEndTime] = useState("09:00");
  const [splitIfExceeded, setSplitIfExceeded] = useState(false);
  const [maxAvailability, setMaxAvailability] = useState("40");
  const [splitTripOneName, setSplitTripOneName] = useState("");
  const [splitTripTwoName, setSplitTripTwoName] = useState("");

  const [stops, setStops] = useState([]);
  const [buses, setBuses] = useState([]);

  const [templates, setTemplates] = useState([]);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const res = await fetch(apiUrl("/templates"), {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      const json = await res.json();
      if (alive) setTemplates(Array.isArray(json) ? json : []);
    })();
    return () => { alive = false; };
  }, []);

  const addStop = () => setStops([...stops, { name: "", time: "", split_target: "1" }]);
  const updateStop = (i, f, v) => { const c = [...stops]; c[i][f] = v; setStops(c); };
  const removeStop = (i) => { const c = [...stops]; c.splice(i, 1); setStops(c); };

  const loadFromTemplate = async (templateId) => {
    const { data } = await supabase.auth.getSession();
    const res = await fetch(apiUrl(`/templates/${templateId}/stops`), {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
    const json = await res.json();
    const base = "10:00";
    const start = new Date(`1970-01-01T${base}`);
    const mapped = json.map((s) => {
      const d = new Date(start.getTime() + s.offset_minutes * 60000);
      const hh = d.getHours().toString().padStart(2, "0");
      const mm = d.getMinutes().toString().padStart(2, "0");
      return { name: s.name, time: `${hh}:${mm}`, split_target: "1" };
    });
    setStops(mapped);
  };

  const shiftTimes = (index, newTime) => {
    const oldMinutes = parseTimeToMinutes(stops[index]?.time);
    const newMinutes = parseTimeToMinutes(newTime);

    if (oldMinutes === null || newMinutes === null) {
      updateStop(index, "time", newTime);
      return;
    }

    const diff = newMinutes - oldMinutes;
    setStops((prev) => prev.map((stop, idx) => {
      const stopMinutes = parseTimeToMinutes(stop.time);
      if (stopMinutes === null) {
        return idx === index ? { ...stop, time: newTime } : stop;
      }
      return { ...stop, time: minutesToTime(stopMinutes + diff) };
    }));
  };

  const addBus = () => setBuses([...buses, { name: "", capacity: 40 }]);
  const updateBus = (i, f, v) => { const c = [...buses]; c[i][f] = v; setBuses(c); };
  const removeBus = (i) => { const c = [...buses]; c.splice(i, 1); setBuses(c); };

  const totalCapacity = buses.reduce((sum, bus) => sum + (Number(bus.capacity) || 0), 0);
  const splitLimit = Number.parseInt(maxAvailability, 10) || 0;
  const exceedsSplitLimit = splitLimit > 0 && totalCapacity > splitLimit;
  const shouldSplitOnCreate = splitIfExceeded && exceedsSplitLimit;

  const distributeBusesInTwoTrips = (sourceBuses) => {
    if (sourceBuses.length < 2) return null;

    const normalized = sourceBuses.map((bus) => ({
      ...bus,
      capacity: Number(bus.capacity) || 0,
    }));

    const groupOne = [];
    const groupTwo = [];
    let capOne = 0;
    let capTwo = 0;

    for (const bus of normalized) {
      if (capOne <= capTwo) {
        groupOne.push(bus);
        capOne += bus.capacity;
      } else {
        groupTwo.push(bus);
        capTwo += bus.capacity;
      }
    }

    if (groupOne.length === 0 || groupTwo.length === 0) {
      return null;
    }

    return { groupOne, groupTwo };
  };

  const createOneTrip = async (token, tripName, tripStops, tripBuses) => {
    const tripRes = await fetch(apiUrl("/trips"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: tripName,
        type,
        waitlist_start_day: waitlistEnabled ? Number(waitlistStartDay) : null,
        waitlist_start_time: waitlistEnabled ? waitlistStartTime : null,
        waitlist_end_day: waitlistEnabled && waitlistHasEnd ? Number(waitlistEndDay) : null,
        waitlist_end_time: waitlistEnabled && waitlistHasEnd ? waitlistEndTime : null,
        waitlist_start_at: null,
        waitlist_end_at: null,
      }),
    });

    const trip = await tripRes.json();
    if (!tripRes.ok) {
      throw new Error(trip?.error || "No se pudo crear traslado");
    }

    for (let i = 0; i < tripStops.length; i++) {
      const stop = tripStops[i];
      const stopRes = await fetch(apiUrl(`/trips/${trip.id}/stops`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: stop.name, time: stop.time, order: i + 1 }),
      });

      if (!stopRes.ok) {
        const stopJson = await stopRes.json().catch(() => ({}));
        throw new Error(stopJson?.error || "No se pudieron guardar paradas");
      }
    }

    for (const bus of tripBuses) {
      const busRes = await fetch(apiUrl(`/trips/${trip.id}/buses`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(bus),
      });

      if (!busRes.ok) {
        const busJson = await busRes.json().catch(() => ({}));
        throw new Error(busJson?.error || "No se pudieron guardar vehículos");
      }
    }
  };

  const createTrip = async () => {
    if (submitting) return;
    if (buses.length === 0) { alert("Agregá al menos un vehículo."); return; }
    if (stops.length === 0) { alert("Agregá al menos una parada."); return; }

    if (shouldSplitOnCreate) {
      if (buses.length < 2) {
        alert("Para dividir en 2 traslados necesitás al menos 2 vehículos.");
        return;
      }

      const stopsOne = stops.filter((stop) => stop.split_target !== "2");
      const stopsTwo = stops.filter((stop) => stop.split_target === "2");
      if (stopsOne.length === 0 || stopsTwo.length === 0) {
        alert("Asigná al menos una parada en cada traslado (1 y 2).");
        return;
      }
    }

    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        alert("Sesión expirada");
        return;
      }

      if (shouldSplitOnCreate) {
        const distributed = distributeBusesInTwoTrips(buses);
        if (!distributed) {
          alert("No se pudieron distribuir los vehículos entre los 2 traslados.");
          return;
        }

        const stopsOne = stops.filter((stop) => stop.split_target !== "2");
        const stopsTwo = stops.filter((stop) => stop.split_target === "2");
        const nameOne = splitTripOneName.trim() || `${name || "Traslado"} 1`;
        const nameTwo = splitTripTwoName.trim() || `${name || "Traslado"} 2`;

        await createOneTrip(token, nameOne, stopsOne, distributed.groupOne);
        await createOneTrip(token, nameTwo, stopsTwo, distributed.groupTwo);
      } else {
        await createOneTrip(token, name, stops, buses);
      }

      setSuccess(true);
      setTimeout(() => { if (onCreated) onCreated(); }, 1500);
    } catch (err) {
      alert(err?.message || "No se pudo crear el traslado");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="page full-center fade-up">
        <div className="card glass-card" style={{ padding: '40px', textAlign: 'center' }}>
          <h2 className="large-title">✅ Traslado creado</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="page fade-up">
      <header className="stack-sm" style={{ marginBottom: 32 }}>
        <h1 className="large-title">Nuevo Traslado</h1>
        <p className="caption">Configurá las paradas y vehículos</p>
      </header>

      <div className="inset-group">
        <h3 className="subheadline">Información General</h3>
        <div className="card glass-card stack-sm">
          <input placeholder="Nombre del traslado (ej: Micro 1)" value={name} onChange={e => setName(e.target.value)} />
          <select value={type} onChange={e => setType(e.target.value)}>
            <option value="ida">Ida</option>
            <option value="vuelta">Vuelta</option>
          </select>
          
          <div className="divider" />

          <div className="stack-sm">
            <h4 className="caption" style={{ fontWeight: "bold" }}>División automática de traslado</h4>
            <label className="row" style={{ alignItems: "center", gap: 8 }}>
              <input
                style={{ width: "auto", marginBottom: 0 }}
                type="checkbox"
                checked={splitIfExceeded}
                onChange={e => setSplitIfExceeded(e.target.checked)}
              />
              <span className="body">Dividir en 2 traslados si se supera el límite</span>
            </label>
            <div className="row">
              <input
                type="number"
                min="1"
                value={maxAvailability}
                onChange={e => setMaxAvailability(e.target.value)}
                placeholder="Límite disponibilidad"
              />
              <span className="caption" style={{ alignSelf: "center" }}>cupos máx. por traslado</span>
            </div>
            <p className="caption">
              Capacidad actual configurada: <b>{totalCapacity}</b> {splitLimit > 0 ? `(límite ${splitLimit})` : ""}
            </p>
            {splitIfExceeded ? (
              <p className="caption" style={{ color: exceedsSplitLimit ? "var(--ios-system-orange)" : "inherit" }}>
                {exceedsSplitLimit ? "Se crearán 2 traslados al guardar." : "No supera el límite, se creará 1 traslado."}
              </p>
            ) : null}
          </div>
          
          <div className="stack-sm">
            <label className="row" style={{ alignItems: "center", gap: 8 }}>
              <input style={{ width: 'auto', marginBottom: 0 }} type="checkbox" checked={waitlistEnabled} onChange={e => setWaitlistEnabled(e.target.checked)} />
              <span className="body">Lista de espera</span>
            </label>
            {waitlistEnabled && (
              <div className="stack-sm fade-up" style={{ marginTop: 8 }}>
                <p className="caption">Inicio lista de espera (día y hora):</p>
                <div className="row">
                  <select value={waitlistStartDay} onChange={e => setWaitlistStartDay(e.target.value)}>
                    {WEEK_DAYS.map((day) => <option key={day.value} value={String(day.value)}>{day.label}</option>)}
                  </select>
                  <input type="time" value={waitlistStartTime} onChange={e => setWaitlistStartTime(e.target.value)} />
                </div>
                <label className="row" style={{ alignItems: "center", gap: 8 }}>
                  <input style={{ width: 'auto', marginBottom: 0 }} type="checkbox" checked={waitlistHasEnd} onChange={e => setWaitlistHasEnd(e.target.checked)} />
                  <span className="body">Programar fin</span>
                </label>
                {waitlistHasEnd && (
                  <div className="row">
                    <select value={waitlistEndDay} onChange={e => setWaitlistEndDay(e.target.value)}>
                      {WEEK_DAYS.map((day) => <option key={day.value} value={String(day.value)}>{day.label}</option>)}
                    </select>
                    <input type="time" value={waitlistEndTime} onChange={e => setWaitlistEndTime(e.target.value)} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="inset-group" style={{ marginTop: 32 }}>
        <h3 className="subheadline">Paradas</h3>
        <div className="stack-sm">
          <select defaultValue="" onChange={e => e.target.value && loadFromTemplate(e.target.value)}>
            <option value="">Cargar desde plantilla...</option>
            {templates.filter(t => t.type === type).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>

          <div className="inset-list">
            {stops.map((s, i) => (
              <div key={i} className="card glass-card row" style={{ borderRadius: 0, border: 'none', borderBottom: '0.5px solid rgba(255,255,255,0.05)', padding: '12px' }}>
                <input style={{ flex: 2, marginBottom: 0 }} placeholder="Nombre parada" value={s.name} onChange={e => updateStop(i, "name", e.target.value)} />
                <input style={{ width: '120px', marginBottom: 0 }} type="time" value={s.time} onChange={e => shiftTimes(i, e.target.value)} />
                {shouldSplitOnCreate ? (
                  <select style={{ width: '120px', marginBottom: 0 }} value={s.split_target || "1"} onChange={e => updateStop(i, "split_target", e.target.value)}>
                    <option value="1">Traslado 1</option>
                    <option value="2">Traslado 2</option>
                  </select>
                ) : null}
                <button className="btn-plain" onClick={() => removeStop(i)}><IconTrash/></button>
              </div>
            ))}
          </div>
          {shouldSplitOnCreate ? (
            <div className="stack-sm">
              <input placeholder="Nombre traslado 1 (opcional)" value={splitTripOneName} onChange={e => setSplitTripOneName(e.target.value)} />
              <input placeholder="Nombre traslado 2 (opcional)" value={splitTripTwoName} onChange={e => setSplitTripTwoName(e.target.value)} />
              <p className="caption">Asigná cada parada al traslado 1 o 2.</p>
            </div>
          ) : null}
          <button className="btn-secondary" onClick={addStop}>+ Agregar parada</button>
        </div>
      </div>

      <div className="inset-group" style={{ marginTop: 32 }}>
        <h3 className="subheadline">Vehículos</h3>
        <div className="stack-sm">
          <div className="inset-list">
            {buses.map((b, i) => (
              <div key={i} className="card glass-card row" style={{ borderRadius: 0, border: 'none', borderBottom: '0.5px solid rgba(255,255,255,0.05)', padding: '12px' }}>
                <input style={{ flex: 2, marginBottom: 0 }} placeholder="Nombre vehículo" value={b.name} onChange={e => updateBus(i, "name", e.target.value)} />
                <input style={{ width: '100px', marginBottom: 0 }} type="number" placeholder="Cap." value={b.capacity} onChange={e => updateBus(i, "capacity", e.target.value)} />
                <button className="btn-plain" onClick={() => removeBus(i)}><IconTrash/></button>
              </div>
            ))}
          </div>
          <button className="btn-secondary" onClick={addBus}>+ Agregar vehículo</button>
        </div>
      </div>

      <div className="inset-group stack" style={{ marginTop: 40, paddingBottom: 60 }}>
        <button className="btn-primary" onClick={createTrip} disabled={submitting}>{submitting ? "Creando..." : (shouldSplitOnCreate ? "Crear 2 Traslados" : "Crear Traslado")}</button>
        {onCreated && <button className="btn-plain" onClick={onCreated} disabled={submitting}>Cancelar</button>}
      </div>
    </div>
  );
}
