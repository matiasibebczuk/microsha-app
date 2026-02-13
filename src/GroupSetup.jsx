import { useState } from "react";
import { supabase } from "./supabase";
import { API_BASE_URL, apiUrl } from "./api";

export default function GroupSetup({ role, onDone }) {
  const [mode, setMode] = useState(role === "admin" ? "choose" : "join");
  const [groupId, setGroupId] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token;
  };

  const submit = async (endpoint) => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        alert("Sesión expirada");
        return;
      }

      if (endpoint === "create" && !groupId.trim()) {
        alert("Completá el ID de grupo");
        return;
      }

      const body = { name: name.trim(), password };
      if (endpoint === "create") {
        body.groupId = groupId.trim();
      }

      const res = await fetch(apiUrl(`/groups/${endpoint}`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) {
        alert(json?.error || "No se pudo guardar el grupo");
        return;
      }

      alert(`Grupo activo: ${json.groupName}`);
      onDone?.();
    } catch (err) {
      alert(
        err?.message?.includes("Failed to fetch")
          ? `No se pudo conectar al backend. Verificá que esté corriendo en ${API_BASE_URL}`
          : err.message || "No se pudo completar la operación de grupo"
      );
    } finally {
      setLoading(false);
    }
  };

  if (mode === "choose") {
    return (
      <div className="page-narrow stack">
        <div className="card stack">
          <h2 className="title">Configuración inicial de grupo</h2>
          <p className="subtitle">¿Querés crear un grupo nuevo o unirte a uno existente?</p>
          <div className="row">
            <button onClick={() => setMode("create")}>Crear grupo</button>
            <button className="btn-secondary" onClick={() => setMode("join")}>Unirme a grupo</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-narrow stack">
      <div className="card stack">
        <h2 className="title">{mode === "create" ? "Crear grupo" : "Unirse a grupo"}</h2>

        <div className="stack-sm">
          {mode === "create" && (
            <input
              placeholder="ID de grupo (igual al de tus socios)"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
            />
          )}

          <input
            placeholder="Nombre del grupo"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            type="password"
            placeholder="Contraseña del grupo"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="row">
          {mode === "create" ? (
            <button onClick={() => submit("create")} disabled={loading}>
              {loading ? "Creando..." : "Crear y continuar"}
            </button>
          ) : (
            <button onClick={() => submit("join")} disabled={loading}>
              {loading ? "Uniendo..." : "Unirme y continuar"}
            </button>
          )}

          {role === "admin" && (
            <button className="btn-secondary" onClick={() => setMode("choose")}>Volver</button>
          )}
        </div>
      </div>
    </div>
  );
}
