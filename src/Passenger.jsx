import { useEffect, useState } from "react";
import { IconLogout } from "./ui/icons";
import { apiUrl } from "./api";

export default function Passenger({ user, onSessionExpired }) {
  const [trips, setTrips] = useState([]);
  const [step, setStep] = useState("ida");
  const [selectedTrip, setSelectedTrip] = useState(null);

  const [idaReservation, setIdaReservation] = useState(null);
  const [vueltaReservation, setVueltaReservation] = useState(null);

  useEffect(() => {
    if (!user?.passengerToken) {
      alert("Tu sesión de pasajero expiró. Iniciá sesión nuevamente.");
      onSessionExpired?.();
    }
  }, [user?.passengerToken, onSessionExpired]);

  useEffect(() => {
    let alive = true;

    void (async () => {
      const res = await fetch(apiUrl("/trips"), {
        headers: {
          "x-passenger-token": user.passengerToken,
        },
      });

      if (res.status === 401) {
        alert("Tu sesión de pasajero expiró. Iniciá sesión nuevamente.");
        onSessionExpired?.();
        return;
      }

      const json = await res.json();
      if (alive) {
        setTrips(Array.isArray(json) ? json : []);
      }
    })();

    return () => {
      alive = false;
    };
  }, [onSessionExpired, user.passengerToken]);

  // ========================
  // VER PARADAS
  // ========================
  if (selectedTrip) {
    return (
      <TripStops
        user={user}
        trip={selectedTrip}
        onSessionExpired={onSessionExpired}
        onBack={() => setSelectedTrip(null)}
        onReserved={(status) => {
          if (!status) return;

          if (step === "ida") {
            setIdaReservation(status);
            setSelectedTrip(null);
            setStep("vuelta");
          } else {
            setVueltaReservation(status);
            setSelectedTrip(null);
            setStep("resumen");
          }
        }}
      />
    );
  }

  // ========================
  // PASO IDA
  // ========================
  if (step === "ida") {
    return (
      <div className="page stack">
        <div className="card stack">
          <h1 className="title">Hola {user.name} 👋</h1>

          <h2 className="section-title">Traslados de ida</h2>

          <div className="grid">
            {trips
              .filter((t) => t.type === "ida")
              .map((t) => (
                <div key={t.id} className="list-item row-between">
                  <span>
                    <b>{t.name}</b> – comienza {t.first_time} {t.status === "closed" ? "(cerrado)" : ""}
                  </span>
                  <button
                    className={t.status === "closed" ? "btn-secondary" : ""}
                    disabled={t.status === "closed"}
                    onClick={() => {
                      if (t.status === "closed") return;
                      setSelectedTrip(t);
                    }}
                  >
                    Ver paradas
                  </button>
                </div>
              ))}
          </div>

          <hr className="divider" />

          <button
            className="btn-secondary"
            onClick={() => {
              setIdaReservation("no");
              setStep("vuelta");
            }}
          >
            No necesito ida
          </button>
        </div>
      </div>
    );
  }

  // ========================
  // PASO VUELTA
  // ========================
  if (step === "vuelta") {
    return (
      <div className="page stack">
        <div className="card stack">
          <h1 className="title">Hola {user.name} 👋</h1>

          <h2 className="section-title">Traslados de vuelta</h2>

          <div className="grid">
            {trips
              .filter((t) => t.type === "vuelta")
              .map((t) => (
                <div key={t.id} className="list-item row-between">
                  <span>
                    <b>{t.name}</b> – comienza {t.first_time} {t.status === "closed" ? "(cerrado)" : ""}
                  </span>
                  <button
                    className={t.status === "closed" ? "btn-secondary" : ""}
                    disabled={t.status === "closed"}
                    onClick={() => {
                      if (t.status === "closed") return;
                      setSelectedTrip(t);
                    }}
                  >
                    Ver paradas
                  </button>
                </div>
              ))}
          </div>

          <hr className="divider" />

          <button
            className="btn-secondary"
            onClick={() => {
              setVueltaReservation("no");
              setStep("resumen");
            }}
          >
            No necesito vuelta
          </button>
        </div>
      </div>
    );
  }

  // ========================
  // RESUMEN
  // ========================
  return (
    <div className="page stack">
      <div className="card stack">
        <h2 className="title">Resumen</h2>

        <p>
          <span className="badge">Ida</span>{" "}
          {idaReservation === "no"
            ? "No solicitada"
            : idaReservation || "No seleccionada"}
        </p>

        <p>
          <span className="badge">Vuelta</span>{" "}
          {vueltaReservation === "no"
            ? "No solicitada"
            : vueltaReservation || "No seleccionada"}
        </p>

        <hr className="divider" />

        <h3 className="section-title">¡Gracias por anotarte! 🙌</h3>

        <button className="btn-secondary btn-with-icon" onClick={() => onSessionExpired?.()}>
          <IconLogout />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

// ========================
// COMPONENTE PARADAS
// ========================
function TripStops({ trip, user, onBack, onReserved, onSessionExpired }) {
  const [stops, setStops] = useState([]);
  const [existing, setExisting] = useState(null);

  const handleSessionExpired = () => {
    alert("Tu sesión de pasajero expiró. Iniciá sesión nuevamente.");
    onSessionExpired?.();
  };

  const passengerFetch = async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        "x-passenger-token": user.passengerToken,
      },
    });

    if (res.status === 401) {
      handleSessionExpired();
      return null;
    }

    return res;
  };

  useEffect(() => {
    let alive = true;

    void (async () => {
      const stopsRes = await fetch(apiUrl(`/trips/${trip.id}/stops`), {
        headers: {
          "x-passenger-token": user.passengerToken,
        },
      });
      if (stopsRes.status === 401) {
        alert("Tu sesión de pasajero expiró. Iniciá sesión nuevamente.");
        onSessionExpired?.();
        return;
      }

      const existingRes = await fetch(
        apiUrl(`/reservations/me?tripId=${trip.id}`),
        {
          headers: {
            "x-passenger-token": user.passengerToken,
          },
        }
      );

      if (existingRes.status === 401) {
        alert("Tu sesión de pasajero expiró. Iniciá sesión nuevamente.");
        onSessionExpired?.();
        return;
      }

      if (!existingRes) {
        return;
      }

      const [stopsJson, existingJson] = await Promise.all([
        stopsRes.json(),
        existingRes.json(),
      ]);

      if (alive) {
        setStops(stopsJson);
        setExisting(existingJson);
      }
    })();

    return () => {
      alive = false;
    };
  }, [trip.id, user.id, user.passengerToken, onSessionExpired]);

  const reserve = async (stopId) => {
    console.log("ENVIANDO RESERVA:", { userId: user.id, tripId: trip.id, stopId });

    // primero intentamos CREAR
    let res = await passengerFetch(apiUrl("/reservations"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tripId: trip.id,
        stopId,
      }),
    });

    if (!res) return;

    // si falla por duplicado → hacemos CHANGE
    if (!res.ok) {
      const err = await res.json();

      if (err.error?.includes("duplicate")) {
        res = await passengerFetch(apiUrl("/reservations/change"), {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tripId: trip.id,
            stopId,
          }),
        });

        if (!res) return;
      } else {
        alert(err.error || "No se pudo reservar");
        return;
      }
    }

    const json = await res.json();

    if (!res.ok) {
      alert(json.error || "No se pudo reservar");
      return;
    }

    alert("Estado: " + json.status);
    onReserved(json.status);
  };

  // ========================
  // SI YA ESTÁ ANOTADO
  // ========================
  if (existing) {
    const cancel = async () => {
      const res = await passengerFetch(apiUrl("/reservations"), {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tripId: trip.id,
        }),
      });

      if (!res) return;

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || "No se pudo cancelar");
        return;
      }

      alert("Inscripción cancelada");
      setExisting(null);
    };

    const change = () => setExisting(null);

    return (
      <div className="page stack">
        <div className="card stack">
          <h2 className="title">{trip.name}</h2>

          <h3 className="section-title">Ya estás anotado</h3>

          <p>Parada: {existing.stops?.name}</p>
          <p>Estado: {existing.status}</p>

          <hr className="divider" />

          <div className="row">
            <button onClick={change}>Cambiar parada</button>
            <button className="btn-danger" onClick={cancel}>Cancelar inscripción</button>
          </div>

          <hr className="divider" />

          <button className="btn-secondary" onClick={onBack}>Volver</button>
        </div>
      </div>
    );
  }

  // ========================
  // MOSTRAR PARADAS
  // ========================
  return (
    <div className="page stack">
      <div className="card stack">
        <h2 className="title">{trip.name}</h2>

        <div className="grid">
          {stops.map((s) => (
            <div key={s.id} className="list-item row-between">
              <span>{s.name} – {s.time}</span>
              <button onClick={() => reserve(s.id)}>Elegir</button>
            </div>
          ))}
        </div>

        <hr className="divider" />

        <button className="btn-secondary" onClick={onBack}>Volver</button>
      </div>
    </div>
  );
}
