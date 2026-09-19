import { sileo } from "sileo";

export function toCleanMessage(rawMessage) {
  const text = String(rawMessage || "").trim();
  if (!text) return "Aviso";
  const normalized = text.toLowerCase();

  if (normalized.includes("invalid login credentials")) return "Credenciales inválidas.";
  if (normalized.includes("email not confirmed") || normalized.includes("confirm your email") || normalized.includes("correo no confirmado")) {
    return "Confirmá tu correo para ingresar.";
  }
  if (normalized.includes("failed to fetch") || normalized.includes("network") || normalized.includes("timeout")) {
    return "Error de conexión. Intentá de nuevo.";
  }
  if (normalized.includes("server exploded")) return "Error inesperado en el servidor.";
  if (normalized.includes("invalid token") || normalized.includes("no token") || normalized.includes("session expired") || normalized.includes("sesión expirada")) {
    return "Sesión expirada. Ingresá nuevamente.";
  }
  if (normalized.includes("rate") && normalized.includes("limit")) {
    return "Límite de solicitudes alcanzado. Aguardá unos segundos.";
  }

  return text;
}

export function detectMessageType(msg) {
  const text = String(msg || "").toLowerCase();
  if (
    text.includes("error") ||
    text.includes("falló") ||
    text.includes("expirad") ||
    text.includes("inválid") ||
    text.includes("incorrect") ||
    text.includes("no se pudo")
  ) {
    return "error";
  }
  if (
    text.includes("guardad") ||
    text.includes("actualizad") ||
    text.includes("éxito") ||
    text.includes("confirmad") ||
    text.includes("cread") ||
    text.includes("duplicad") ||
    text.includes("enviad")
  ) {
    return "success";
  }
  if (text.includes("espera") || text.includes("mantenimiento") || text.includes("atención") || text.includes("cuidado")) {
    return "warning";
  }
  return "info";
}

export const notify = {
  success: (title, description) => sileo.success({ title: toCleanMessage(title), description }),
  error: (title, description) => sileo.error({ title: toCleanMessage(title), description }),
  warning: (title, description) => sileo.warning({ title: toCleanMessage(title), description }),
  info: (title, description) => sileo.info({ title: toCleanMessage(title), description }),
  action: (opts) => sileo.action(opts),
  promise: (promise, opts) => sileo.promise(promise, opts),
};
