import { useEffect, useRef, useState } from "react";
import { IconLogout } from "./ui/icons";
import { apiUrl } from "./api";
import LoadingState from "./ui/LoadingState";
import SkeletonCards from "./ui/SkeletonCards";
import MessageBanner from "./ui/MessageBanner";
import EmptyState from "./ui/EmptyState";
import { clearCached, getOrSetCached } from "./lib/cache";

function toSpanishStatus(status) {
  if (status === "confirmed") return "Confirmado";
  if (status === "waiting") return "En espera";
  return "No solicitado";
}

function formatSummaryItem(value) {
  if (!value) return "-";
  return value;
}

function toSpanishTripType(type) {
  if (type === "ida") return "Ida";
  if (type === "vuelta") return "Vuelta";
  return "Traslado";
}

function normalizeTripType(type) {
  return String(type || "")
    .trim()
    .toLowerCase();
}

function buildPromotionMessage(notification) {
  const typeLabel = toSpanishTripType(notification?.tripType);
  const stopLabel = notification?.stopName || "-";
  const timeLabel = notification?.stopTime || "-";
  return `${typeLabel} · Parada: ${stopLabel} · Horario: ${timeLabel} · Estado: Confirmado`;
}

function getConsolidatedReservation(myReservationsByTrip, type) {
  const values = Object.values(myReservationsByTrip || {});
  const found = values.find((item) => normalizeTripType(item?.tripType) === normalizeTripType(type));
  if (!found) return null;

  return {
    status: found.status || null,
    stopName: found.stopName || null,
    stopTime: found.stopTime || null,
  };
}

function getTripActionConfig(trip, hasReservation) {
  if (hasReservation) {
    return {
      disabled: false,
      label: "Ver paradas",
      className: "btn-success",
    };
  }

  if (trip.status === "closed") {
    return {
      disabled: true,
      label: "Inscripción cerrada",
      className: "btn-secondary",
    };
  }

  if (trip.mode === "waiting") {
    return {
      disabled: false,
      label: "Ver paradas",
      className: "btn-warning",
    };
  }

  return {
    disabled: false,
    label: "Ver paradas",
    className: "",
  };
}

