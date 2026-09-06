/**
 * Toasts — the quiet kind.
 *
 * "Aisha joined the room ✨" should feel like a whisper from the side of the
 * screen, not a banner that blocks the photo you're looking at. They float in
 * at the top, never take focus, and dismiss themselves.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { spring } from '../design/motion';

export interface Toast {
  id: number;
  message: string;
  emoji?: string;
  tone?: 'neutral' | 'success' | 'error';
  avatarUrl?: string;
}

type Push = (toast: Omit<Toast, 'id'>) => void;

const ToastContext = createContext<Push>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const push = useCallback<Push>((toast) => {
    const id = nextId.current++;
    setToasts((current) => [...current.slice(-2), { ...toast, id }]);
    window.setTimeout(
      () => setToasts((current) => current.filter((t) => t.id !== id)),
      toast.tone === 'error' ? 4200 : 3000
    );
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-rail" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              className="toast"
              data-tone={toast.tone ?? 'neutral'}
              layout
              initial={{ opacity: 0, y: -18, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.96 }}
              transition={spring.bouncy}
            >
              {toast.avatarUrl ? (
                <img className="toast__avatar" src={toast.avatarUrl} alt="" />
              ) : (
                <span className="toast__emoji">{toast.emoji ?? '✨'}</span>
              )}
              <span className="toast__text">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Push {
  return useContext(ToastContext);
}
