/**
 * App root.
 *
 * Subscribes once, routes, and decides between onboarding and the app. Screens
 * below this point never touch the connection directly — they read live tables.
 */
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { tables } from './module_bindings';
import { AppShell, ScreenSwap, TabBar } from './components/AppShell';
import { AppSkeleton, ConnectionBanner } from './components/Feedback';
import { ToastProvider } from './components/Toast';
import { BadgeUnlockHost } from './components/BadgeUnlock';
import { Onboarding } from './screens/Onboarding';
import { Rooms } from './screens/Rooms';
import { Room } from './screens/Room';
import { Members } from './screens/Members';
import { Camera } from './screens/Camera';
import { CreateRoom } from './screens/CreateRoom';
import { Invite } from './screens/Invite';
import { JoinRoom } from './screens/JoinRoom';
import { Profile } from './screens/Profile';
import { Settings } from './screens/Settings';
import { RouterProvider, routeKey, useRouter, type Route } from './lib/router';
import { useConnection } from './data/db';
import { useSession } from './data/useSession';
import { saveToken } from './lib/auth';
import { connLog, debug } from './lib/log';
import { useSpacetimeDB } from 'spacetimedb/react';

import './design/tokens.css';
import './design/base.css';
import './design/components.css';
import './design/room.css';

/** Running count of live subscription handles — should return to 0 on teardown
 *  and never climb across reconnects. Watched during the "app freezes" hunt. */
let liveSubHandles = 0;

export default function App() {
  return (
    <RouterProvider>
      <ToastProvider>
        <AppShell>
          <Shell />
        </AppShell>
      </ToastProvider>
    </RouterProvider>
  );
}

