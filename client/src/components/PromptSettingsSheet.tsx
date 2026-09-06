/**
 * Scheduled prompt settings (owner only).
 *
 * Queue one or more daily times, choose the default pack (family / friends) or
 * "your own", write a custom prompt, toggle the schedule on/off, or fire one
 * right now. Times are shown and entered in the owner's local zone and
 * converted to UTC before they hit the schedule table (a reducer can't know a
 * device's zone).
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BottomSheet } from './Overlay';
import { pressable, spring } from '../design/motion';
import { haptic } from '../lib/haptics';
import { localToUtcHHMM, utcToLocalHHMM, type RoomPromptState } from '../data/usePrompts';

type Source = 'default_family' | 'default_friends' | 'custom';

const SOURCES: Array<{ key: Source; label: string; emoji: string }> = [
  { key: 'default_family', label: 'Family pack', emoji: '🏠' },
  { key: 'default_friends', label: 'Friends pack', emoji: '🎈' },
  { key: 'custom', label: 'Your own', emoji: '✍️' },
];

const MAX_SLOTS = 7;
const minsOf = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
};

interface Props {
  open: boolean;
  onClose: () => void;
  state: RoomPromptState;
  onSaveSchedule: (localTimes: string[], utcTimes: string[], source: Source, isActive: boolean) => void;
  onAddCustomPrompt: (text: string) => void;
  onSendNow: (text: string, source: Source) => void;
}

export function PromptSettingsSheet({
  open,
  onClose,
  state,
  onSaveSchedule,
  onAddCustomPrompt,
  onSendNow,
}: Props) {
  const [times, setTimes] = useState<string[]>(['09:00']);
  const [newTime, setNewTime] = useState('18:00');
  const [source, setSource] = useState<Source>('default_family');
  const [active, setActive] = useState(true);
  const [customText, setCustomText] = useState('');

  useEffect(() => {
    if (!open) return;
    const slots = state.schedules;
    setTimes(
      slots.length > 0
        ? slots.map((s) => utcToLocalHHMM(s.scheduledTime))
        : ['09:00']
    );
    setSource((slots[0]?.source as Source) ?? 'default_family');
    setActive(slots.length > 0 ? slots.every((s) => s.isActive) : true);
    setCustomText(state.activeCustom?.text ?? '');
  }, [open, state.schedules, state.activeCustom]);

  const full = times.length >= MAX_SLOTS;
  const sourceSummary =
    source === 'custom'
      ? customText.trim()
        ? `“${customText.trim().slice(0, 28)}${customText.trim().length > 28 ? '…' : ''}”`
        : 'Your own prompt'
      : SOURCES.find((s) => s.key === source)?.label ?? 'Family pack';

  const addTime = () => {
    if (!newTime || times.includes(newTime) || full) return;
    haptic('light');
    setTimes((t) => [...t, newTime].sort((a, b) => minsOf(a) - minsOf(b)));
  };
  const removeTime = (t: string) => {
    haptic('light');
    setTimes((list) => list.filter((x) => x !== t));
  };

  const save = () => {
    haptic('medium');
    if (source === 'custom' && customText.trim()) {
      onAddCustomPrompt(customText.trim());
    }
    const local = [...times].sort((a, b) => minsOf(a) - minsOf(b));
    onSaveSchedule(local, local.map(localToUtcHHMM), source, active);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} label="Scheduled prompt">
      <div className="prompt-settings">
        <h2 className="t-h2 sheet__title">Daily prompts 🗣️</h2>
        <p className="t-sm muted">
          Nudge the room at set times each day — a photo prompt everyone answers.
        </p>

        <div className="field">
          <span className="field__label">
            Daily times <span className="muted">· {times.length}/{MAX_SLOTS}</span>
          </span>
          <ul className="prompt-slots">
            {times.length === 0 && (
              <li className="prompt-slots__empty t-xs muted">
                No times yet — add one below.
              </li>
            )}
            {times.map((t) => (
              <li key={t} className="prompt-slot">
                <span className="prompt-slot__time">{t}</span>
                <span className="prompt-slot__source truncate">{sourceSummary}</span>
                <button
                  type="button"
                  className="prompt-slot__remove"
                  aria-label={`Remove the ${t} prompt`}
                  onClick={() => removeTime(t)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          {full ? (
            <p className="t-xs muted prompt-slots__cap">
              That's the max of {MAX_SLOTS} a day. Remove one to add another.
            </p>
          ) : (
            <div className="prompt-settings__add-time">
              <input
                type="time"
                className="input"
                aria-label="New prompt time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
              />
              <button
                type="button"
                className="btn btn--soft btn--sm"
                onClick={addTime}
                disabled={times.includes(newTime)}
              >
                Add a time
              </button>
            </div>
          )}
        </div>

        <div className="field">
          <span className="field__label">Prompt source</span>
          <div className="prompt-settings__sources">
            {SOURCES.map((s) => (
              <motion.button
                key={s.key}
                type="button"
                className="prompt-settings__source"
                data-active={source === s.key}
                onClick={() => {
                  haptic('light');
                  setSource(s.key);
                }}
                whileTap={{ scale: 0.95 }}
                transition={spring.pop}
              >
                <span>{s.emoji}</span>
                <b>{s.label}</b>
              </motion.button>
            ))}
          </div>
        </div>

        {source === 'custom' && (
          <div className="field">
            <label className="field__label" htmlFor="prompt-custom">
              Your prompt
            </label>
            <textarea
              id="prompt-custom"
              className="input"
              rows={2}
              maxLength={200}
              value={customText}
              placeholder="Aaj kiska mood off hai? 😤"
              onChange={(e) => setCustomText(e.target.value)}
            />
          </div>
        )}

        <button
          type="button"
          className="toggle-row"
          role="switch"
          aria-checked={active}
          onClick={() => {
            haptic('light');
            setActive((v) => !v);
          }}
        >
          <span className="stack toggle-row__text">
            <span className="t-body-strong">Schedule on</span>
            <span className="t-xs muted">
              Fires once a day at {times.length === 1 ? 'the time' : 'each time'} above
            </span>
          </span>
          <span className="toggle" data-on={active}>
            <motion.span className="toggle__knob" layout transition={spring.bouncy} />
          </span>
        </button>

        <motion.button className="btn btn--primary btn--block" onClick={save} {...pressable}>
          Save schedule
        </motion.button>

        <motion.button
          className="btn btn--ghost btn--block"
          onClick={() => {
            haptic('medium');
            onSendNow(source === 'custom' ? customText.trim() : '', source);
            onClose();
          }}
          {...pressable}
        >
          Send a prompt now
        </motion.button>
      </div>
    </BottomSheet>
  );
}
