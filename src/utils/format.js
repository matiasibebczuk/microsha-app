export const ARGENTINA_TIMEZONE = "America/Argentina/Buenos_Aires";

function getArgentinaDateParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ARGENTINA_TIMEZONE,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const pick = (type) => parts.find((part) => part.type === type)?.value;
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
    minute: pick("minute"),
    weekday: weekdayMap[pick("weekday")] ?? null,
  };
}

export function formatDateTime(value) {
  const parts = getArgentinaDateParts(value);
  if (!parts) return "-";
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

export function formatDateTimeShort(value) {
  const parts = getArgentinaDateParts(value);
  if (!parts) return "-";
  return `${parts.day}/${parts.month} ${parts.hour}:${parts.minute}`;
}

export function getArgentinaWeekdayAndTime(value) {
  const parts = getArgentinaDateParts(value);
  if (!parts) return { day: null, time: null };
  return {
    day: parts.weekday,
    time: `${parts.hour}:${parts.minute}`,
  };
}

export function toArgentinaDateTimeLocalInput(value) {
  const parts = getArgentinaDateParts(value);
  if (!parts) return "";
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function formatTimeLabel(value) {
  if (!value) return "-";
  const asText = String(value);
  const hhmm = asText.match(/^(\d{1,2}:\d{2})/);
  if (hhmm) {
    const [h, m] = hhmm[1].split(":");
    return `${String(Number(h)).padStart(2, "0")}:${m}`;
  }

  const parsed = new Date(asText);
  if (!Number.isNaN(parsed.getTime())) {
    const parts = getArgentinaDateParts(parsed);
    if (parts) return `${parts.hour}:${parts.minute}`;
  }

  return "-";
}

export function formatTripTitle(name, startTime, fallbackId = null) {
  const fallback = fallbackId !== null && fallbackId !== undefined ? `Traslado ${fallbackId}` : "Traslado";
  const rawBase = String(name || fallback).trim();
  const base = rawBase.replace(/\s-\s\d{1,2}:\d{2}$/i, "").trim() || fallback;
  const time = formatTimeLabel(startTime);
  if (!time || time === "-") return base;
  return `${base} - ${time}`;
}

export function formatTripStatus(status) {
  return status === "open" ? "🟢 Abierto" : "🔴 Cerrado";
}

export function formatOccupancy(confirmed, capacity) {
  if (!capacity || capacity <= 0) return 0;
  return Math.round(((confirmed || 0) / capacity) * 100);
}