function Shell() {
  const { conn, isActive, identity } = useConnection();
  const { token } = useSpacetimeDB();
  const { hasProfile, ready } = useSession();
  const { route, direction, go } = useRouter();
  const [subscribed, setSubscribed] = useState(false);
  const [everReady, setEverReady] = useState(false);

  /* Connection lifecycle after the first connect (which main.tsx logs): the
     SDK's own reconnect loop flips `isActive`, and we log each edge. */
  const connState = useRef<'init' | 'up' | 'down'>('init');
  const connRef = useRef(conn);
  useEffect(() => {
    debug('conn', 'state effect', {
      isActive,
      connChanged: connRef.current !== conn,
      connId: conn?.connectionId?.toHexString().slice(0, 8) ?? 'none',
      liveSubHandles,
    });
    connRef.current = conn;
    if (isActive && connState.current !== 'up') {
      if (connState.current === 'down') {
        connLog('reconnected', {
          identity: identity?.toHexString().slice(0, 12),
          connection: conn?.connectionId?.toHexString().slice(0, 12),
        });
      }
      connState.current = 'up';
    } else if (!isActive && connState.current === 'up') {
      connState.current = 'down';
      connLog('connection-lost');
    }
  }, [isActive, identity, conn]);

  /* Belt and braces with main.tsx's onConnect: whenever the SDK hands us a
     fresh token (first connect, or a silent re-auth) write it straight back
     to storage so a refresh always resumes this exact identity. */
  useEffect(() => {
    if (token) saveToken(token);
  }, [token]);

  useEffect(() => {
    if (isActive && subscribed && ready) setEverReady(true);
  }, [isActive, subscribed, ready]);

  /* Never hang on the loader. If we're connected but the subscription hasn't
     applied within a few seconds (a schema mismatch, a slow server, a dropped
     socket), show the app anyway with whatever has replicated — a half-populated
     screen the user can act on beats a spinner they can't. */
  useEffect(() => {
    if (!isActive || subscribed) return;
    const t = window.setTimeout(() => setSubscribed(true), 9000);
    return () => window.clearTimeout(t);
  }, [isActive, subscribed]);

  /* Two subscriptions, split by how much the app needs them:
       core     — people, rooms, moments, chat. The app is useless without these,
                  so `everReady` waits on this one applying.
       features — badges, roasts, prompts, voice. Best-effort: if the server is
                  on an older schema and rejects one of these, it must not take
                  the whole app down with it. */
  useEffect(() => {
    if (!conn || !isActive) return;
    debug('sub', 'effect run → subscribing', { liveSubHandles });
    const handles: Array<{ unsubscribe: () => void }> = [];

    try {
      handles.push(
        conn
          .subscriptionBuilder()
          .onApplied(() => {
            connLog('subscription-applied', { set: 'core' });
            setSubscribed(true);
          })
          .onError((ctx) => {
            connLog('subscription-error', { set: 'core', event: String(ctx.event) });
            // Even a core error shouldn't strand the user on the loader.
            setSubscribed(true);
          })
          .subscribe([
            tables.person,
            tables.room,
            tables.roomMember,
            tables.media,
            tables.moment,
            tables.message,
            tables.reaction,
            tables.roomEvent,
          ])
      );
    } catch (err) {
      console.error('[subscription:core] failed to start', err);
      setSubscribed(true);
    }

    try {
      handles.push(
        conn
          .subscriptionBuilder()
          .onApplied(() => connLog('subscription-applied', { set: 'features' }))
          .onError((ctx) =>
            connLog('subscription-error', { set: 'features', event: String(ctx.event) })
          )
          .subscribe([
            tables.badge,
            tables.roast,
            tables.roastVote,
            tables.promptLibrary,
            tables.customPrompt,
            tables.roomPromptSchedule,
            tables.roomPrompt,
            tables.roastLineLibrary,
            tables.roastReaction,
            tables.roomTitle,
            tables.voiceSession,
            tables.voiceParticipant,
            tables.signal,
          ])
      );
    } catch (err) {
      console.warn('[subscription:features] failed to start', err);
    }

    liveSubHandles += handles.length;
    debug('sub', 'subscribed', { added: handles.length, liveSubHandles });

    return () => {
      handles.forEach((h) => {
        try {
          h.unsubscribe();
        } catch (err) {
          debug('sub', 'unsubscribe threw', { err: String(err) });
        }
      });
      liveSubHandles -= handles.length;
      debug('sub', 'torn down', { removed: handles.length, liveSubHandles });
    };
  }, [conn, isActive]);

  // No profile yet → onboarding, whatever the URL says. An invite link is the
  // one exception: we keep it so they land in the room right after signing up.
  useEffect(() => {
    if (!ready || !subscribed) return;
    if (!hasProfile && route.name !== 'onboarding' && route.name !== 'join') {
      go({ name: 'onboarding' }, { replace: true });
    }
    if (hasProfile && route.name === 'onboarding') {
      go({ name: 'rooms' }, { replace: true });
    }
  }, [ready, subscribed, hasProfile, route.name, go]);

  // Someone opened an invite link before they have a profile: hold the code so
  // onboarding can auto-join that room the moment they finish.
  useEffect(() => {
    if (!hasProfile && route.name === 'join') {
      try {
        sessionStorage.setItem('chai:pendingJoin', route.code);
      } catch {
        /* private mode — they'll just land in rooms instead */
      }
    }
  }, [hasProfile, route]);

  // Only the very first connect gets a full-screen skeleton. After that a drop
  // is a banner over the room you were already looking at — never a teardown.
  if (!everReady) {
    debug('shell', 'render: AppSkeleton', { isActive, subscribed, ready });
    return <AppSkeleton />;
  }

  if (!hasProfile) {
    debug('shell', 'render: Onboarding', { route: routeKey(route) });
    return <Onboarding />;
  }

  debug('shell', 'render: app', { route: routeKey(route), direction });
  const tab = tabFor(route);

  return (
    <>
      <ConnectionBanner offline={!isActive} />
      <BadgeUnlockHost />
      <ScreenSwap screenKey={routeKey(route)} direction={direction}>
        <Screen route={route} />
      </ScreenSwap>

      <AnimatePresence>
        {tab && (
          <TabBar
            active={tab}
            onCapture={() =>
              go({
                name: 'camera',
                code: route.name === 'room' || route.name === 'members' ? route.code : undefined,
              })
            }
          />
        )}
      </AnimatePresence>
    </>
  );
}

function Screen({ route }: { route: Route }) {
  useEffect(() => {
    const key = routeKey(route);
    debug('screen', 'mount', { key });
    return () => debug('screen', 'unmount', { key });
    // routeKey is stable per (name, code); a change here is a real screen swap.
  }, [routeKey(route)]);

  return <ScreenBody route={route} />;
}

function ScreenBody({ route }: { route: Route }) {
  switch (route.name) {
    case 'onboarding':
      return <Onboarding />;
    case 'rooms':
      return <Rooms />;
    case 'room':
      return <Room code={route.code} />;
    case 'members':
      return <Members code={route.code} />;
    case 'invite':
      return <Invite code={route.code} />;
    case 'join':
      return <JoinRoom code={route.code} />;
    case 'create':
      return <CreateRoom />;
    case 'camera':
      return <Camera code={route.code} />;
    case 'profile':
      return <Profile />;
    case 'settings':
      return <Settings />;
  }
}

/**
 * The camera, the viewer and the modal-ish screens hide the bar — and so does
 * the room itself: inside a room the composer owns the bottom edge, and the
 * header's back button is the way out. The bar belongs to the top-level places.
 */
function tabFor(route: Route): 'rooms' | 'capture' | 'profile' | null {
  switch (route.name) {
    case 'rooms':
      return 'rooms';
    case 'profile':
      return 'profile';
    default:
      return null;
  }
}