export default function Passenger({ user, onSessionExpired }) {
  const [trips, setTrips] = useState([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [tripsError, setTripsError] = useState("");
  const [myReservationsByTrip, setMyReservationsByTrip] = useState({});
  const [step, setStep] = useState("ida");
  const [selectedTrip, setSelectedTrip] = useState(null);
  const notificationPermissionRequested = useRef(false);

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
      setTripsLoading(true);
      setTripsError("");

      try {
        const [json, reservationsRes] = await Promise.all([
          getOrSetCached(
            `passenger:trips:${user.passengerToken}`,
            async () => {
              const res = await fetch(apiUrl("/trips"), {
                headers: {
                  "x-passenger-token": user.passengerToken,
                },
              });

              if (res.status === 401) {
                throw new Error("SESSION_EXPIRED");
              }

              return res.json();
            },
            20_000
          ),
          fetch(apiUrl("/reservations/mine"), {
            headers: {
              "x-passenger-token": user.passengerToken,
            },
          }),
        ]);

        if (reservationsRes.status === 401) {
          throw new Error("SESSION_EXPIRED");
        }

        const reservationsJson = reservationsRes.ok ? await reservationsRes.json() : [];
        const reservationsMap = (Array.isArray(reservationsJson) ? reservationsJson : []).reduce(
          (acc, item) => {
            if (!item?.trip_id) return acc;
            acc[String(item.trip_id)] = {
              tripId: item.trip_id,
              stopId: item.stop_id,
              status: item.status,
              tripType: item.trip_type || null,
              stopName: item.stop_name || null,
              stopTime: item.stop_time || null,
            };
            return acc;
          },
          {}
        );

        if (alive) {
          setTrips(Array.isArray(json) ? json : []);
          setMyReservationsByTrip(reservationsMap);
        }
      } catch (err) {
        if (!alive) return;

        if (err?.message === "SESSION_EXPIRED") {
          onSessionExpired?.();
          return;
        }

        setTrips([]);
        setMyReservationsByTrip({});
        setTripsError("No se pudo cargar la lista de traslados.");
      } finally {
        if (alive) {
          setTripsLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [onSessionExpired, user.passengerToken]);

  useEffect(() => {
    if (!("Notification" in window)) return;
    if (notificationPermissionRequested.current) return;
    notificationPermissionRequested.current = true;

    if (window.Notification.permission === "default") {
      void window.Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    let alive = true;

    const pollNotifications = async () => {
      try {
        const res = await fetch(apiUrl("/reservations/notifications"), {
          headers: {
            "x-passenger-token": user.passengerToken,
          },
        });

        if (res.status === 401) {
          onSessionExpired?.();
          return;
        }

        if (!res.ok) return;

        const json = await res.json();
        if (!alive || !Array.isArray(json) || json.length === 0) return;

        json.forEach((notification) => {
          const message = buildPromotionMessage(notification);
          alert(`¡Te confirmamos tu lugar! ${message}`);

          if ("Notification" in window && window.Notification.permission === "granted") {
            const title = notification?.tripName
              ? `MicroSHA · ${notification.tripName}`
              : "MicroSHA · Reserva confirmada";
            new window.Notification(title, {
              body: message,
            });
          }
        });
      } catch {
      }
    };

    void pollNotifications();
    const timerId = window.setInterval(() => {
      void pollNotifications();
    }, 30000);

    return () => {
      alive = false;
      window.clearInterval(timerId);
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
        onReservationCancelled={(tripId) => {
          setMyReservationsByTrip((prev) => {
            const copy = { ...prev };
            delete copy[String(tripId)];
            return copy;
          });
        }}
        onReserved={(reservationInfo) => {
          if (!reservationInfo) return;

          setMyReservationsByTrip((prev) => ({
            ...prev,
            [String(selectedTrip.id)]: {
              trip_id: selectedTrip.id,
              status: reservationInfo.status,
              tripType: selectedTrip.type,
              stopName: reservationInfo.stopName || null,
              stopTime: reservationInfo.stopTime || null,
            },
          }));

          if (step === "ida") {
            setIdaReservation(reservationInfo);
            setSelectedTrip(null);
            setStep("vuelta");
          } else {
            setVueltaReservation(reservationInfo);
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

          <MessageBanner message={tripsError} />

          <div className="grid">
            {tripsLoading ? (
              <>
                <LoadingState compact label="Cargando traslados..." />
                <SkeletonCards count={3} />
              </>
            ) : trips.filter((t) => t.type === "ida").length === 0 ? (
              <EmptyState
                title="No hay traslados de ida disponibles"
                subtitle="Cuando se publiquen nuevos viajes, los vas a ver acá."
              />
            ) : (
              trips
                .filter((t) => normalizeTripType(t.type) === "ida")
                .map((t) => {
                  const hasReservation = Boolean(myReservationsByTrip[String(t.id)]);
                  const action = getTripActionConfig(t, hasReservation);

                  return (
                    <div key={t.id} className="list-item row-between">
                      <span>
                        <b>{t.name}</b> – comienza {t.first_time} {t.status === "closed" ? "(cerrado)" : ""}
                      </span>
                      <button
                        className={action.className}
                        disabled={action.disabled}
                        onClick={() => {
                          if (action.disabled) return;
                          setSelectedTrip(t);
                        }}
                      >
                        {action.label}
                      </button>
                    </div>
                  );
                })
            )}
          </div>

          <hr className="divider" />

          <button
            className="btn-secondary"
            onClick={() => {
              setIdaReservation({
                status: "no",
                stopName: null,
                stopTime: null,
              });
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

          <MessageBanner message={tripsError} />

          <div className="grid">
            {tripsLoading ? (
              <>
                <LoadingState compact label="Cargando traslados..." />
                <SkeletonCards count={3} />
              </>
            ) : trips.filter((t) => t.type === "vuelta").length === 0 ? (
              <EmptyState
                title="No hay traslados de vuelta disponibles"
                subtitle="Cuando se publiquen nuevos viajes, los vas a ver acá."
              />
            ) : (
              trips
                .filter((t) => normalizeTripType(t.type) === "vuelta")
                .map((t) => {
                  const hasReservation = Boolean(myReservationsByTrip[String(t.id)]);
                  const action = getTripActionConfig(t, hasReservation);

                  return (
                    <div key={t.id} className="list-item row-between">
                      <span>
                        <b>{t.name}</b> – comienza {t.first_time} {t.status === "closed" ? "(cerrado)" : ""}
                      </span>
                      <button
                        className={action.className}
                        disabled={action.disabled}
                        onClick={() => {
                          if (action.disabled) return;
                          setSelectedTrip(t);
                        }}
                      >
                        {action.label}
                      </button>
                    </div>
                  );
                })
            )}
          </div>

          <hr className="divider" />

          <button
            className="btn-secondary"
            onClick={() => {
              setVueltaReservation({
                status: "no",
                stopName: null,
                stopTime: null,
              });
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
  const consolidatedIda = getConsolidatedReservation(myReservationsByTrip, "ida");
  const consolidatedVuelta = getConsolidatedReservation(myReservationsByTrip, "vuelta");
  const effectiveIdaReservation = consolidatedIda || idaReservation;
  const effectiveVueltaReservation = consolidatedVuelta || vueltaReservation;

  return (
    <div className="page stack">
      <div className="card stack">
        <h2 className="title">Resumen</h2>

        <div className="list-item stack-sm">
          <p><span className="badge">Ida</span></p>
          <p><b>Parada:</b> {formatSummaryItem(effectiveIdaReservation?.stopName)}</p>
          <p><b>Horario:</b> {formatSummaryItem(effectiveIdaReservation?.stopTime)}</p>
          <p><b>Estado:</b> {toSpanishStatus(effectiveIdaReservation?.status)}</p>
        </div>

        <div className="list-item stack-sm">
          <p><span className="badge">Vuelta</span></p>
          <p><b>Parada:</b> {formatSummaryItem(effectiveVueltaReservation?.stopName)}</p>
          <p><b>Horario:</b> {formatSummaryItem(effectiveVueltaReservation?.stopTime)}</p>
          <p><b>Estado:</b> {toSpanishStatus(effectiveVueltaReservation?.status)}</p>
        </div>

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
function TripStops({ trip, user, onBack, onReserved, onSessionExpired, onReservationCancelled }) {
  const [stops, setStops] = useState([]);
  const [existing, setExisting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      setLoading(true);
      setError("");

      try {
        const stopsRes = await fetch(apiUrl(`/trips/${trip.id}/stops`), {
          headers: {
            "x-passenger-token": user.passengerToken,
          },
        });
        if (stopsRes.status === 401) {
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
          onSessionExpired?.();
          return;
        }

        const [stopsJson, existingJson] = await Promise.all([
          stopsRes.json(),
          existingRes.json(),
        ]);

        if (alive) {
          setStops(Array.isArray(stopsJson) ? stopsJson : []);
          setExisting(existingJson);
        }
      } catch {
        if (alive) {
          setError("No se pudieron cargar las paradas.");
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
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

    const selectedStop = stops.find((stop) => String(stop.id) === String(stopId));

    clearCached(`passenger:trips:${user.passengerToken}`);
    alert("Estado: " + json.status);
    onReserved({
      status: json.status,
      stopName: selectedStop?.name || null,
      stopTime: selectedStop?.time || null,
    });
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

      clearCached(`passenger:trips:${user.passengerToken}`);
      alert("Inscripción cancelada");
      setExisting(null);
      onReservationCancelled?.(trip.id);
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

        <MessageBanner message={error} />

        {loading ? (
          <>
            <LoadingState compact label="Cargando paradas..." />
            <SkeletonCards count={2} />
          </>
        ) : null}

        <div className="grid">
          {!loading && stops.length === 0 ? (
            <EmptyState
              title="Este traslado no tiene paradas cargadas"
              subtitle="Contactá al staff para más información."
            />
          ) : (
            stops.map((s) => (
              <div key={s.id} className="list-item row-between">
                <span>{s.name} – {s.time}</span>
                <button onClick={() => reserve(s.id)}>Elegir</button>
              </div>
            ))
          )}
        </div>

        <hr className="divider" />

        <button className="btn-secondary" onClick={onBack}>Volver</button>
      </div>
    </div>
  );
}
