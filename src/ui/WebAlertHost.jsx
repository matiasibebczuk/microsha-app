import { useEffect, useMemo, useState } from "react";

const ALERT_EVENT = "microsha:web-alert";

function toSpanishMessage(rawMessage) {
  const text = String(rawMessage || "").trim();
  if (!text) return "Ocurrió un aviso.";

  const normalized = text.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Credenciales inválidas. Revisá email y contraseña.";
  }

  if (
    normalized.includes("email not confirmed") ||
    normalized.includes("confirm your email") ||
    normalized.includes("correo no confirmado")
  ) {
    return "Tenés que confirmar tu correo para continuar.";
  }

  if (normalized.includes("failed to fetch")) {
    return "No se pudo conectar con el servidor. Intentá nuevamente.";
  }

  if (normalized.includes("network") || normalized.includes("timeout")) {
    return "La conexión tardó demasiado o falló. Probá de nuevo.";
  }

  if (normalized.includes("server exploded")) {
    return "El servidor tuvo un error inesperado.";
  }

  if (normalized.includes("invalid token")) {
    return "Tu sesión no es válida. Volvé a iniciar sesión.";
  }

  if (normalized.includes("no token")) {
    return "No hay sesión activa. Iniciá sesión nuevamente.";
  }

  return text;
}

function dispatchWebAlert(message) {
  window.dispatchEvent(
    new CustomEvent(ALERT_EVENT, {
      detail: {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        message: toSpanishMessage(message),
      },
    })
  );
}

function installWebAlertOverride() {
  if (typeof window === "undefined") return;
  if (window.__microshaAlertInstalled) return;

  window.__microshaOriginalAlert = window.alert;
  window.alert = (message) => {
    dispatchWebAlert(message);
  };
  window.__microshaAlertInstalled = true;
}

export default function WebAlertHost() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    installWebAlertOverride();

    const onAlert = (event) => {
      const incoming = event?.detail;
      if (!incoming?.message) return;

      setAlerts((prev) => [...prev, incoming]);
    };

    window.addEventListener(ALERT_EVENT, onAlert);
    return () => {
      window.removeEventListener(ALERT_EVENT, onAlert);
    };
  }, []);

  useEffect(() => {
    if (alerts.length === 0) return;

    const timers = alerts.map((item) =>
      setTimeout(() => {
        setAlerts((prev) => prev.filter((current) => current.id !== item.id));
      }, 4200)
    );

    return () => {
      for (const timerId of timers) {
        clearTimeout(timerId);
      }
    };
  }, [alerts]);

  const visibleAlerts = useMemo(() => alerts.slice(-4), [alerts]);

  if (visibleAlerts.length === 0) return null;

  return (
    <div className="web-alert-stack" role="status" aria-live="polite">
      {visibleAlerts.map((item) => (
        <div key={item.id} className="web-alert-card">
          <span>{item.message}</span>
          <button
            type="button"
            className="web-alert-close"
            onClick={() => setAlerts((prev) => prev.filter((current) => current.id !== item.id))}
          >
            Cerrar
          </button>
        </div>
      ))}
    </div>
  );
}
