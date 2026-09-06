/**
 * Fire roast reaction picker — tap, don't type.
 *
 * A bottom sheet with mild / spicy / savage tabs, each showing that tier's
 * library lines as tappable chips, and a "write your own 🔥" panel at the
 * bottom that takes free text plus a heat pick.
 */
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTable } from 'spacetimedb/react';
import { BottomSheet } from './Overlay';
import { tables } from '../module_bindings';
import type { RoastLineLibrary } from '../module_bindings/types';
import { pressable, spring } from '../design/motion';
import { haptic } from '../lib/haptics';
import { HEAT_ORDER, HEATS, type Heat } from '../lib/roastLines';

interface Props {
  open: boolean;
  onClose: () => void;
  /** lineId 0n + text for a custom line, otherwise a library line id. */
  onSend: (lineId: bigint, customText: string, heat: Heat) => void;
  mineHeat?: Heat;
}

export function RoastReactionSheet({ open, onClose, onSend, mineHeat }: Props) {
  const [lines] = useTable(tables.roastLineLibrary);
  const [tab, setTab] = useState<Heat>(mineHeat ?? 'spicy');
  const [custom, setCustom] = useState('');
  const [customHeat, setCustomHeat] = useState<Heat>('spicy');

  const byHeat = useMemo(() => {
    const map: Record<Heat, RoastLineLibrary[]> = { mild: [], spicy: [], savage: [] };
    for (const l of lines) {
      const h = (l.heatLevel as Heat) in map ? (l.heatLevel as Heat) : 'mild';
      map[h].push(l);
    }
    return map;
  }, [lines]);

  const fire = (lineId: bigint, text: string, heat: Heat) => {
    haptic(heat === 'savage' ? 'heavy' : heat === 'spicy' ? 'medium' : 'light');
    onSend(lineId, text, heat);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} label="Fire roast reaction">
      <div className="roast-react">
        <h2 className="t-h2 sheet__title">Roast it 🔥</h2>

        <div className="roast-react__tabs" role="tablist">
          {HEAT_ORDER.map((h) => (
            <button
              key={h}
              type="button"
              role="tab"
              aria-selected={tab === h}
              className="roast-react__tab"
              data-active={tab === h}
              style={{ ['--heat-hue' as string]: HEATS[h].hue }}
              onClick={() => {
                haptic('light');
                setTab(h);
              }}
            >
              {HEATS[h].flames} <span className="t-xs">{HEATS[h].label}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            className="roast-react__chips"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
          >
            {byHeat[tab].map((line) => (
              <motion.button
                key={String(line.id)}
                type="button"
                className="roast-react__chip"
                style={{ ['--heat-hue' as string]: HEATS[tab].hue }}
                onClick={() => fire(line.id, '', tab)}
                whileTap={{ scale: 0.94 }}
                transition={spring.pop}
              >
                {line.text}
              </motion.button>
            ))}
            {byHeat[tab].length === 0 && (
              <p className="t-sm muted">Loading lines…</p>
            )}
          </motion.div>
        </AnimatePresence>

        <form
          className="roast-react__own"
          onSubmit={(e) => {
            e.preventDefault();
            const body = custom.trim();
            if (body) fire(0n, body, customHeat);
          }}
        >
          <p className="t-xs faint">write your own 🔥</p>
          <div className="roast-react__own-row">
            <input
              className="input"
              value={custom}
              maxLength={160}
              placeholder="type your heat…"
              onChange={(e) => setCustom(e.target.value)}
            />
            <button type="submit" className="btn btn--primary btn--sm" disabled={!custom.trim()}>
              Send
            </button>
          </div>
          <div className="roast-react__own-heat">
            {HEAT_ORDER.map((h) => (
              <motion.button
                key={h}
                type="button"
                className="roast-react__heat-pick"
                data-active={customHeat === h}
                style={{ ['--heat-hue' as string]: HEATS[h].hue }}
                onClick={() => setCustomHeat(h)}
                {...pressable}
              >
                {HEATS[h].flames}
              </motion.button>
            ))}
          </div>
        </form>
      </div>
    </BottomSheet>
  );
}
