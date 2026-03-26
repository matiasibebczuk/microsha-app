import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { IconTrash } from "./ui/icons";
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
        <header className="row-between">
          <div className="stack-sm">
            <h1 className="large-title">Plantillas</h1>
            <p className="caption">Gestioná paradas predeterminadas</p>
          </div>
          <button className="btn-secondary" onClick={onBack}>Atrás</button>
        </header>

        <div className="inset-group">
          <h3 className="subheadline">Nueva Plantilla</h3>
          <div className="card stack-sm">
            <input placeholder="Nombre (ej: Recorrido Norte)" value={name} onChange={e => setName(e.target.value)} />
            <div className="row">
              <select value={type} onChange={e => setType(e.target.value)}>
                <option value="ida">Ida</option>
                <option value="vuelta">Vuelta</option>
              </select>
              <button className="btn-primary" onClick={createTemplate}>Crear</button>
            </div>
          </div>
        </div>

        <div className="inset-group">
          <h3 className="subheadline">Mis Plantillas</h3>
          <div className="grid">
            {templates.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-title">No hay plantillas creadas</p>
                <p className="empty-state-subtitle">Creá la primera para reutilizar paradas.</p>
              </div>
            ) : (
              templates.map((t) => (
                <div key={t.id} className="list-item row-between">
                  <div className="stack-sm">
                    <span className="body"><b>{t.name}</b></span>
                    <span className="caption">{t.type === 'ida' ? 'Ida' : 'Vuelta'}</span>
                  </div>
                  <div className="row">
                    <button className="btn-secondary" onClick={() => loadStops(t)}>Editar</button>
                    <button className="btn-danger btn-with-icon" onClick={() => deleteTemplate(t.id)}>
                      <IconTrash />
                    </button>
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
      <header className="row-between">
        <div className="stack-sm">
          <h1 className="large-title">{selected.name}</h1>
          <p className="caption">Configuración de paradas</p>
        </div>
        <button className="btn-secondary" onClick={() => setSelected(null)}>Volver</button>
      </header>

      <div className="inset-group">
        <h3 className="subheadline">Paradas & Offsets</h3>
        <div className="grid">
          {stops.map((s, i) => (
            <div key={i} className="list-item row">
              <input placeholder="Nombre parada" value={s.name} onChange={e => updateStop(i, "name", e.target.value)} />
              <div className="row">
                <input type="number" value={s.offset_minutes} onChange={e => updateStop(i, "offset_minutes", e.target.value)} />
                <span className="caption">min</span>
              </div>
            </div>
          ))}
        </div>
        <button className="btn-secondary" onClick={addStop}>+ Agregar parada</button>
      </div>

      <div className="inset-group stack">
        <button className="btn-primary" onClick={saveStops}>Guardar Plantilla</button>
      </div>
    </div>
  );
}
