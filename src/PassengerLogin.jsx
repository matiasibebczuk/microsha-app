import { useState } from "react";
import { apiUrl } from "./api";

export default function PassengerLogin({ onLogin, onBack }) {
  const [dni, setDni] = useState("");
  const [memberNumber, setMemberNumber] = useState("");

  const login = async () => {
    const res = await fetch(apiUrl("/auth/passenger-login"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dni, memberNumber }),
    });

    if (!res.ok) {
      alert("Datos incorrectos");
      return;
    }

    const user = await res.json();
    onLogin(user);
  };

  return (
    <div className="page-narrow stack">
      <div className="card stack">
        <div>
          <h2 className="title">Ingreso pasajeros</h2>
          <p className="subtitle">Accedé con tus datos de socio para anotarte.</p>
        </div>

        <div className="stack-sm">
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
          <button onClick={login}>Entrar</button>
          {onBack && (
            <button className="btn-secondary" onClick={onBack}>Volver</button>
          )}
        </div>
      </div>
    </div>
  );
}
