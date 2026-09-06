/**
 * Onboarding — two beats.
 *
 * 1. Why you're here: a headline, a stack of real photographs, three faces.
 * 2. Who you are: a name and a face. There is no password and no email; the
 *    SpacetimeDB identity already in the browser *is* the account, so this is
 *    the entire sign-up.
 */
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Ambient } from '../components/AmbientLazy';
import { PhotoStack } from '../components/PhotoStack';
import { AvatarPicker } from '../components/AvatarPicker';
import { useToast } from '../components/Toast';
import { pressable, spring } from '../design/motion';
import { handleFrom } from '../lib/format';
import { haptic } from '../lib/haptics';
import { call, useConn } from '../data/db';
import { useRouter } from '../lib/router';

const DEFAULT_AVATAR = 'https://i.pravatar.cc/240?img=31';

export function Onboarding() {
  const conn = useConn();
  const toast = useToast();
  const { go } = useRouter();
  const [step, setStep] = useState<'hero' | 'you'>('hero');
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_AVATAR);
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    const trimmed = name.trim();
    if (!trimmed || !conn || saving) return;
    setSaving(true);
    haptic('success');

    const ok = await call(
      conn.reducers.saveProfile({
        displayName: trimmed,
        handle: handleFrom(trimmed),
        avatarUrl,
        bio: 'Building moments with my people ✨',
      }),
      (message) => toast({ message, tone: 'error', emoji: '⚠️' })
    );

    if (!ok) {
      setSaving(false);
      return;
    }

    // Three rooms full of people, so the app is worth opening on day one.
    await call(conn.reducers.seedDemoRooms({}));
    toast({ message: `Welcome in, ${trimmed.split(' ')[0]}`, emoji: '👋' });

    // Came in from an invite link? Join that room and land straight in it.
    let pendingJoin: string | null = null;
    try {
      pendingJoin = sessionStorage.getItem('chai:pendingJoin');
      sessionStorage.removeItem('chai:pendingJoin');
    } catch {
      pendingJoin = null;
    }
    if (pendingJoin) {
      const joined = await call(conn.reducers.joinRoom({ code: pendingJoin }));
      if (joined) {
        go({ name: 'room', code: pendingJoin }, { replace: true });
        return;
      }
    }

    go({ name: 'rooms' }, { replace: true });
  };

  return (
    <div className="screen screen--flush onboarding">
      <Ambient intensity={0.62} />

      <AnimatePresence mode="wait" initial={false}>
        {step === 'hero' ? (
          <motion.div
            key="hero"
            className="onboarding__pane"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.28 }}
          >
            <div className="onboarding__top">
              <motion.span
                className="brand"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={spring.gentle}
              >
                <span className="brand__mark">🫖</span> Chai Time
              </motion.span>
            </div>

            <PhotoStack />

            <motion.div
              className="onboarding__copy gutter"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.gentle, delay: 0.35 }}
            >
              <h1 className="t-display">
                Real moments.
                <br />
                Better together.
              </h1>
              <p className="t-body muted onboarding__sub">
                A private space for your people to share what's happening right now.
              </p>

              <div className="onboarding__proof">
                <span className="pill pill--mood" data-mood="friends">
                  🔒 Private
                </span>
                <span className="pill pill--live">
                  <span className="dot-live" /> Real-time
                </span>
                <span className="pill">👀 Just your people</span>
              </div>
            </motion.div>

            <motion.div
              className="onboarding__actions gutter"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.gentle, delay: 0.45 }}
            >
              <motion.button
                className="btn btn--primary btn--block"
                onClick={() => {
                  haptic('medium');
                  setStep('you');
                }}
                {...pressable}
              >
                Get started
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                  <path
                    d="M5 12h13m-5-5 5 5-5 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </motion.button>
              <p className="t-sm muted onboarding__login">
                Got an invite link? Just open it — it signs you in.
              </p>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="you"
            className="onboarding__pane onboarding__pane--form"
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.26 }}
          >
            <div className="onboarding__top">
              <motion.button
                className="btn btn--ghost"
                onClick={() => setStep('hero')}
                {...pressable}
              >
                ← Back
              </motion.button>
            </div>

            <div className="gutter stack onboarding__form">
              <h1 className="t-h1">Who are you?</h1>
              <p className="t-sm muted">
                Just a name and a face. No email, no password — your people will
                know it's you.
              </p>

              <motion.div
                className="onboarding__avatar"
                initial={{ scale: 0.94, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={spring.bouncy}
              >
                <AvatarPicker
                  name={name}
                  value={avatarUrl}
                  onChange={setAvatarUrl}
                  onError={(message) => toast({ message, tone: 'error', emoji: '⚠️' })}
                />
              </motion.div>

              <form
                className="field"
                onSubmit={(e) => {
                  e.preventDefault();
                  void finish();
                }}
              >
                <input
                  className="input"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={40}
                  autoFocus
                  autoComplete="name"
                />
                <motion.button
                  type="submit"
                  className="btn btn--primary btn--block"
                  disabled={!name.trim() || saving}
                  {...pressable}
                >
                  {saving ? 'Setting things up…' : 'Enter Chai Time'}
                </motion.button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
