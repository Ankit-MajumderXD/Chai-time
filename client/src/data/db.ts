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
 */
export async function call<T>(
  work: Promise<T> | undefined,
  onError?: (message: string) => void
): Promise<boolean> {
  if (!work) return false;
  try {
    await work;
    return true;
  } catch (err: any) {
    const message = err?.message ?? String(err);
    console.error('[reducer]', message);
    onError?.(message);
    return false;
  }
}
