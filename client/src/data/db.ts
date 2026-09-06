/**
 * The thin seam between React and SpacetimeDB.
 *
 * Everything below reads from live tables — there is no local cache, no
 * polling, no optimistic mirror. When a row changes on the server the
 * subscription pushes it and the component re-renders. That push *is* the
 * real-time behaviour the UI advertises.
 */
import { useSpacetimeDB } from 'spacetimedb/react';
import type { DbConnection } from '../module_bindings';

export function useConn(): DbConnection | null {
  const { getConnection } = useSpacetimeDB();
  return getConnection() as DbConnection | null;
}

export function useConnection() {
  const { isActive, identity, token, getConnection } = useSpacetimeDB();
  return {
    conn: getConnection() as DbConnection | null,
    isActive,
    identity,
    token,
  };
}

/**
 * Reducers are fire-and-forget: they don't return data, and a rejection just
 * means the write didn't land. Callers that care surface it through a toast.
 *
 * The call is also raced against a timeout. A healthy reducer round-trips in
 * well under a second; if nothing comes back in `timeoutMs` the connection has
 * stalled or the server dropped an over-large message — either way the UI must
 * not sit on a spinner forever, so we resolve `false` and let the caller
 * recover.
 */
export async function call<T>(
  work: Promise<T> | undefined,
  onError?: (message: string) => void,
  timeoutMs = 20_000
): Promise<boolean> {
  if (!work) return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs);
  });
  try {
    const outcome = await Promise.race([work.then(() => 'ok' as const), timeout]);
    if (outcome === 'timeout') {
      const message = "That took too long to go through — check your connection and try again.";
      console.error('[reducer] timeout after', timeoutMs, 'ms');
      onError?.(message);
      return false;
    }
    return true;
  } catch (err: any) {
    const message = err?.message ?? String(err);
    console.error('[reducer]', message);
    onError?.(message);
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
