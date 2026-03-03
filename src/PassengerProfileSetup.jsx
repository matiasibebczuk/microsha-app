import { useState } from "react";
import { apiUrl } from "./api";
import LoadingState from "./ui/LoadingState";
import MessageBanner from "./ui/MessageBanner";

const PHONE_REGEX = /^11\d{8}$/;

export default function PassengerProfileSetup({ user, onCompleted, onSessionExpired }) {
  const [phone, setPhone] = useState(user?.phone || "");
  const [description, setDescription] = useState(user?.description || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    const normalizedPhone = String(phone || "").replace(/\D/g, "").trim();
    const normalizedDescription = String(description || "").trim();

    if (!PHONE_REGEX.test(normalizedPhone)) {
      setError("El teléfono debe empezar con 11 y tener 10 dígitos. Ejemplo: 1155685941");
      return;
    }

    if (!normalizedDescription) {
      setError("La descripción es obligatoria.");
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
          <p className="subtitle">Antes de anotarte necesitamos teléfono y descripción.</p>
        </div>

        <MessageBanner message={error} />

        <div className="stack-sm">
          <input
            placeholder="Teléfono (ej: 1155685941)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <textarea
            rows={3}
            placeholder='Descripción (ej: madre / coordi / asistente de Maaian)'
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
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
