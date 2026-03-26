import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { IconEdit, IconTrash, IconChevronRight } from "./ui/icons";
import { apiUrl } from "./api";

export default function TemplateManager({ onBack }) {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("ida");
  const [stops, setStops] = useState([]);

  async function loadTemplates() {
    const { data } = await supabase.auth.getSession();
    const res = await fetch(apiUrl("/templates"), {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
    const json = await res.json();
    if (Array.isArray(json)) setTemplates(json);
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  const createTemplate = async () => {
    if (!name.trim()) return;
    const { data } = await supabase.auth.getSession();
    const res = await fetch(apiUrl("/templates"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify({ name, type }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Error");
      return;
    }
    setName("");
    loadTemplates();
  };

  const loadStops = async (template) => {
    const { data } = await supabase.auth.getSession();
    setSelected(template);
    const res = await fetch(apiUrl(`/templates/${template.id}/stops`), {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
    const json = await res.json();
    setStops(json || []);
  };

  const addStop = () => {
    setStops([
      ...stops,
      {
        name: "",
        order_index: stops.length + 1,
        offset_minutes: stops.length === 0 ? 0 : Number(stops[stops.length - 1].offset_minutes) + 10,
      },
    ]);
  };

  const updateStop = (index, field, value) => {
    const copy = [...stops];
    copy[index][field] = value;
    setStops(copy);
  };

  const saveStops = async () => {
    const { data } = await supabase.auth.getSession();
    for (const s of stops) {
      if (s.id) continue;
      await fetch(apiUrl(`/templates/${selected.id}/stops`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify(s),
      });
    }
    alert("Paradas guardadas");
    loadStops(selected);
  };

  const deleteTemplate = async (id) => {
    if (!confirm("¿Eliminar plantilla?")) return;
    const { data } = await supabase.auth.getSession();
    await fetch(apiUrl(`/templates/${id}`), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
    setSelected(null);
    loadTemplates();
  };

  if (!selected) {
    return (
      <div className="page fade-up">
        <header className="row-between" style={{ marginBottom: 32 }}>
          <div className="stack-sm">
            <h1 className="large-title">Plantillas</h1>
            <p className="caption">Gestioná paradas predeterminadas</p>
          </div>
          <button className="btn-secondary" onClick={onBack}>Atrás</button>
        </header>

        <div className="inset-group">
          <h3 className="subheadline">Nueva Plantilla</h3>
          <div className="card glass-card stack-sm">
            <input placeholder="Nombre (ej: Recorrido Norte)" value={name} onChange={e => setName(e.target.value)} />
            <div className="row">
              <select style={{ flex: 1 }} value={type} onChange={e => setType(e.target.value)}>
                <option value="ida">Ida</option>
                <option value="vuelta">Vuelta</option>
              </select>
              <button className="btn-primary" style={{ flex: 1 }} onClick={createTemplate}>Crear</button>
            </div>
          </div>
        </div>

        <div className="inset-group" style={{ marginTop: 32 }}>
          <h3 className="subheadline">Mis Plantillas</h3>
          <div className="inset-list">
            {templates.length === 0 ? (
              <div className="card glass-card" style={{ padding: '16px', textAlign: 'center' }}>
                <p className="caption">No hay plantillas creadas.</p>
              </div>
            ) : (
              templates.map((t) => (
                <div key={t.id} className="card glass-card row-between" style={{ borderRadius: 0, border: 'none', borderBottom: '0.5px solid rgba(255,255,255,0.05)', padding: '16px' }}>
                  <div className="stack-sm">
                    <span className="body"><b>{t.name}</b></span>
                    <span className="caption">{t.type === 'ida' ? 'Ida' : 'Vuelta'}</span>
                  </div>
                  <div className="row">
                    <button className="btn-secondary" onClick={() => loadStops(t)}>Editar</button>
                    <button className="btn-plain" style={{ color: 'var(--ios-system-red)' }} onClick={() => deleteTemplate(t.id)}><IconTrash/></button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page fade-up">
      <header className="row-between" style={{ marginBottom: 32 }}>
        <div className="stack-sm">
          <h1 className="large-title">{selected.name}</h1>
          <p className="caption">Configuración de paradas</p>
        </div>
        <button className="btn-secondary" onClick={() => setSelected(null)}>Volver</button>
      </header>

      <div className="inset-group">
        <h3 className="subheadline">Paradas & Offsets</h3>
        <div className="inset-list">
          {stops.map((s, i) => (
            <div key={i} className="card glass-card row" style={{ borderRadius: 0, border: 'none', borderBottom: '0.5px solid rgba(255,255,255,0.05)', padding: '12px 16px' }}>
              <input style={{ flex: 1, marginBottom: 0 }} placeholder="Nombre parada" value={s.name} onChange={e => updateStop(i, "name", e.target.value)} />
              <div className="row" style={{ width: '120px' }}>
                <input style={{ width: '60px', marginBottom: 0, textAlign: 'right' }} type="number" value={s.offset_minutes} onChange={e => updateStop(i, "offset_minutes", e.target.value)} />
                <span className="caption">min</span>
              </div>
            </div>
          ))}
        </div>
        <button className="btn-secondary" style={{ marginTop: 12 }} onClick={addStop}>+ Agregar parada</button>
      </div>

      <div className="inset-group stack" style={{ marginTop: 40 }}>
        <button className="btn-primary" onClick={saveStops}>Guardar Plantilla</button>
      </div>
    </div>
  );
}
