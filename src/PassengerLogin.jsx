import { useState } from "react";
import { apiUrl } from "./api";
import LoadingState from "./ui/LoadingState";
import MessageBanner from "./ui/MessageBanner";
import microshaLogo from "./assets/MicroSHA_LOGO.png";

export default function PassengerLogin({ onLogin, onBack }) {
  const [dni, setDni] = useState("");
  const [memberNumber, setMemberNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const login = async () => {
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch(apiUrl("/auth/passenger-login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dni, memberNumber }),
      });

      if (!res.ok) {
        setError("Datos incorrectos. Revisá DNI y número de socio.");
        return;
      }

      const user = await res.json();
      onLogin(user);
    } catch {
      setError("No se pudo conectar con el servidor. Intentá nuevamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-narrow stack">
      <div className="ios-logo-container">
        <img src={microshaLogo} alt="MicroSHA Logo" />
      </div>

      <div className="card stack">
        <div>
          <h2 className="title">Ingreso pasajeros</h2>
          <p className="subtitle">Accedé con tus datos de socio para anotarte.</p>
        </div>

        <div className="stack-sm">
          <MessageBanner message={error} />

          <input
            placeholder="DNI"
            value={dni}
            onChange={(e) => setDni(e.target.value)}
          />

          <input
            placeholder="Número de socio"
            value={memberNumber}
            onChange={(e) => setMemberNumber(e.target.value)}
          />
        </div>

        <div className="row">
          <button onClick={login} disabled={submitting || !dni.trim() || !memberNumber.trim()}>
            {submitting ? "Ingresando..." : "Entrar"}
          </button>
          {onBack && (
            <button className="btn-secondary" onClick={onBack} disabled={submitting}>Volver</button>
          )}
        </div>

        {submitting ? <LoadingState compact label="Validando acceso..." /> : null}
      </div>
    </div>
  );
}
