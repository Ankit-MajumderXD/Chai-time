/**
 * The three states every screen owes the user: still loading, nothing here yet,
 * and something broke. All three are designed — none of them is a spinner.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { pressable, spring } from '../design/motion';

export function Skeleton({
  width,
  height,
  radius,
  className,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
}) {
  return (
    <span
      className={`skeleton${className ? ' ' + className : ''}`}
      style={{ width, height, borderRadius: radius, display: 'block' }}
      aria-hidden
    />
  );
}

/**
 * The whole-app loading state: shown from first React render until the
 * connection + first subscription land. Mirrors the boot skeleton baked into
 * index.html so the handover from static HTML to React doesn't jump.
 */
export function AppSkeleton() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), 8000);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="app-skeleton bg-ambient" role="status" aria-label="Loading Chai Time">
      <Skeleton width={96} height={13} radius="var(--r-pill)" />
      <Skeleton width={168} height={30} radius="var(--r-md)" className="app-skeleton__name" />
      <Skeleton height={52} radius="var(--r-xl)" className="app-skeleton__bar" />

      <Skeleton width={88} height={14} radius="var(--r-pill)" className="app-skeleton__label" />
      <div className="rail app-skeleton__rail">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} width={56} height={56} radius="var(--r-pill)" />
        ))}
      </div>

      <Skeleton width={84} height={14} radius="var(--r-pill)" className="app-skeleton__label" />
      <Skeleton height={210} radius="var(--r-2xl)" className="app-skeleton__card" />
      <Skeleton height={210} radius="var(--r-2xl)" className="app-skeleton__card" />

      <AnimatePresence>
        {slow && (
          <motion.button
            className="btn btn--ghost btn--sm app-skeleton__reload"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => window.location.reload()}
          >
            Taking a while — reload
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Rooms list placeholder — same rhythm as the real cards, so nothing jumps. */
export function RoomsSkeleton() {
  return (
    <div className="stack" style={{ gap: 'var(--s-5)' }} aria-label="Loading your rooms">
      <div className="rail" style={{ gap: 'var(--s-4)' }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="stack" style={{ gap: 'var(--s-2)', alignItems: 'center' }}>
            <Skeleton width={58} height={58} radius="var(--r-pill)" />
            <Skeleton width={36} height={9} radius="var(--r-pill)" />
          </div>
        ))}
      </div>
      <div className="gutter stack" style={{ gap: 'var(--s-4)' }}>
        {[0, 1].map((i) => (
          <Skeleton key={i} height={224} radius="var(--r-2xl)" />
        ))}
      </div>
    </div>
  );
}

export function MomentsSkeleton() {
  return (
    <div className="gutter stack" style={{ gap: 'var(--s-5)' }} aria-label="Loading moments">
      {[0, 1].map((i) => (
        <div key={i} className="stack" style={{ gap: 'var(--s-3)' }}>
          <div style={{ display: 'flex', gap: 'var(--s-3)', alignItems: 'center' }}>
            <Skeleton width={38} height={38} radius="var(--r-pill)" />
            <Skeleton width={110} height={11} radius="var(--r-pill)" />
          </div>
          <Skeleton height={300} radius="var(--r-xl)" />
        </div>
      ))}
    </div>
  );
}

interface EmptyStateProps {
  art: ReactNode;
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
  compact?: boolean;
}

export function EmptyState({
  art,
  title,
  body,
  action,
  secondary,
  compact,
}: EmptyStateProps) {
  return (
    <motion.div
      className={`empty${compact ? ' empty--compact' : ''}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.gentle}
    >
      <div className="empty__art" aria-hidden>
        {art}
      </div>
      <h3 className="t-h2">{title}</h3>
      {body && <p className="t-sm muted empty__body">{body}</p>}
      {action && (
        <motion.button className="btn btn--primary" onClick={action.onClick} {...pressable}>
          {action.label}
        </motion.button>
      )}
      {secondary && (
        <motion.button className="btn btn--ghost" onClick={secondary.onClick} {...pressable}>
          {secondary.label}
        </motion.button>
      )}
    </motion.div>
  );
}

/** Friendly language only — never a status code. */
export function ErrorState({
  title = 'Something went wrong.',
  body = "Let's try that again.",
  onRetry,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      art={<div className="empty__emoji">🫠</div>}
      title={title}
      body={body}
      action={onRetry ? { label: 'Retry', onClick: onRetry } : undefined}
    />
  );
}

/** The one full-screen loader in the app: connecting to SpacetimeDB. */
export function Connecting({ label = 'Connecting…' }: { label?: string }) {
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setStuck(true), 8000);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="connecting">
      <motion.div
        className="connecting__mark"
        animate={{ scale: [1, 1.06, 1], rotate: [0, 3, -2, 0] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        🫖
      </motion.div>
      <p className="t-sm muted">{label}</p>
      {stuck && (
        <motion.button
          className="btn btn--ghost btn--sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => window.location.reload()}
        >
          Taking a while — reload
        </motion.button>
      )}
    </div>
  );
}

/**
 * Reconnecting.
 *
 * A dropped connection must never tear the room down — the last state stays on
 * screen, greyed slightly, with a quiet strip explaining itself. When the socket
 * comes back the subscription re-applies and everything catches up on its own.
 */
export function ConnectionBanner({ offline }: { offline: boolean }) {
  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          className="reconnect"
          role="status"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={spring.bouncy}
        >
          <span className="reconnect__spinner" aria-hidden />
          Reconnecting…
        </motion.div>
      )}
    </AnimatePresence>
  );
}
