import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { IconTrash } from "./ui/icons";
import { apiUrl } from "./api";
import { fetchWithRetry } from "./lib/fetchWithRetry";

export default function TemplateManager({ onBack }) {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("ida");
  const [stops, setStops] = useState([]);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [savingStops, setSavingStops] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState(null);
  const [duplicatingTemplateId, setDuplicatingTemplateId] = useState(null);
  const [loadingTemplateId, setLoadingTemplateId] = useState(null);
  const savingStopsRef = useRef(false);

  const normalizeStopOrder = (list) =>
    (Array.isArray(list) ? list : [])
      .filter((stop) => stop && typeof stop === "object")
      .map((stop, index) => ({
        ...stop,
        name: String(stop.name || ""),
        offset_minutes: Number(stop.offset_minutes ?? stop.offset ?? 0) || 0,
        order_index: index + 1,
      }));

  async function loadTemplates() {
    const { data } = await supabase.auth.getSession();
    const res = await fetchWithRetry(apiUrl("/templates"), {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
    const json = await res.json();
    if (Array.isArray(json)) setTemplates(json);
  }

  useEffect(() => {
    let alive = true;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      const res = await fetchWithRetry(apiUrl("/templates"), {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      const json = await res.json();
      if (alive && Array.isArray(json)) {
        setTemplates(json);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const createTemplate = async () => {
    if (creatingTemplate) return;
    if (!name.trim()) return;
    setCreatingTemplate(true);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetchWithRetry(apiUrl("/templates"), {
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
    } finally {
      setCreatingTemplate(false);
    }
  };

  const loadStops = async (template) => {
    if (loadingTemplateId === template.id) return;
    setLoadingTemplateId(template.id);
    const { data } = await supabase.auth.getSession();
    setSelected(template);
    try {
      const res = await fetchWithRetry(apiUrl(`/templates/${template.id}/stops`), {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      const json = await res.json();
      const normalized = normalizeStopOrder(json || []);
      setStops(normalizeStopOrder(normalized));
    } finally {
      setLoadingTemplateId(null);
    }
  };

  const addStop = () => {
    setStops((prev) => {
      const next = normalizeStopOrder(prev);
      const lastOffset = next.length > 0
        ? Number(next[next.length - 1]?.offset_minutes ?? 0) || 0
        : 0;

      next.push({
        name: "",
        order_index: next.length + 1,
        offset_minutes: next.length === 0 ? 0 : lastOffset + 10,
      });

      return normalizeStopOrder(next);
    });
  };

  const updateStop = (index, field, value) => {
    setStops((prev) => {
      const copy = normalizeStopOrder(prev);
      copy[index] = {
        ...copy[index],
        [field]: value,
      };
      return normalizeStopOrder(copy);
    });
  };

  const removeStop = (index) => {
    setStops((prev) => normalizeStopOrder(prev.filter((_, i) => i !== index)));
  };

  const moveStop = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= stops.length) return;
    setStops((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(target, 0, moved);
      return normalizeStopOrder(copy);
    });
  };

  const saveStops = async () => {
    if (savingStopsRef.current) return;
    const normalized = normalizeStopOrder(stops).map((stop) => ({
      name: String(stop.name || "").trim(),
      order_index: stop.order_index,
      offset_minutes: Number.parseInt(stop.offset_minutes, 10) || 0,
    }));

    if (normalized.some((stop) => !stop.name)) {
      alert("Todas las paradas deben tener nombre");
      return;
    }

    savingStopsRef.current = true;
    setSavingStops(true);
    const { data } = await supabase.auth.getSession();
    try {
      const res = await fetchWithRetry(apiUrl(`/templates/${selected.id}/stops`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ stops: normalized }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "No se pudo guardar");
        return;
      }
      alert("Paradas guardadas");
      loadStops(selected);
    } finally {
      savingStopsRef.current = false;
      setSavingStops(false);
    }
  };

  const deleteTemplate = async (id) => {
    if (deletingTemplateId === id) return;
    const template = templates.find((item) => String(item.id) === String(id));
    const templateName = String(template?.name || "esta plantilla");
    if (!confirm(`¿Seguro que querés eliminar "${templateName}"? Esta acción no se puede deshacer.`)) return;
    setDeletingTemplateId(id);
    const { data } = await supabase.auth.getSession();
    try {
      await fetchWithRetry(apiUrl(`/templates/${id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      setSelected(null);
      loadTemplates();
    } finally {
      setDeletingTemplateId(null);
    }
  };

  const duplicateTemplate = async (template) => {
    if (!template?.id || duplicatingTemplateId === template.id) return;
    setDuplicatingTemplateId(template.id);

    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) {
      setDuplicatingTemplateId(null);
      alert("Sesión expirada");
      return;
    }

    try {
      const createRes = await fetchWithRetry(apiUrl("/templates"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: `${template.name} (copia)`,
          type: template.type,
        }),
      });

      const createJson = await createRes.json().catch(() => ({}));
      if (!createRes.ok || !createJson?.id) {
        alert(createJson?.error || "No se pudo duplicar la plantilla");
        return;
      }

      const stopsRes = await fetchWithRetry(apiUrl(`/templates/${template.id}/stops`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const stopsJson = await stopsRes.json().catch(() => ([]));
      if (!stopsRes.ok) {
        alert("La plantilla se creó, pero no se pudieron copiar las paradas");
        await loadTemplates();
        return;
      }

      const normalizedStops = normalizeStopOrder(stopsJson || []).map((stop) => ({
        name: String(stop.name || "").trim(),
        order_index: stop.order_index,
        offset_minutes: Number.parseInt(stop.offset_minutes, 10) || 0,
      }));

      if (normalizedStops.length > 0) {
        const saveStopsRes = await fetchWithRetry(apiUrl(`/templates/${createJson.id}/stops`), {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ stops: normalizedStops }),
        });

        const saveStopsJson = await saveStopsRes.json().catch(() => ({}));
        if (!saveStopsRes.ok) {
          alert(saveStopsJson?.error || "La plantilla se creó, pero no se pudieron copiar las paradas");
        }
      }

      await loadTemplates();
      alert("Plantilla duplicada");
    } finally {
      setDuplicatingTemplateId(null);
    }
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
              <button className="btn-primary" onClick={createTemplate} disabled={creatingTemplate}>{creatingTemplate ? "Creando..." : "Crear"}</button>
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
                    <button className="btn-secondary" onClick={() => loadStops(t)} disabled={loadingTemplateId === t.id || deletingTemplateId === t.id}>{loadingTemplateId === t.id ? "Cargando..." : "Editar"}</button>
                    <button
                      className="btn-secondary"
                      onClick={() => duplicateTemplate(t)}
                      disabled={duplicatingTemplateId === t.id || deletingTemplateId === t.id}
                    >
                      {duplicatingTemplateId === t.id ? "Duplicando..." : "Duplicar"}
                    </button>
                    <button className="btn-danger btn-with-icon" onClick={() => deleteTemplate(t.id)} disabled={deletingTemplateId === t.id}>
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
              <span className="caption">#{i + 1}</span>
              <input placeholder="Nombre parada" value={s?.name || ""} onChange={e => updateStop(i, "name", e.target.value)} />
              <div className="row">
                <input type="number" value={Number(s?.offset_minutes ?? 0)} onChange={e => updateStop(i, "offset_minutes", e.target.value)} />
                <span className="caption">min</span>
              </div>
              <div className="row">
                <button className="btn-secondary" type="button" onClick={() => moveStop(i, -1)} disabled={i === 0 || savingStops}>Subir</button>
                <button className="btn-secondary" type="button" onClick={() => moveStop(i, 1)} disabled={i === stops.length - 1 || savingStops}>Bajar</button>
                <button className="btn-danger" type="button" onClick={() => removeStop(i)} disabled={savingStops}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
        <button className="btn-secondary" onClick={addStop} disabled={savingStops}>+ Agregar parada</button>
      </div>

      <div className="inset-group stack">
        <button className="btn-primary" onClick={saveStops} disabled={savingStops}>{savingStops ? "Guardando..." : "Guardar Plantilla"}</button>
      </div>
    </div>
  );
}
