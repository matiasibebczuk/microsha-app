const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || "https://microsha-backend.onrender.com";

export const API_BASE_URL = rawBaseUrl
  .replace(/\/ping\/?$/, "")
  .replace(/\/$/, "");

export function apiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}
