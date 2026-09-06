/**
 * Session persistence.
 *
 * The SpacetimeDB identity token *is* the account — there is no email or
 * password. Storing it in localStorage is what makes a returning visitor
 * (or a page refresh) land straight back in their own session instead of
 * being minted a brand-new identity.
 *
 * The key is deliberately stable: it does not depend on the server URL, so
 * switching between `localhost` and `127.0.0.1` in dev, or moving the module
 * between hosts, never silently orphans a session.
 */

const KEY = 'chai-time:auth-token';

/** Older builds keyed the token by `${host}/${db}/auth_token`. */
const LEGACY_PREFIXES = ['ws://localhost:3000/', 'ws://127.0.0.1:3000/'];

export function loadToken(): string | undefined {
  try {
    const current = localStorage.getItem(KEY);
    if (current) return current;

    // One-time migration from any legacy host-scoped key.
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.endsWith('/auth_token')) continue;
      if (!LEGACY_PREFIXES.some((p) => k.startsWith(p))) continue;
      const value = localStorage.getItem(k);
      if (value) {
        localStorage.setItem(KEY, value);
        return value;
      }
    }
  } catch {
    /* private mode or storage disabled — the session just won't persist */
  }
  return undefined;
}

export function saveToken(token: string | undefined | null): void {
  if (!token) return;
  try {
    localStorage.setItem(KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(KEY);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.endsWith('/auth_token')) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}
