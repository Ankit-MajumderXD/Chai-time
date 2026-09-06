/**
 * Settings.
 *
 * Small on purpose. The privacy section is written in plain language because
 * "who can see me" is the question this app is actually answering.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { TopBar } from '../components/TopBar';
import { useToast } from '../components/Toast';
import { itemVariants, listVariants, pressable, spring } from '../design/motion';
import { haptic } from '../lib/haptics';
import { useRouter } from '../lib/router';
import { useSession } from '../data/useSession';
import { useRooms } from '../data/useRooms';
import { call, useConn, useConnection } from '../data/db';
import { clearToken } from '../lib/auth';

interface Prefs {
  moments: boolean;
  joins: boolean;
  presence: boolean;
  ghost: boolean;
}

const PREFS_KEY = 'chai-time/prefs';

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {
    /* storage blocked — defaults are fine */
  }
  return defaults;
}

const defaults: Prefs = { moments: true, joins: true, presence: true, ghost: false };

export function Settings() {
  const { back } = useRouter();
  const { me } = useSession();
  const { rooms } = useRooms();
  const conn = useConn();
  const { identity } = useConnection();
  const toast = useToast();
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const signOut = () => {
    clearToken();
    // A full reload is the clean way to drop the identity: the SDK mints a
    // fresh one on the next connect and the app falls back to onboarding.
    window.location.reload();
  };

  const update = (key: keyof Prefs, value: boolean) => {
    haptic('light');
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* nothing to recover from */
    }

    // Ghost mode is the one preference the server has to know about — it is the
    // difference between your people seeing you and not.
    if (key === 'ghost') {
      void call(
        conn?.reducers.setActivity({
          activity: '',
          activityEmoji: '',
          status: value ? 'away' : 'online',
        })
      );
      toast({
        message: value ? "You're invisible for now 🌙" : 'Back on the map ✨',
      });
    }
  };

  return (
    <div className="screen settings-screen">
      <TopBar title="Settings" onBack={back} />

      <motion.div
        className="gutter stack settings-screen__body"
        variants={listVariants}
        initial="initial"
        animate="animate"
      >
        <motion.section className="settings-group" variants={itemVariants}>
          <h2 className="settings-group__title t-micro">Notifications</h2>
          <Toggle
            label="New moments"
            hint="When someone shares in a room you're in"
            on={prefs.moments}
            onChange={(v) => update('moments', v)}
          />
          <Toggle
            label="People joining"
            hint='The "Aisha joined ✨" whisper'
            on={prefs.joins}
            onChange={(v) => update('joins', v)}
          />
        </motion.section>

        <motion.section className="settings-group" variants={itemVariants}>
          <h2 className="settings-group__title t-micro">Privacy</h2>
          <Toggle
            label="Show my activity"
            hint="Your people see what you're up to"
            on={prefs.presence}
            onChange={(v) => update('presence', v)}
          />
          <Toggle
            label="Ghost mode"
            hint="Look around without showing up as online"
            on={prefs.ghost}
            onChange={(v) => update('ghost', v)}
          />
          <p className="t-xs muted settings-note">
            Nothing you share is public. Rooms are invite-only, there is no feed to
            be discovered in, and only people in a room can see what's in it.
          </p>
        </motion.section>

        <motion.section className="settings-group" variants={itemVariants}>
          <h2 className="settings-group__title t-micro">Help & support</h2>
          <div className="settings-static">
            <p className="t-body-strong">How do I add someone?</p>
            <p className="t-sm muted">
              Open a room → ＋ → share the link. Opening it signs them in; there's no
              account to make.
            </p>
          </div>
          <div className="settings-static">
            <p className="t-body-strong">Why can I see people instantly?</p>
            <p className="t-sm muted">
              Presence and moments come straight from SpacetimeDB over a live
              subscription, so a change on someone else's phone is already on yours.
            </p>
          </div>
        </motion.section>

        <motion.section className="settings-group" variants={itemVariants}>
          <h2 className="settings-group__title t-micro">You</h2>
          <div className="settings-static">
            <p className="t-body-strong">{me?.displayName ?? 'You'}</p>
            <p className="t-sm muted">
              @{me?.handle || 'you'} · in {rooms.length}{' '}
              {rooms.length === 1 ? 'room' : 'rooms'}
            </p>
            <p className="t-xs faint settings-note">
              🔑 Signed in on this device
              {identity ? ` · ${identity.toHexString().slice(0, 10)}…` : ''}. Your
              session stays put across refreshes — no password to lose.
            </p>
          </div>

          {confirmSignOut ? (
            <div className="settings-static settings-signout">
              <p className="t-sm">
                Sign out on this device? Without your invite links you won't be able
                to get back into this exact account.
              </p>
              <div className="settings-signout__actions">
                <motion.button
                  className="btn btn--ghost btn--sm"
                  onClick={() => setConfirmSignOut(false)}
                  {...pressable}
                >
                  Stay
                </motion.button>
                <motion.button
                  className="btn btn--danger btn--sm"
                  onClick={signOut}
                  {...pressable}
                >
                  Sign out
                </motion.button>
              </div>
            </div>
          ) : (
            <motion.button
              type="button"
              className="btn btn--ghost btn--sm settings-signout__trigger"
              onClick={() => setConfirmSignOut(true)}
              {...pressable}
            >
              Sign out
            </motion.button>
          )}
        </motion.section>

        <p className="t-micro faint settings-screen__version">Chai Time · made for your people</p>
      </motion.div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <motion.button
      type="button"
      className="toggle-row"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      {...pressable}
    >
      <span className="stack toggle-row__text">
        <span className="t-body-strong">{label}</span>
        <span className="t-xs muted">{hint}</span>
      </span>
      <span className="toggle" data-on={on}>
        <motion.span className="toggle__knob" layout transition={spring.bouncy} />
      </span>
    </motion.button>
  );
}
