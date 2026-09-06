/**
 * A ~100 line router.
 *
 * A three-tab mobile app doesn't need a routing library — it needs real URLs
 * (so an invite link works), a back stack, and a direction hint so
 * AnimatePresence knows whether to slide forward or back.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { debug } from './log';

export type Route =
  | { name: 'onboarding' }
  | { name: 'rooms' }
  | { name: 'room'; code: string }
  | { name: 'members'; code: string }
  | { name: 'invite'; code: string }
  | { name: 'join'; code: string }
  | { name: 'create' }
  | { name: 'camera'; code?: string }
  | { name: 'profile' }
  | { name: 'settings' };

export type Direction = 'forward' | 'back' | 'none';

function parse(pathname: string): Route {
  const parts = pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'rooms' };

  switch (parts[0]) {
    case 'r':
      if (!parts[1]) return { name: 'rooms' };
      if (parts[2] === 'members') return { name: 'members', code: parts[1].toUpperCase() };
      if (parts[2] === 'invite') return { name: 'invite', code: parts[1].toUpperCase() };
      return { name: 'room', code: parts[1].toUpperCase() };
    case 'join':
      return parts[1] ? { name: 'join', code: parts[1].toUpperCase() } : { name: 'rooms' };
    case 'create':
      return { name: 'create' };
    case 'camera':
      return parts[1] ? { name: 'camera', code: parts[1].toUpperCase() } : { name: 'camera' };
    case 'me':
      return { name: 'profile' };
    case 'settings':
      return { name: 'settings' };
    case 'welcome':
      return { name: 'onboarding' };
    default:
      return { name: 'rooms' };
  }
}

export function href(route: Route): string {
  switch (route.name) {
    case 'rooms':
      return '/';
    case 'room':
      return `/r/${route.code}`;
    case 'members':
      return `/r/${route.code}/members`;
    case 'invite':
      return `/r/${route.code}/invite`;
    case 'join':
      return `/join/${route.code}`;
    case 'create':
      return '/create';
    case 'camera':
      return route.code ? `/camera/${route.code}` : '/camera';
    case 'profile':
      return '/me';
    case 'settings':
      return '/settings';
    case 'onboarding':
      return '/welcome';
  }
}

/** Depth is what tells a transition whether it is a push or a pop. */
const DEPTH: Record<Route['name'], number> = {
  onboarding: 0,
  rooms: 0,
  profile: 0,
  create: 1,
  room: 1,
  join: 1,
  camera: 2,
  members: 2,
  invite: 2,
  settings: 1,
};

/** Where "back" goes when there is no app history left to pop — so a fast
 *  back-button tap can never walk the browser out of the app. */
function parentOf(route: Route): Route {
  switch (route.name) {
    case 'members':
    case 'invite':
      return { name: 'room', code: route.code };
    case 'camera':
      return route.code ? { name: 'room', code: route.code } : { name: 'rooms' };
    case 'settings':
      return { name: 'profile' };
    case 'room':
    case 'create':
    case 'join':
    default:
      return { name: 'rooms' };
  }
}

interface RouterValue {
  route: Route;
  direction: Direction;
  go: (route: Route, opts?: { replace?: boolean }) => void;
  back: () => void;
}

const RouterContext = createContext<RouterValue | null>(null);

export function RouterProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(() => parse(window.location.pathname));
  const [direction, setDirection] = useState<Direction>('none');
  const previous = useRef(route);
  /** How many history entries *this app* has pushed since it loaded. `back()`
   *  will only call `history.back()` while this is positive, so hammering the
   *  back button can never pop the browser off the app onto a blank page. */
  const appDepth = useRef(0);
  const lastBack = useRef(0);

  useEffect(() => {
    const onPop = () => {
      const next = parse(window.location.pathname);
      appDepth.current = Math.max(0, appDepth.current - 1);
      debug('nav', 'popstate', {
        from: routeKey(previous.current),
        to: routeKey(next),
        path: window.location.pathname,
        appDepth: appDepth.current,
      });
      setDirection(DEPTH[next.name] < DEPTH[previous.current.name] ? 'back' : 'forward');
      previous.current = next;
      setRoute(next);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const go = useCallback((next: Route, opts?: { replace?: boolean }) => {
    const url = href(next);
    // A repeat tap on the thing you're already looking at must not stack a
    // history entry — otherwise "back" needs N taps to do anything.
    const replace = opts?.replace || url === window.location.pathname;
    debug('nav', replace ? 'go(replace)' : 'go(push)', {
      from: routeKey(previous.current),
      to: routeKey(next),
      url,
      appDepth: appDepth.current + (replace ? 0 : 1),
    });
    if (replace) window.history.replaceState({}, '', url);
    else {
      window.history.pushState({}, '', url);
      appDepth.current += 1;
    }

    setDirection(
      DEPTH[next.name] === DEPTH[previous.current.name]
        ? 'none'
        : DEPTH[next.name] > DEPTH[previous.current.name]
          ? 'forward'
          : 'back'
    );
    previous.current = next;
    setRoute(next);
  }, []);

  const back = useCallback(() => {
    // Swallow a burst of taps — one back per ~350ms (roughly a transition).
    const now = Date.now();
    if (now - lastBack.current < 350) {
      debug('nav', 'back() ignored (too fast)', { sinceLast: now - lastBack.current });
      return;
    }
    lastBack.current = now;

    debug('nav', 'back()', {
      from: routeKey(previous.current),
      appDepth: appDepth.current,
    });

    if (appDepth.current > 0) {
      window.history.back();
    } else {
      // Nothing of ours left on the stack — go to the sensible parent in place
      // rather than letting the browser leave the app.
      go(parentOf(previous.current), { replace: true });
    }
  }, [go]);

  const value = useMemo(() => ({ route, direction, go, back }), [route, direction, go, back]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterValue {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter must be used inside <RouterProvider>');
  return ctx;
}

/** A stable key per screen so AnimatePresence swaps at the right moments. */
export function routeKey(route: Route): string {
  return 'code' in route && route.code ? `${route.name}:${route.code}` : route.name;
}
