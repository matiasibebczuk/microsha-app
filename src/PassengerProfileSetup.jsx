import { useState } from "react";
import { apiUrl } from "./api";
import LoadingState from "./ui/LoadingState";
import MessageBanner from "./ui/MessageBanner";

const PHONE_REGEX = /^11\d{8}$/;
const ROLE_OPTIONS = ["Janij", "Madrij", "Profe", "Coordinador", "Mejan"];
const MERCAZ_OPTIONS = ["Olami", "Iedi", "Maaian", "Shaia", "Netzaj", "Edma 47", "Edma 48"];

function parseDescription(value) {
  const text = String(value || "").trim();
  if (!text) {
    return { role: "", mercaz: "", legacy: "" };
  }

  // Accept previous formats like "Madrij - Olami" and tolerate extra spaces/dashes.
  const parts = text.split("-").map((part) => part.trim()).filter(Boolean);
  const parsedRole = parts.find((part) => ROLE_OPTIONS.includes(part)) || "";
  const parsedMercaz = parts.find((part) => MERCAZ_OPTIONS.includes(part)) || "";

  if (parsedRole && parsedMercaz) {
    return { role: parsedRole, mercaz: parsedMercaz, legacy: "" };
  }

  return { role: parsedRole, mercaz: parsedMercaz, legacy: text };
}

export default function PassengerProfileSetup({ user, onCompleted, onSessionExpired }) {
  const [phone, setPhone] = useState(user?.phone || "");
  const initialDescription = parseDescription(user?.description || "");
  const [role, setRole] = useState(initialDescription.role);
  const [mercaz, setMercaz] = useState(initialDescription.mercaz);
  const [legacyDescription] = useState(initialDescription.legacy);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    const normalizedPhone = String(phone || "").replace(/\D/g, "").trim();
    const normalizedRole = String(role || "").trim();
    const normalizedMercaz = String(mercaz || "").trim();

    const isRoleValid = ROLE_OPTIONS.includes(normalizedRole);
    const isMercazValid = MERCAZ_OPTIONS.includes(normalizedMercaz);
    const normalizedDescription = `${normalizedRole} - ${normalizedMercaz}`;

    if (!PHONE_REGEX.test(normalizedPhone)) {
      setError("El teléfono debe empezar con 11 y tener 10 dígitos. Ejemplo: 1155685941");
      return;
    }

    if (!isRoleValid || !isMercazValid) {
      setError("Seleccioná rol y mercaz válidos.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(apiUrl("/auth/passenger-profile"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-passenger-token": user.passengerToken,
        },
        body: JSON.stringify({
          phone: normalizedPhone,
          description: normalizedDescription,
        }),
      });

      const json = await res.json();

      if (res.status === 401) {
        onSessionExpired?.();
        return;
      }

      if (!res.ok) {
        setError(json?.error || "No se pudieron guardar los datos");
        return;
      }

      onCompleted?.({
        ...user,
        ...json,
        phone: normalizedPhone,
        description: normalizedDescription,
        needsProfileCompletion: false,
      });
    } catch {
      setError("No se pudo conectar con el servidor. Intentá nuevamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-narrow stack">
      <div className="card stack">
        <div>
          <h2 className="title">Completá tu perfil</h2>
          <p className="subtitle">Antes de anotarte necesitamos teléfono, rol y mercaz.</p>
        </div>

        <MessageBanner message={error} />

        <div className="stack-sm">
          <input
            placeholder="Teléfono (ej: 1155685941)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Seleccioná rol</option>
            {ROLE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>

          <select value={mercaz} onChange={(e) => setMercaz(e.target.value)}>
            <option value="">Seleccioná mercaz</option>
            {MERCAZ_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>

          {legacyDescription ? (
            <div className="caption" style={{ opacity: 0.8 }}>
              Valor anterior detectado: "{legacyDescription}". Guardaremos el formato nuevo: "{role || "Rol"} - {mercaz || "Mercaz"}".
            </div>
          ) : null}
        </div>

        <div className="row">
          <button onClick={submit} disabled={submitting}>
            {submitting ? "Guardando..." : "Guardar y continuar"}
          </button>
          <button className="btn-secondary" onClick={() => onSessionExpired?.()} disabled={submitting}>
            Cerrar sesión
          </button>
        </div>

        {submitting ? <LoadingState compact label="Guardando datos..." /> : null}
      </div>
    </div>
  );
}
