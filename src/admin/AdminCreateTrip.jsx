import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { apiUrl } from "../api";

export default function AdminCreateTrip({ onCreated }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("ida");

  const [stops, setStops] = useState([]);
  const [buses, setBuses] = useState([]);

  const [templates, setTemplates] = useState([]);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let alive = true;

    void (async () => {
      const { data } = await supabase.auth.getSession();

      const res = await fetch(apiUrl("/templates"), {
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
        },
      });

      const json = await res.json();
      if (alive) {
        setTemplates(Array.isArray(json) ? json : []);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // ========================
  // PARADAS
  // ========================
  const addStop = () => {
    setStops([...stops, { name: "", time: "" }]);
  };

  const updateStop = (index, field, value) => {
    const copy = [...stops];
    copy[index][field] = value;
    setStops(copy);
  };

  const removeStop = (index) => {
    const copy = [...stops];
    copy.splice(index, 1);
    setStops(copy);
  };

  // ========================
  // CARGAR DESDE PLANTILLA
  // ========================
  const loadFromTemplate = async (templateId) => {
    const { data } = await supabase.auth.getSession();

    const res = await fetch(
      apiUrl(`/templates/${templateId}/stops`),
      {
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
        },
      }
    );

    const json = await res.json();

    const base = "10:00"; // hora temporal
    const start = new Date(`1970-01-01T${base}`);

    const mapped = json.map((s) => {
      const d = new Date(start.getTime() + s.offset_minutes * 60000);
      const hh = d.getHours().toString().padStart(2, "0");
      const mm = d.getMinutes().toString().padStart(2, "0");
      return {
        name: s.name,
        time: `${hh}:${mm}`,
      };
    });

    setStops(mapped);
  };

  // ========================
  // AJUSTAR HORARIOS AUTOMÁTICO
  // ========================
  const shiftTimes = (index, newTime) => {
    if (index !== 0) {
      updateStop(index, "time", newTime);
      return;
    }

    if (!stops[0]?.time) {
      updateStop(index, "time", newTime);
      return;
    }

    const old = new Date(`1970-01-01T${stops[0].time}`);
    const updated = new Date(`1970-01-01T${newTime}`);
    const diff = updated - old;

    const newStops = stops.map((s) => {
      if (!s.time) return s;
      const date = new Date(`1970-01-01T${s.time}`);
      const newDate = new Date(date.getTime() + diff);
      const hh = newDate.getHours().toString().padStart(2, "0");
      const mm = newDate.getMinutes().toString().padStart(2, "0");
      return { ...s, time: `${hh}:${mm}` };
    });

    setStops(newStops);
  };

  // ========================
  // BUSES
  // ========================
  const addBus = () => {
    setBuses([...buses, { name: "", capacity: 40 }]);
  };

  const updateBus = (index, field, value) => {
    const copy = [...buses];
    copy[index][field] = value;
    setBuses(copy);
  };

  const removeBus = (index) => {
    const copy = [...buses];
    copy.splice(index, 1);
    setBuses(copy);
  };

  // ========================
  // CREAR
  // ========================
  const createTrip = async () => {
    if (buses.length === 0) {
      alert("Agregá al menos un vehículo antes de crear el traslado.");
      return;
    }

    if (buses.some((b) => !b.name || Number(b.capacity) <= 0)) {
      alert("Completá nombre y capacidad válida en todos los vehículos.");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();

    const tripRes = await fetch(apiUrl("/trips"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({ name, type }),
    });

    const trip = await tripRes.json();

    if (!tripRes.ok) {
      alert(trip.error);
      return;
    }

    // guardar paradas
    for (let i = 0; i < stops.length; i++) {
      await fetch(apiUrl(`/trips/${trip.id}/stops`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          name: stops[i].name,
          time: stops[i].time,
          order: i + 1,
        }),
      });
    }

    // guardar buses
    for (const b of buses) {
      await fetch(apiUrl(`/trips/${trip.id}/buses`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify(b),
      });
    }


    setSuccess(true);

    setTimeout(() => {
      if (onCreated) onCreated();
    }, 1500);
  };

  // ========================
  // SUCCESS
  // ========================
  if (success) {
    return (
      <div className="page full-center">
        <div className="card">
          <h2 className="title">✅ Traslado creado</h2>
        </div>
      </div>
    );
  }

  // ========================
  // UI
  // ========================
  return (
    <div className="page stack">
      <div className="card stack">
        <h1 className="title">Crear traslado</h1>

        <div className="stack-sm">
          <h3 className="section-title">Información</h3>
          <input
            placeholder="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="ida">Ida</option>
            <option value="vuelta">Vuelta</option>
          </select>
        </div>

        <hr className="divider" />

        <div className="stack-sm">
          <h3 className="section-title">Paradas</h3>
          <select defaultValue="" onChange={(e) => e.target.value && loadFromTemplate(e.target.value)}>
            <option value="">Seleccionar plantilla</option>
            {templates
              .filter((t) => t.type === type)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>

          <div className="grid">
            {stops.map((s, i) => (
              <div key={i} className="list-item row">
                <input
                  placeholder="Nombre parada"
                  value={s.name}
                  onChange={(e) => updateStop(i, "name", e.target.value)}
                />

                <input
                  type="time"
                  value={s.time}
                  onChange={(e) => shiftTimes(i, e.target.value)}
                />

                <button className="btn-danger" onClick={() => removeStop(i)}>Eliminar</button>
              </div>
            ))}
          </div>

          <button className="btn-secondary" onClick={addStop}>+ Agregar parada</button>
        </div>

        <hr className="divider" />

        <div className="stack-sm">
          <h3 className="section-title">Vehículos</h3>

          <div className="grid">
            {buses.map((b, i) => (
              <div key={i} className="list-item row">
                <input
                  placeholder="Nombre vehículo"
                  value={b.name}
                  onChange={(e) => updateBus(i, "name", e.target.value)}
                />

                <input
                  type="number"
                  value={b.capacity}
                  onChange={(e) => updateBus(i, "capacity", e.target.value)}
                />

                <button className="btn-danger" onClick={() => removeBus(i)}>Eliminar</button>
              </div>
            ))}
          </div>

          <button className="btn-secondary" onClick={addBus}>+ Agregar vehículo</button>
        </div>

        <hr className="divider" />

        <div className="row">
          <button onClick={createTrip}>Crear traslado</button>
          {onCreated && <button className="btn-secondary" onClick={onCreated}>Cancelar</button>}
        </div>
      </div>
    </div>
  );
}
