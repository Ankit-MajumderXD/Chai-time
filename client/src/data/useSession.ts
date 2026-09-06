/**
 * Who am I, and do I have a profile yet?
 *
 * The SpacetimeDB identity is the account — there is no password, no email.
 * A `person` row existing for that identity is the only thing separating
 * onboarding from the app.
 */
import { useMemo } from 'react';
import { useTable } from 'spacetimedb/react';
import { tables } from '../module_bindings';
import type { Person } from '../module_bindings/types';
import { useConnection } from './db';

export interface Session {
  isActive: boolean;
  ready: boolean;
  /** null until the person row lands. */
  me: Person | null;
  myPersonId: bigint | null;
  hasProfile: boolean;
}

export function useSession(): Session {
  const { isActive, identity } = useConnection();
  const [people, peopleReady] = useTable(tables.person);

  return useMemo(() => {
    const hex = identity?.toHexString();
    const me = hex ? (people.find((p) => p.identity.toHexString() === hex) ?? null) : null;
    return {
      isActive,
      ready: isActive && peopleReady,
      me,
      myPersonId: me?.id ?? null,
      hasProfile: me !== null,
    };
  }, [isActive, identity, people, peopleReady]);
}
