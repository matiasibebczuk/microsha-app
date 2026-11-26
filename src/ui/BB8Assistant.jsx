import { useEffect, useRef, useState } from "react";
import { apiUrl } from "../api";
import { fetchWithRetry } from "../lib/fetchWithRetry";
import { useSessionToken } from "../hooks/useSessionToken";

function formatTripDate(value) {
  if (!value) return "Horario no disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function tripTypeLabel(type) {
  if (type === "ida") return "Ida";
  if (type === "vuelta") return "Vuelta";
  return "Traslado";
}

function tripStatusLabel(status) {
  if (status === "open") return "Abierto";
  if (status === "closed") return "Cerrado";
  return status;
}

export default function BB8Assistant() {
  const getAccessToken = useSessionToken();
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");
  const [activeOperationId, setActiveOperationId] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      text: "Hola, soy BB8. Consulto información y preparo cambios para el club 1926; toda modificación requiere tu confirmación.",
      trips: [],
      records: [],
    },
  ]);
  const messageEndRef = useRef(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const response = await fetchWithRetry(apiUrl("/bb8/availability"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const payload = await response.json().catch(() => ({}));
        if (active) setIsAuthorized(payload?.enabled === true && payload?.clubId === 1926);
      } catch {
        if (active) setIsAuthorized(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [getAccessToken]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSending, isOpen]);

  const sendMessage = async (event) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || isSending) return;

    setInput("");
    setIsSending(true);
    setProcessingStatus("Interpretando la solicitud y consultando datos…");
    setMessages((current) => [
      ...current,
      { id: `${Date.now()}-user`, role: "user", text: message, trips: [] },
    ]);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("La sesión expiró. Volvé a iniciar sesión.");

      const response = await fetchWithRetry(apiUrl("/bb8/query"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo completar la consulta.");
      }

      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          text: payload?.reply || "No hay información para mostrar.",
          trips: Array.isArray(payload?.trips) ? payload.trips : [],
          records: Array.isArray(payload?.records) ? payload.records : [],
          pendingOperation: payload?.pendingOperation || null,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-error`,
          role: "assistant",
          text: error?.message || "No se pudo completar la consulta.",
          trips: [],
          records: [],
          isError: true,
        },
      ]);
    } finally {
      setIsSending(false);
      setProcessingStatus("");
    }
  };

  const respondToOperation = async (operationId, action) => {
    if (activeOperationId) return;
    setActiveOperationId(operationId);
    setProcessingStatus(
      action === "confirm"
        ? "Ejecutando y verificando operación…"
        : "Cancelando vista previa…"
    );
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("La sesión expiró. Volvé a iniciar sesión.");

      const response = await fetchWithRetry(
        apiUrl(`/bb8/operations/${operationId}/${action}`),
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload?.retryable === true) {
          setMessages((current) =>
            current.map((message) =>
              message.pendingOperation?.id === operationId
                ? {
                    ...message,
                    pendingOperation: {
                      ...message.pendingOperation,
                      retryable: true,
                    },
                  }
                : message
            )
          );
        } else if (response.status === 409 || payload?.executed === true) {
          setMessages((current) =>
            current.map((message) =>
              message.pendingOperation?.id === operationId
                ? { ...message, pendingOperation: null }
                : message
            )
          );
        }
        throw new Error(
          payload?.reply || payload?.error || "No se pudo procesar la operación."
        );
      }

      setMessages((current) => [
        ...current.map((message) =>
          message.pendingOperation?.id === operationId
            ? { ...message, pendingOperation: null }
            : message
        ),
        {
          id: `${Date.now()}-operation-${action}`,
          role: "assistant",
          text: payload?.reply || "Operación procesada.",
          trips: [],
          records: [],
          isError: payload?.verified === false,
          isSuccess: action === "cancel" || payload?.verified === true,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-operation-error`,
          role: "assistant",
          text: error?.message || "No se pudo procesar la operación.",
          trips: [],
          records: [],
          isError: true,
        },
      ]);
    } finally {
      setActiveOperationId(null);
      setProcessingStatus("");
    }
  };

  if (!isAuthorized) return null;

  return (
    <div className="bb8-assistant">
      {hasOpened ? (
        <section
          className={`bb8-panel${isOpen ? " bb8-panel-open" : ""}`}
          aria-label="Asistente BB8"
          aria-live="polite"
          aria-hidden={!isOpen}
          inert={!isOpen}
        >
          <header className="bb8-header">
            <div className="bb8-brand">
              <span className="bb8-avatar" aria-hidden="true">B8</span>
              <div>
                <h2>BB8</h2>
                <p>Club 1926 · Cambios con confirmación</p>
              </div>
            </div>
            <button
              className="bb8-close"
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Minimizar BB8"
              title="Minimizar"
            >
              −
            </button>
          </header>

          <div className="bb8-messages" role="log" aria-label="Conversación">
            {messages.map((message) => (
              <article
                className={`bb8-message bb8-message-${message.role}${message.isError ? " bb8-message-error" : ""}${message.isSuccess ? " bb8-message-success" : ""}`}
                key={message.id}
              >
                <p>{message.text}</p>
                {message.trips.length > 0 ? (
                  <ul className="bb8-trip-list">
                    {message.trips.map((trip) => (
                      <li key={trip.id}>
                        <strong>{trip.name || "Traslado sin nombre"}</strong>
                        <span>{formatTripDate(trip.departure_datetime)}</span>
                        <span>
                          {tripTypeLabel(trip.type)}
                          {trip.start_time ? ` · Sale ${String(trip.start_time).slice(0, 5)}` : ""}
                          {trip.status ? ` · ${tripStatusLabel(trip.status)}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {message.records?.length > 0 ? (
                  <ul className="bb8-trip-list">
                    {message.records.map((record, index) => (
                      <li key={record.id || `${message.id}-${index}`}>
                        <strong>{record.title || "Registro"}</strong>
                        {(record.details || []).map((detail, detailIndex) => (
                          <span key={`${record.id || index}-${detailIndex}`}>{detail}</span>
                        ))}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {message.pendingOperation ? (
                  <div className="bb8-preview">
                    <strong>{message.pendingOperation.title}</strong>
                    <span className="bb8-preview-state">Preparada · pendiente de confirmación</span>
                    {message.pendingOperation.tripName ? (
                      <span>Traslado: {message.pendingOperation.tripName}</span>
                    ) : null}
                    {message.pendingOperation.departureDate ? (
                      <span>Fecha: {formatTripDate(message.pendingOperation.departureDate)}</span>
                    ) : null}
                    <span>Actual: {message.pendingOperation.currentValue}</span>
                    <span>Nuevo: {message.pendingOperation.newValue}</span>
                    <span>{message.pendingOperation.action}</span>
                    <small>
                      La confirmación vence{" "}
                      {new Intl.DateTimeFormat("es-AR", {
                        timeStyle: "short",
                      }).format(new Date(message.pendingOperation.expiresAt))}
                      .
                    </small>
                    <div className="bb8-preview-actions">
                      <button
                        type="button"
                        onClick={() =>
                          respondToOperation(message.pendingOperation.id, "confirm")
                        }
                        disabled={activeOperationId !== null}
                      >
                        {activeOperationId === message.pendingOperation.id
                          ? "Procesando…"
                          : message.pendingOperation.retryable
                            ? "Reintentar finalización"
                            : "Confirmar y ejecutar"}
                      </button>
                      <button
                        type="button"
                        className="bb8-preview-cancel"
                        onClick={() =>
                          respondToOperation(message.pendingOperation.id, "cancel")
                        }
                        disabled={activeOperationId !== null}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
            {processingStatus ? (
              <p className="bb8-processing" role="status">
                <span className="bb8-processing-indicator" aria-hidden="true" />
                {processingStatus}
              </p>
            ) : null}
            <div ref={messageEndRef} />
          </div>

          <form className="bb8-composer" onSubmit={sendMessage}>
            <label className="bb8-sr-only" htmlFor="bb8-message">Mensaje para BB8</label>
            <input
              id="bb8-message"
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Consultá traslados, personas o cambios…"
              maxLength={500}
              disabled={isSending}
            />
            <button type="submit" disabled={isSending || !input.trim()}>
              Enviar
            </button>
          </form>
        </section>
      ) : null}

      <button
        className={`bb8-launcher${isOpen ? " bb8-launcher-open" : ""}`}
        type="button"
        onClick={() => {
          if (!isOpen) setHasOpened(true);
          setIsOpen((open) => !open);
        }}
        aria-label={isOpen ? "Cerrar BB8" : "Abrir asistente BB8"}
        aria-expanded={isOpen}
      >
        {isOpen ? "×" : "BB8"}
      </button>
    </div>
  );
}
