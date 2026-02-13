import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { IconEdit, IconTrash } from "./ui/icons";
import { apiUrl } from "./api";

export default function TemplateManager({ onBack }) {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);

  const [name, setName] = useState("");
  const [type, setType] = useState("ida");

  const [stops, setStops] = useState([]);

  // ========================
  // LISTAR PLANTILLAS
  // ========================
  async function loadTemplates() {
    const { data } = await supabase.auth.getSession();

    const res = await fetch(apiUrl("/templates"), {
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
      },
    });

    const json = await res.json();

    if (!Array.isArray(json)) {
      console.error("Error backend:", json);
      return;
    }

    setTemplates(json);
  }

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
      if (!Array.isArray(json)) {
        console.error("Error backend:", json);
        return;
      }

      if (alive) {
        setTemplates(json);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // ========================
  // CREAR PLANTILLA
  // ========================
  const createTemplate = async () => {
    const { data } = await supabase.auth.getSession();

    const res = await fetch(apiUrl("/templates"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`,
      },
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

  // ========================
  // CARGAR PARADAS
  // ========================
  const loadStops = async (template) => {
    const { data } = await supabase.auth.getSession();

    setSelected(template);

    const res = await fetch(
      apiUrl(`/templates/${template.id}/stops`),
      {
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
        },
      }
    );

    const json = await res.json();
    setStops(json || []);
  };

  // ========================
  // AGREGAR PARADA
  // ========================
  const addStop = () => {
    setStops([
      ...stops,
      {
        name: "",
        order_index: stops.length + 1,
        offset_minutes:
          stops.length === 0
            ? 0
            : Number(stops[stops.length - 1].offset_minutes) + 10,
      },
    ]);
  };

  const updateStop = (index, field, value) => {
    const copy = [...stops];
    copy[index][field] = value;
    setStops(copy);
  };

  // ========================
  // GUARDAR PARADAS
  // ========================
  const saveStops = async () => {
    const { data } = await supabase.auth.getSession();

    for (const s of stops) {
      if (s.id) continue;

      await fetch(apiUrl(`/templates/${selected.id}/stops`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify(s),
      });
    }

    alert("Paradas guardadas");
    loadStops(selected);
  };

  // ========================
  // BORRAR PLANTILLA
  // ========================
  const deleteTemplate = async (id) => {
    if (!confirm("Eliminar plantilla?")) return;

    const { data } = await supabase.auth.getSession();

    await fetch(apiUrl(`/templates/${id}`), {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
      },
    });

    setSelected(null);
    loadTemplates();
  };

  // ========================
  // LISTA
  // ========================
  if (!selected) {
    return (
      <div className="page stack">
        <div className="card stack">
          <h1 className="title">Paradas predeterminadas</h1>

          <div className="stack-sm">
            <h3 className="section-title">Nueva plantilla de paradas</h3>
            <input
              placeholder="Nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="ida">Ida</option>
              <option value="vuelta">Vuelta</option>
            </select>

            <button onClick={createTemplate}>Crear plantilla</button>
          </div>

          <hr className="divider" />

          <div className="grid">
            {templates.map((t) => (
              <div key={t.id} className="list-item row-between">
                <span><b>{t.name}</b> ({t.type})</span>
                <div className="row">
                  <button className="btn-secondary btn-with-icon" onClick={() => loadStops(t)}>
                    <IconEdit />
                    Editar paradas
                  </button>
                  <button className="btn-danger btn-with-icon" onClick={() => deleteTemplate(t.id)}>
                    <IconTrash />
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>

          <hr className="divider" />
          <button className="btn-secondary" onClick={onBack}>⬅ Volver al dashboard admin</button>
        </div>
      </div>
    );
  }

  // ========================
  // EDITAR PARADAS
  // ========================
  return (
    <div className="page stack">
      <div className="card stack">
        <h1 className="title">Paradas predeterminadas: {selected.name}</h1>

        <div className="grid">
          {stops.map((s, i) => (
            <div key={i} className="list-item row">
              <input
                placeholder="Nombre"
                value={s.name}
                onChange={(e) => updateStop(i, "name", e.target.value)}
              />

              <input
                type="number"
                value={s.offset_minutes}
                onChange={(e) => updateStop(i, "offset_minutes", e.target.value)}
              />

              <span className="muted">min</span>
            </div>
          ))}
        </div>

        <div className="row">
          <button className="btn-secondary" onClick={addStop}>+ Agregar parada</button>
        </div>

        <hr className="divider" />

        <div className="row">
          <button onClick={saveStops}>Guardar paradas</button>
          <button className="btn-secondary" onClick={() => setSelected(null)}>⬅ Volver a plantillas</button>
        </div>
      </div>
    </div>
  );
}
