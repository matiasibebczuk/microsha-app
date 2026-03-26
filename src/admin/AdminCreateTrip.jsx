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
  const [waitlistStartDay, setWaitlistStartDay] = useState("1");
  const [waitlistStartTime, setWaitlistStartTime] = useState("08:00");
  const [waitlistHasEnd, setWaitlistHasEnd] = useState(false);
  const [waitlistEndDay, setWaitlistEndDay] = useState("1");
  const [waitlistEndTime, setWaitlistEndTime] = useState("09:00");

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

  const addStop = () => setStops([...stops, { name: "", time: "" }]);
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
      return { name: s.name, time: `${hh}:${mm}` };
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

  const createTrip = async () => {
    if (submitting) return;
    if (buses.length === 0) { alert("Agregá al menos un vehículo."); return; }
    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const tripRes = await fetch(apiUrl("/trips"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` },
        body: JSON.stringify({
          name, type,
          waitlist_start_day: waitlistEnabled ? Number(waitlistStartDay) : null,
          waitlist_start_time: waitlistEnabled ? waitlistStartTime : null,
          waitlist_end_day: waitlistEnabled && waitlistHasEnd ? Number(waitlistEndDay) : null,
          waitlist_end_time: waitlistEnabled && waitlistHasEnd ? waitlistEndTime : null,
          waitlist_start_at: null,
          waitlist_end_at: null,
        }),
      });
      const trip = await tripRes.json();
      if (!tripRes.ok) { alert(trip.error); return; }
      for (let i = 0; i < stops.length; i++) {
        await fetch(apiUrl(`/trips/${trip.id}/stops`), {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` },
          body: JSON.stringify({ name: stops[i].name, time: stops[i].time, order: i + 1 }),
        });
      }
      for (const b of buses) {
        await fetch(apiUrl(`/trips/${trip.id}/buses`), {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` },
          body: JSON.stringify(b),
        });
      }
      setSuccess(true);
      setTimeout(() => { if (onCreated) onCreated(); }, 1500);
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
                <button className="btn-plain" onClick={() => removeStop(i)}><IconTrash/></button>
              </div>
            ))}
          </div>
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
        <button className="btn-primary" onClick={createTrip} disabled={submitting}>{submitting ? "Creando..." : "Crear Traslado"}</button>
        {onCreated && <button className="btn-plain" onClick={onCreated} disabled={submitting}>Cancelar</button>}
      </div>
    </div>
  );
}
