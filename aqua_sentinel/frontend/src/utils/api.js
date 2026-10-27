// ── Centralized API & Map Configuration ──

const STORAGE_KEY = "aqua_sentinel_api_url";
const CARTO_STORAGE_KEY = "aqua_sentinel_carto_key";

export function getApiBaseUrl() {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, "");
    }
  }

  // Vite environment variable
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, "");
  }

  // If frontend and backend are served from the exact same domain (e.g., full-stack deployment or VPS)
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1" &&
    !window.location.hostname.endsWith(".vercel.app") &&
    !window.location.hostname.endsWith(".netlify.app")
  ) {
    return window.location.origin;
  }

  return "http://localhost:8000";
}

export function setApiBaseUrl(url) {
  if (typeof window !== "undefined") {
    if (!url || !url.trim()) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, url.trim().replace(/\/+$/, ""));
    }
  }
}

// ── Carto API Key & Tile URL Resolver ──
export function getCartoApiKey() {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(CARTO_STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim();
  }
  const envKey = import.meta.env.VITE_CARTO_API_KEY;
  if (envKey && envKey.trim()) return envKey.trim();
  return "";
}

export function setCartoApiKey(key) {
  if (typeof window !== "undefined") {
    if (!key || !key.trim()) {
      localStorage.removeItem(CARTO_STORAGE_KEY);
    } else {
      localStorage.setItem(CARTO_STORAGE_KEY, key.trim());
    }
  }
}

export function getCartoTileUrl(overrideKey = null) {
  const key = overrideKey !== null ? overrideKey : getCartoApiKey();
  if (key && key.trim()) {
    return `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?api_key=${encodeURIComponent(key.trim())}`;
  }
  return "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
}
