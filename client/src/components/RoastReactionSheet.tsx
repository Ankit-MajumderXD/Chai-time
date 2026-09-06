/**
 * Roast reaction picker — tap, don't type.
 *
 * Pick a style first (🔥 😈 💀 🤡 — each with its own landing animation), then a
 * line from that style's library, or write your own with a heat pick. One
 * reaction per person per moment; sending again replaces it.
 */
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTable } from 'spacetimedb/react';
import { BottomSheet } from './Overlay';
import { tables } from '../module_bindings';
import type { RoastLineLibrary } from '../module_bindings/types';
import { pressable, spring } from '../design/motion';
import { haptic } from '../lib/haptics';
import {
  HEAT_ORDER,
  HEATS,
  ROAST_STYLE_ORDER,
  ROAST_STYLES,
  type Heat,
  type RoastStyle,
} from '../lib/roastLines';

interface Props {
  open: boolean;
  onClose: () => void;
  /** lineId 0n + text for a custom line, otherwise a library line id. */
  onSend: (lineId: bigint, customText: string, heat: Heat, style: RoastStyle) => void;
  mineStyle?: RoastStyle;
  mineHeat?: Heat;
}

export function RoastReactionSheet({ open, onClose, onSend, mineStyle, mineHeat }: Props) {
  const [lines] = useTable(tables.roastLineLibrary);
  const [styleTab, setStyleTab] = useState<RoastStyle>(mineStyle ?? 'fire');
  const [custom, setCustom] = useState('');
  const [customHeat, setCustomHeat] = useState<Heat>(mineHeat ?? 'spicy');

  useEffect(() => {
    if (open) setStyleTab(mineStyle ?? 'fire');
  }, [open, mineStyle]);

  const byStyle = useMemo(() => {
    const map: Record<RoastStyle, RoastLineLibrary[]> = { fire: [], devil: [], skull: [], clown: [] };
    for (const l of lines) {
      const s = (l.style as RoastStyle) in map ? (l.style as RoastStyle) : 'fire';
      map[s].push(l);
    }
    for (const s of ROAST_STYLE_ORDER) {
      map[s].sort((a, b) => HEAT_ORDER.indexOf(a.heatLevel as Heat) - HEAT_ORDER.indexOf(b.heatLevel as Heat));
    }
    return map;
  }, [lines]);

  const meta = ROAST_STYLES[styleTab];

  const fire = (lineId: bigint, text: string, heat: Heat) => {
    haptic(heat === 'savage' ? 'heavy' : heat === 'spicy' ? 'medium' : 'light');
    onSend(lineId, text, heat, styleTab);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} label="Roast reaction">
      <div className="roast-react">
        <h2 className="t-h2 sheet__title">Roast it {meta.emoji}</h2>

        {/* style picker — pick the vibe first */}
        <div className="roast-react__styles" role="tablist">
          {ROAST_STYLE_ORDER.map((s) => {
            const m = ROAST_STYLES[s];
            return (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={styleTab === s}
                className="roast-react__style"
                data-active={styleTab === s}
                style={{ ['--rb-hue' as string]: m.hue }}
                onClick={() => {
                  haptic('light');
                  setStyleTab(s);
                }}
              >
                <span className="roast-react__style-emoji">{m.emoji}</span>
                <span className="t-xs">{m.label}</span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={styleTab}
            className="roast-react__chips"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
          >
            {byStyle[styleTab].map((line) => (
              <motion.button
                key={String(line.id)}
                type="button"
                className="roast-react__chip"
                style={{ ['--rb-hue' as string]: meta.hue, ['--heat-hue' as string]: HEATS[(line.heatLevel as Heat) in HEATS ? (line.heatLevel as Heat) : 'mild'].hue }}
                onClick={() => fire(line.id, '', (line.heatLevel as Heat) in HEATS ? (line.heatLevel as Heat) : 'mild')}
                whileTap={{ scale: 0.94 }}
                transition={spring.pop}
              >
                <span className="roast-react__chip-heat" aria-hidden>
                  {HEATS[(line.heatLevel as Heat) in HEATS ? (line.heatLevel as Heat) : 'mild'].flames}
                </span>
                {line.text}
              </motion.button>
            ))}
            {byStyle[styleTab].length === 0 && <p className="t-sm muted">Loading lines…</p>}
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
          <p className="t-xs faint">write your own {meta.emoji}</p>
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
