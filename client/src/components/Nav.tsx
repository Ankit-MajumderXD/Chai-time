/**
 * Bottom navigation + the capture button.
 *
 * Three destinations, one of which is a verb. Capture sits proud of the bar on
 * its own floating disc because it's the thing the app exists to do — the other
 * two are just places.
 */
import { motion } from 'framer-motion';
import { haptic } from '../lib/haptics';
import { pressable, shutterPress, spring } from '../design/motion';
import { useRouter, type Route } from '../lib/router';

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="23" height="23" aria-hidden>
      <path
        d="M4 10.6 12 4.5l8 6.1V19a1.6 1.6 0 0 1-1.6 1.6h-3.1v-5.2h-6.6v5.2H5.6A1.6 1.6 0 0 1 4 19v-8.4Z"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.7}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MeIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="23" height="23" aria-hidden>
      <circle
        cx="12"
        cy="8.6"
        r="3.7"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.7}
      />
      <path
        d="M4.8 20.2c0-3.6 3.2-5.9 7.2-5.9s7.2 2.3 7.2 5.9"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 1.7}
        strokeLinecap="round"
      />
    </svg>
  );
}

function ShutterIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
      <path
        d="M4.6 8.4h2.9l1.4-2.1h6.2l1.4 2.1h2.9A1.6 1.6 0 0 1 21 10v7.6a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 17.6V10a1.6 1.6 0 0 1 1.6-1.6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13.6" r="3.3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function CameraButton({
  onPress,
  size = 62,
  pulse = true,
  label = 'Capture',
}: {
  onPress: () => void;
  size?: number;
  pulse?: boolean;
  label?: string;
}) {
  return (
    <motion.button
      type="button"
      className="capture-btn"
      style={{ width: size, height: size }}
      aria-label={label}
      onClick={() => {
        haptic('medium');
        onPress();
      }}
      {...shutterPress}
    >
      {pulse && <span className="capture-btn__pulse" aria-hidden />}
      <span className="capture-btn__face">
        <ShutterIcon />
      </span>
    </motion.button>
  );
}

interface NavProps {
  active: 'rooms' | 'capture' | 'profile';
  onCapture: () => void;
}

export function BottomNav({ active, onCapture }: NavProps) {
  const { go } = useRouter();

  const item = (
    key: 'rooms' | 'profile',
    label: string,
    route: Route,
    Icon: (p: { active: boolean }) => JSX.Element
  ) => {
    const isActive = active === key;
    return (
      <motion.button
        type="button"
        className="nav__item"
        data-active={isActive}
        aria-current={isActive ? 'page' : undefined}
        onClick={() => {
          haptic('light');
          go(route);
        }}
        {...pressable}
      >
        <span className="nav__icon">
          <Icon active={isActive} />
          {isActive && (
            <motion.span
              className="nav__blob"
              layoutId="nav-blob"
              transition={spring.gentle}
              aria-hidden
            />
          )}
        </span>
        <span className="nav__label">{label}</span>
      </motion.button>
    );
  };

  return (
    <nav className="nav" aria-label="Primary">
      <div className="nav__bar glass">
        {item('rooms', 'Rooms', { name: 'rooms' }, HomeIcon)}
        <div className="nav__slot" aria-hidden />
        {item('profile', 'Me', { name: 'profile' }, MeIcon)}
      </div>

      <div className="nav__capture">
        <CameraButton onPress={onCapture} />
        <span className="nav__capture-label">Capture</span>
      </div>
    </nav>
  );
}
