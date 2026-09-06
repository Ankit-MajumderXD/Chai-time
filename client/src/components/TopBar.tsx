/**
 * Screen headers.
 *
 * TopBar is the plain one (back arrow, title, one or two actions). RoomHeader is
 * the room's own — it carries the mood colour, the live count and the member
 * stack, and it condenses as you scroll so the photos get the room.
 */
import type { ReactNode } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { pressable } from '../design/motion';
import { haptic } from '../lib/haptics';

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      type="button"
      className="icon-btn"
      aria-label="Go back"
      onClick={() => {
        haptic('light');
        onClick();
      }}
      {...pressable}
    >
      <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden>
        <path
          d="M14.5 5.5 8 12l6.5 6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </motion.button>
  );
}

interface TopBarProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: ReactNode;
  transparent?: boolean;
}

export function TopBar({ title, subtitle, onBack, actions, transparent }: TopBarProps) {
  return (
    <header className={`topbar${transparent ? ' topbar--plain' : ''}`}>
      {onBack ? <BackButton onClick={onBack} /> : <span className="topbar__spacer" />}
      <div className="topbar__title">
        {title && <h1 className="t-h3 truncate">{title}</h1>}
        {subtitle && <p className="t-xs muted truncate">{subtitle}</p>}
      </div>
      <div className="topbar__actions">{actions}</div>
    </header>
  );
}

interface RoomHeaderProps {
  emoji: string;
  name: string;
  summary: string;
  mood: string;
  isEvent?: boolean;
  onBack: () => void;
  onMembers: () => void;
  onMore: () => void;
  /** Scroll container for the condense effect. */
  scrollRef: React.RefObject<HTMLElement>;
  /** The tab switcher rides along under the title. */
  children?: ReactNode;
}

export function RoomHeader({
  emoji,
  name,
  summary,
  mood,
  isEvent,
  onBack,
  onMembers,
  onMore,
  scrollRef,
  children,
}: RoomHeaderProps) {
  const { scrollY } = useScroll({ container: scrollRef as React.RefObject<HTMLElement> });
  const glass = useTransform(scrollY, [0, 48], [0, 1]);
  const titleScale = useTransform(scrollY, [0, 64], [1, 0.94]);

  return (
    <header className="room-header" data-mood={mood}>
      <motion.div className="room-header__wash" style={{ opacity: glass }} aria-hidden />
      <div className="room-header__row">
        <BackButton onClick={onBack} />

        <motion.div className="room-header__title" style={{ scale: titleScale }}>
          <h1 className="t-h3 truncate">
            <span className="room-header__emoji">{emoji}</span> {name}
          </h1>
          <p className="t-xs muted truncate">
            {isEvent && <span className="room-header__event">Live event · </span>}
            {summary}
          </p>
        </motion.div>

        <div className="topbar__actions">
          <motion.button
            type="button"
            className="icon-btn"
            aria-label="Members and activity"
            onClick={onMembers}
            {...pressable}
          >
            <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden>
              <circle cx="9.4" cy="9.6" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.7" />
              <path
                d="M3.8 19c0-2.9 2.5-4.7 5.6-4.7s5.6 1.8 5.6 4.7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
              <path
                d="M16.2 7.2a2.9 2.9 0 0 1 0 5.6M17.6 14.6c1.7.5 2.9 1.8 2.9 3.6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </motion.button>
          <motion.button
            type="button"
            className="icon-btn"
            aria-label="Room options"
            onClick={onMore}
            {...pressable}
          >
            <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden>
              <g fill="currentColor">
                <circle cx="6" cy="12" r="1.7" />
                <circle cx="12" cy="12" r="1.7" />
                <circle cx="18" cy="12" r="1.7" />
              </g>
            </svg>
          </motion.button>
        </div>
      </div>

      {children && <div className="room-header__tabs">{children}</div>}
    </header>
  );
}

/** Live / Moments / Media style tab switcher with a sliding pill. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string; count?: number }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            className="segmented__item"
            data-active={active}
            onClick={() => {
              haptic('light');
              onChange(option.value);
            }}
          >
            {active && (
              <motion.span
                className="segmented__pill"
                layoutId="segmented-pill"
                transition={{ type: 'spring', stiffness: 480, damping: 34 }}
                aria-hidden
              />
            )}
            <span className="segmented__label">
              {option.label}
              {option.count !== undefined && option.count > 0 && (
                <span className="segmented__count">{option.count}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
