import { SITE_URL } from "./env.js";

export function getBaseUrl() {
  if (SITE_URL) return SITE_URL.replace(/\/$/, "");
  return window.location.origin;
}

export function readQuery() {
  const q = new URLSearchParams(window.location.search);
  const chainId = q.get("c");
  const dailyKey = q.get("d"); // YYYY-MM-DD or "today"
  const mode = q.get("m"); // optional (classic, phase)
  return { chainId, dailyKey, mode };
}

export function setQuery(params) {
  const q = new URLSearchParams(window.location.search);
  Object.entries(params).forEach(([k, v]) => {
    if (v === null || v === undefined || v === "") q.delete(k);
    else q.set(k, String(v));
  });
  const next = `${window.location.pathname}?${q.toString()}`.replace(/\?$/, "");
  window.history.replaceState({}, "", next);
}

export function buildShareUrl({ chainId, dailyKey, mode }) {
  const base = getBaseUrl();
  const q = new URLSearchParams();
  if (chainId) q.set("c", chainId);
  if (dailyKey) q.set("d", dailyKey);
  if (mode) q.set("m", mode);
  const qs = q.toString();
  return qs ? `${base}/?${qs}` : `${base}/`;
}
