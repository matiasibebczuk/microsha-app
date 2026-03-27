import { useEffect, useRef, useState } from "react";
import { IconLogout, IconChevronRight } from "./ui/icons";
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

function formatTimeNoSeconds(value) {
  if (!value) return value;
  const asText = String(value);

  // Direct HH:mm(:ss) formats
  const hhmm = asText.match(/^(\d{2}:\d{2})/);
  if (hhmm) return hhmm[1];

  // ISO/local datetime values
  const parsed = new Date(asText);
  if (!Number.isNaN(parsed.getTime())) {
    const hh = String(parsed.getHours()).padStart(2, "0");
    const mm = String(parsed.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  return asText;
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

function hasActiveWaitlist(trip) {
  if (!trip || typeof trip !== "object") return false;
  if (trip.waitlist_active === true) return true;
  return trip.mode === "waiting";
}

function buildPromotionMessage(notification) {
  const typeLabel = toSpanishTripType(notification?.tripType);
  const stopLabel = notification?.stopName || "-";
  const timeLabel = formatTimeNoSeconds(notification?.stopTime) || "-";
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
      label: "Mis paradas",
      className: "btn-secondary",
    };
  }

  if (trip.status === "closed") {
    return {
      disabled: true,
      label: "Cerrado",
      className: "btn-secondary",
    };
  }

  if (trip.mode === "waiting") {
    return {
      disabled: false,
      label: "Inscribirse",
      className: "btn-primary",
    };
  }

  return {
    disabled: false,
    label: "Elegir parada",
    className: "btn-primary",
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
  const [statusAlert, setStatusAlert] = useState(null);

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
              stopTime: formatTimeNoSeconds(item.stop_time || null),
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
          setStatusAlert({
            type: "success",
            text: `Se confirmó tu lugar. ${message}`,
          });

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
        return;
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

          if (reservationInfo.status === "waiting") {
            setStatusAlert({
              type: "waiting",
              text: "Tu solicitud quedó en lista de espera. Te avisaremos cuando se confirme tu lugar.",
            });
          } else if (reservationInfo.status === "confirmed") {
            setStatusAlert({
              type: "success",
              text: "Reserva confirmada. Tu lugar ya está asegurado.",
            });
          }

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
      <div className="page fade-up">
        <header className="stack-sm" style={{ marginBottom: 32 }}>
          <h1 className="large-title">Hola {user.name.split(" ")[0]} 👋</h1>
          <p className="caption">Elegí tu traslado de ida</p>
        </header>

        {statusAlert ? (
          <div className={`status-alert-card ${statusAlert.type === "success" ? "status-alert-success" : "status-alert-waiting"}`}>
            {statusAlert.text}
          </div>
        ) : null}

        <MessageBanner message={tripsError} />

        <div className="stack">
          {tripsLoading ? (
            <div className="inset-group">
              <LoadingState compact label="Cargando traslados..." />
              <SkeletonCards count={3} />
            </div>
          ) : trips.filter((t) => normalizeTripType(t.type) === "ida").length === 0 ? (
            <EmptyState
              title="No hay traslados de ida"
              subtitle="Cuando se publiquen nuevos viajes, los vas a ver acá."
            />
          ) : (
            <div className="inset-group">
              <h3 className="subheadline">Disponibles ahora</h3>
              <div className="inset-list">
                {trips
                  .filter((t) => normalizeTripType(t.type) === "ida")
                  .map((t) => {
                    const hasReservation = Boolean(myReservationsByTrip[String(t.id)]);
                    const action = getTripActionConfig(t, hasReservation);

                    return (
                      <button
                        key={t.id}
                        type="button"
                        className="card glass-card row-between passenger-trip-card"
                        onClick={() => !action.disabled && setSelectedTrip(t)}
                        disabled={action.disabled}
                      >
                        <div className="stack-sm passenger-trip-main">
                          <span className="body"><b>{t.name}</b></span>
                          <span className="caption passenger-trip-caption-row">
                            <span>Inicia {formatTimeNoSeconds(t.first_time)} {t.status === "closed" ? "· Cerrado" : ""}</span>
                            <span className="passenger-trip-mobile-chevron" aria-hidden="true"><IconChevronRight /></span>
                          </span>
                          {hasActiveWaitlist(t) ? <span className="badge badge-warning">Lista de espera activa</span> : null}
                        </div>
                        <div className="row passenger-trip-side">
                          {hasReservation && <span className="badge badge-success">Anotado</span>}
                          <span className="caption passenger-trip-action">{action.label}</span>
                          <IconChevronRight />
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        <div className="inset-group" style={{ marginTop: 24 }}>
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
      <div className="page fade-up">
        <header className="stack-sm" style={{ marginBottom: 32 }}>
          <h1 className="large-title">Vuelta</h1>
          <p className="caption">¿Cómo querés volver?</p>
        </header>

        {statusAlert ? (
          <div className={`status-alert-card ${statusAlert.type === "success" ? "status-alert-success" : "status-alert-waiting"}`}>
            {statusAlert.text}
          </div>
        ) : null}

        <MessageBanner message={tripsError} />

        <div className="stack">
          {tripsLoading ? (
            <div className="inset-group">
              <LoadingState compact label="..." />
              <SkeletonCards count={3} />
            </div>
          ) : trips.filter((t) => normalizeTripType(t.type) === "vuelta").length === 0 ? (
            <EmptyState
              title="No hay vueltas cargadas"
              subtitle="Consultá con el staff por traslados excepcionales."
            />
          ) : (
            <div className="inset-group">
              <h3 className="subheadline">Opciones de regreso</h3>
              <div className="inset-list">
                {trips
                  .filter((t) => normalizeTripType(t.type) === "vuelta")
                  .map((t) => {
                    const hasReservation = Boolean(myReservationsByTrip[String(t.id)]);
                    const action = getTripActionConfig(t, hasReservation);

                    return (
                      <button
                        key={t.id}
                        type="button"
                        className="card glass-card row-between passenger-trip-card"
                        onClick={() => !action.disabled && setSelectedTrip(t)}
                        disabled={action.disabled}
                      >
                        <div className="stack-sm passenger-trip-main">
                          <span className="body"><b>{t.name}</b></span>
                          <span className="caption passenger-trip-caption-row">
                            <span>Inicia {formatTimeNoSeconds(t.first_time)}</span>
                            <span className="passenger-trip-mobile-chevron" aria-hidden="true"><IconChevronRight /></span>
                          </span>
                          {hasActiveWaitlist(t) ? <span className="badge badge-warning">Lista de espera activa</span> : null}
                        </div>
                        <div className="row passenger-trip-side">
                          {hasReservation && <span className="badge badge-success">Anotado</span>}
                          <span className="caption passenger-trip-action">{action.label}</span>
                          <IconChevronRight />
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        <div className="inset-group" style={{ marginTop: 24 }}>
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
    <div className="page fade-up">
      <header className="stack-sm" style={{ marginBottom: 32 }}>
        <h1 className="large-title">Resumen</h1>
        <p className="caption">Repasá tus inscripciones</p>
      </header>

      {statusAlert ? (
        <div className={`status-alert-card ${statusAlert.type === "success" ? "status-alert-success" : "status-alert-waiting"}`}>
          {statusAlert.text}
        </div>
      ) : null}

      <div className="inset-group">
        <h3 className="subheadline">Detalles del viaje</h3>
        <div className="inset-list">
          <div className="card glass-card stack-sm" style={{ borderRadius: 0, border: 'none', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
            <div className="row-between">
              <span className="body"><b>Ida</b></span>
              <span className={`badge ${effectiveIdaReservation?.status === 'confirmed' ? 'badge-success' : 'badge-warning'}`}>
                {toSpanishStatus(effectiveIdaReservation?.status)}
              </span>
            </div>
            <p className="caption">Parada: {formatSummaryItem(effectiveIdaReservation?.stopName)} · {formatSummaryItem(formatTimeNoSeconds(effectiveIdaReservation?.stopTime))}</p>
          </div>

          <div className="card glass-card stack-sm" style={{ borderRadius: 0, border: 'none' }}>
            <div className="row-between">
              <span className="body"><b>Vuelta</b></span>
              <span className={`badge ${effectiveVueltaReservation?.status === 'confirmed' ? 'badge-success' : 'badge-warning'}`}>
                {toSpanishStatus(effectiveVueltaReservation?.status)}
              </span>
            </div>
            <p className="caption">Parada: {formatSummaryItem(effectiveVueltaReservation?.stopName)} · {formatSummaryItem(formatTimeNoSeconds(effectiveVueltaReservation?.stopTime))}</p>
          </div>
        </div>
      </div>

      <div className="inset-group stack" style={{ marginTop: 40 }}>
        <div className="card glass-card" style={{ textAlign: 'center', padding: '24px' }}>
          <h2 className="headline">¡Todo listo! 🙌</h2>
          <p className="caption" style={{ marginTop: 8 }}>Ya estás anotado. Te avisaremos cuando confirmemos tu lugar.</p>
        </div>

        <button className="btn-secondary" onClick={() => onSessionExpired?.()} style={{ marginTop: 12 }}>
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
  const [notice, setNotice] = useState(null);
  const [submittingStopId, setSubmittingStopId] = useState(null);
  const [cancelling, setCancelling] = useState(false);

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
    if (submittingStopId !== null) return;
    setSubmittingStopId(stopId);
    console.log("ENVIANDO RESERVA:", { userId: user.id, tripId: trip.id, stopId });

    try {
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
          setNotice({ type: "error", text: err.error || "No se pudo reservar" });
          return;
        }
      }

      const json = await res.json();

      if (!res.ok) {
        setNotice({ type: "error", text: json.error || "No se pudo reservar" });
        return;
      }

      const selectedStop = stops.find((stop) => String(stop.id) === String(stopId));

      clearCached(`passenger:trips:${user.passengerToken}`);
      setNotice({
        type: json.status === "waiting" ? "waiting" : "success",
        text:
          json.status === "waiting"
            ? "Quedaste en lista de espera para esta parada."
            : "Reserva confirmada para esta parada.",
      });
      onReserved({
        status: json.status,
        stopName: selectedStop?.name || null,
        stopTime: formatTimeNoSeconds(selectedStop?.time || null),
      });
    } finally {
      setSubmittingStopId(null);
    }
  };

  if (existing) {
    const cancel = async () => {
      if (cancelling) return;
      setCancelling(true);
      try {
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
          setNotice({ type: "error", text: json.error || "No se pudo cancelar" });
          return;
        }

        clearCached(`passenger:trips:${user.passengerToken}`);
        setExisting(null);
        onReservationCancelled?.(trip.id);
      } finally {
        setCancelling(false);
      }
    };

    const change = () => setExisting(null);

    return (
      <div className="page fade-up">
        <header className="stack-sm" style={{ marginBottom: 32 }}>
          <h1 className="large-title">{trip.name}</h1>
          <p className="caption">Información de tu viaje</p>
        </header>

        <div className="inset-group">
          <div className="card glass-card stack" style={{ padding: '24px' }}>
            <div className="row-between">
              <h2 className="headline">Ya estás anotado</h2>
              <span className="badge badge-success">{toSpanishStatus(existing.status)}</span>
            </div>
            
            <div className="stack-sm">
              <p className="body">Parada: <b>{existing.stops?.name}</b></p>
              <p className="caption">Horario: {formatTimeNoSeconds(existing.stops?.time)}</p>
            </div>

            <div className="divider" />

            <div className="stack-sm">
              <button className="btn-primary" onClick={change}>Cambiar mi parada</button>
              <button className="btn-plain" style={{ color: 'var(--ios-system-red)' }} onClick={cancel} disabled={cancelling}>{cancelling ? "Cancelando..." : "Cancelar lugar"}</button>
            </div>
          </div>
        </div>

        <div className="inset-group">
          <button className="btn-secondary" onClick={onBack}>Volver atrás</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page fade-up">
      <header className="stack-sm" style={{ marginBottom: 32 }}>
        <h1 className="large-title">{trip.name}</h1>
        <p className="caption">Elegí el punto de encuentro</p>
      </header>

      {hasActiveWaitlist(trip) ? (
        <div className="status-alert-card status-alert-waiting">
          Lista de espera activa para este traslado. Si no hay cupo, quedas anotado en espera.
        </div>
      ) : null}

      <MessageBanner message={error} />
      {notice ? (
        <div className={`status-alert-card ${notice.type === "success" ? "status-alert-success" : notice.type === "waiting" ? "status-alert-waiting" : "status-alert-error"}`}>
          {notice.text}
        </div>
      ) : null}

      <div className="stack">
        {loading ? (
          <div className="inset-group">
            <LoadingState compact label="Buscando paradas..." />
            <SkeletonCards count={2} />
          </div>
        ) : null}

        {!loading && stops.length === 0 ? (
          <EmptyState
            title="Sin paradas"
            subtitle="Este traslado no tiene puntos de encuentro."
          />
        ) : (
          <div className="inset-group">
            <h3 className="subheadline">Lista de paradas</h3>
            {submittingStopId !== null ? <LoadingState compact label="Guardando reserva..." /> : null}
            <div className="inset-list">
              {stops.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="card glass-card row-between stop-choice-card"
                  onClick={() => reserve(s.id)}
                  disabled={submittingStopId !== null}
                >
                  <div className="stack-sm stop-choice-main">
                    <span className="body"><b>{s.name}</b></span>
                    <span className="caption stop-choice-caption-row">
                      <span>Pasa a las {formatTimeNoSeconds(s.time)}</span>
                      <span className="stop-choice-mobile-chevron" aria-hidden="true"><IconChevronRight /></span>
                    </span>
                  </div>
                  <div className="row stop-choice-side">
                    <span className="stop-time-pill">{formatTimeNoSeconds(s.time)}</span>
                    <IconChevronRight />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="inset-group" style={{ marginTop: 24 }}>
        <button className="btn-secondary" onClick={onBack}>Volver</button>
      </div>
    </div>
  );
}
