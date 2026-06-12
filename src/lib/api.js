const TOKEN_KEY = 'showbrain_token';
const USER_KEY  = 'showbrain_user';

// ── storage ───────────────────────────────────────────────────────────────────

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}

export function getStoredUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); }
  catch { return null; }
}

export function storeAuth({ token, username, isAdmin }) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify({ username, isAdmin }));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// ── fetch wrapper ─────────────────────────────────────────────────────────────

export async function apiFetch(url, options = {}) {
  const token = getStoredToken();
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(url, { ...options, headers });
}

// ── verify token on startup ───────────────────────────────────────────────────

export async function verifyStoredToken() {
  const token = getStoredToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { clearAuth(); return null; }
    return await res.json(); // { id, username, isAdmin }
  } catch {
    return null;
  }
}
