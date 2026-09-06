/**
 * The ⋯ menu, and the two sheets behind it.
 *
 * Everyone gets room info, invite, mute, media, search and leave. The owner
 * additionally gets the room's identity — its name, emoji, mood, cover and
 * whether it's an event — plus member management and deletion, each one
 * confirmed rather than instant.
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Avatar } from './Avatar';
import { BottomSheet, Modal } from './Overlay';
import { pressable, spring } from '../design/motion';
import { memberSummary } from '../lib/format';
import { ROOM_MOODS, coverFor, photoUrl, type RoomKind } from '../lib/rooms';
import { haptic } from '../lib/haptics';
import type { Room, RoomMember } from '../module_bindings/types';

export interface RoomMenuProps {
  open: boolean;
  onClose: () => void;
  room: Room;
  members: RoomMember[];
  activeCount: number;
  isOwner: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onInvite: () => void;
  onMembers: () => void;
  onMedia: () => void;
  onSearch: () => void;
  onSettings: () => void;
  onPrompts: () => void;
  onLeave: () => void;
  onShare: () => void;
}

export function RoomMenu({
  open,
  onClose,
  room,
  members,
  activeCount,
  isOwner,
  muted,
  onToggleMute,
  onInvite,
  onMembers,
  onMedia,
  onSearch,
  onSettings,
  onPrompts,
  onLeave,
  onShare,
}: RoomMenuProps) {
  return (
    <BottomSheet open={open} onClose={onClose} label="Room options">
      <div className="room-info">
        <span className="room-info__badge" data-mood={room.kind}>
          {room.emoji}
        </span>
        <div>
          <h2 className="t-h2">{room.name}</h2>
          <p className="t-xs muted">
            {memberSummary(members.length, activeCount)} · code {room.code}
          </p>
        </div>
      </div>

      <p className="privacy-line t-xs">
        🔒 Private room. Only these {members.length} people can see the moments, messages,
        voice and media in here.
      </p>

      <div className="sheet__actions">
        <MenuRow icon="🔗" label="Share invite link" onClick={onShare} />
        <MenuRow icon="✨" label="Invite people" onClick={onInvite} />
        <MenuRow icon="👥" label="Members & activity" onClick={onMembers} />
        <MenuRow icon="🖼️" label="Media" onClick={onMedia} />
        <MenuRow icon="🔍" label="Search this room" onClick={onSearch} />
        <MenuRow
          icon={muted ? '🔕' : '🔔'}
          label={muted ? 'Notifications muted' : 'Mute notifications'}
          onClick={onToggleMute}
        />
        {isOwner && <MenuRow icon="🗣️" label="Scheduled prompt" onClick={onPrompts} />}
        {isOwner && <MenuRow icon="⚙️" label="Room settings" onClick={onSettings} />}
        <MenuRow icon="🚪" label="Leave room" danger onClick={onLeave} />
      </div>
    </BottomSheet>
  );
}

function MenuRow({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: string;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`sheet__action${danger ? ' sheet__action--danger' : ''}`}
      onClick={() => {
        haptic('light');
        onClick();
      }}
    >
      <span aria-hidden>{icon}</span> {label}
    </button>
  );
}

/* ----------------------------------------------------------- Owner tools -- */

export function RoomSettings({
  open,
  onClose,
  room,
  members,
  onSave,
  onRemoveMember,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  room: Room;
  members: RoomMember[];
  onSave: (patch: {
    name: string;
    emoji: string;
    kind: string;
    coverUrl: string;
    isEvent: boolean;
    roastMode: boolean;
  }) => void;
  onRemoveMember: (member: RoomMember) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(room.name);
  const [kind, setKind] = useState<RoomKind>(room.kind as RoomKind);
  const [emoji, setEmoji] = useState(room.emoji);
  const [isEvent, setIsEvent] = useState(room.isEvent);
  const [roastMode, setRoastMode] = useState(room.roastMode);
  const [cover, setCover] = useState(room.coverUrl);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(room.name);
    setKind(room.kind as RoomKind);
    setEmoji(room.emoji);
    setIsEvent(room.isEvent);
    setRoastMode(room.roastMode);
    setCover(room.coverUrl);
  }, [open, room.name, room.kind, room.emoji, room.isEvent, room.roastMode, room.coverUrl]);

  const shuffleCover = () => {
    haptic('light');
    setCover(photoUrl(`${room.code}-${Math.floor(Math.random() * 9999)}`, 800, 600));
  };

  return (
    <>
      <BottomSheet open={open} onClose={onClose} label="Room settings">
        <h2 className="t-h2 sheet__title">Room settings</h2>

        <div className="settings-cover" data-mood={kind}>
          <img src={cover || coverFor(kind, room.code)} alt="" />
          <span className="settings-cover__scrim" aria-hidden />
          <span className="settings-cover__emoji">{emoji}</span>
          <button type="button" className="settings-cover__shuffle" onClick={shuffleCover}>
            🔀 New cover
          </button>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="room-rename">
            Room name
          </label>
          <input
            id="room-rename"
            className="input"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field">
          <span className="field__label">Vibe</span>
          <div className="mood-row">
            {ROOM_MOODS.map((option) => (
              <motion.button
                key={option.kind}
                type="button"
                className="mood-chip"
                data-mood={option.kind}
                data-selected={option.kind === kind}
                onClick={() => {
                  haptic('light');
                  setKind(option.kind);
                  setEmoji(option.emoji);
                  setCover(coverFor(option.kind, room.code));
                }}
                whileTap={{ scale: 0.94 }}
                transition={spring.pop}
                aria-label={option.label}
              >
                <span>{option.emoji}</span>
                <b>{option.label}</b>
              </motion.button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="toggle-row"
          role="switch"
          aria-checked={isEvent}
          onClick={() => {
            haptic('light');
            setIsEvent((v) => !v);
          }}
        >
          <span className="stack toggle-row__text">
            <span className="t-body-strong">Event mode 🎉</span>
            <span className="t-xs muted">
              Louder room: a live banner, people counts and a livelier feed
            </span>
          </span>
          <span className="toggle" data-on={isEvent}>
            <motion.span className="toggle__knob" layout transition={spring.bouncy} />
          </span>
        </button>

        <button
          type="button"
          className="toggle-row"
          role="switch"
          aria-checked={roastMode}
          onClick={() => {
            haptic('light');
            setRoastMode((v) => !v);
          }}
        >
          <span className="stack toggle-row__text">
            <span className="t-body-strong">Roast mode 🔥</span>
            <span className="t-xs muted">
              Let the room pile on a moment — post roasts, upvote the best, crown a champion
            </span>
          </span>
          <span className="toggle" data-on={roastMode}>
            <motion.span className="toggle__knob" layout transition={spring.bouncy} />
          </span>
        </button>

        <div className="field">
          <span className="field__label">Members</span>
          <div className="manage-list">
            {members.map((member) => (
              <div key={String(member.id)} className="manage-row">
                <Avatar name={member.displayName} src={member.avatarUrl} size={34} />
                <span className="truncate">{member.displayName}</span>
                {member.personId === room.ownerId ? (
                  <span className="pill pill--accent">owner</span>
                ) : (
                  <button
                    type="button"
                    className="manage-row__remove t-xs"
                    onClick={() => onRemoveMember(member)}
                    aria-label={`Remove ${member.displayName} from the room`}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <motion.button
          className="btn btn--primary btn--block"
          onClick={() => onSave({ name, emoji, kind, coverUrl: cover, isEvent, roastMode })}
          disabled={!name.trim()}
          {...pressable}
        >
          Save changes
        </motion.button>

        <button
          type="button"
          className="danger-link"
          onClick={() => setConfirmDelete(true)}
        >
          Delete this room
        </button>
      </BottomSheet>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        label="Delete this room"
      >
        <h2 className="t-h2">Delete {room.name}?</h2>
        <p className="t-sm muted modal__body">
          Every moment, message, voice note and photo in here goes with it, for
          everyone. This can't be undone.
        </p>
        <div className="modal__actions">
          <motion.button
            className="btn btn--soft btn--block"
            onClick={() => setConfirmDelete(false)}
            {...pressable}
          >
            Keep it
          </motion.button>
          <motion.button
            className="btn btn--block btn--danger"
            onClick={() => {
              setConfirmDelete(false);
              onDelete();
            }}
            {...pressable}
          >
            Delete room
          </motion.button>
        </div>
      </Modal>
    </>
  );
}

/* --------------------------------------------------------------- Search --- */

export function RoomSearch({
  open,
  onClose,
  results,
  query,
  onQuery,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  query: string;
  onQuery: (value: string) => void;
  results: Array<{ id: string; who: string; avatarUrl?: string; text: string; when: string }>;
  onPick: (id: string) => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} label="Search this room">
      <h2 className="t-h2 sheet__title">Search this room</h2>
      <input
        className="input"
        placeholder="A word, a name, anything"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        autoFocus
        aria-label="Search messages and moments"
      />
      {query.trim().length === 0 ? (
        <p className="t-sm muted">Moments and messages, all the way back.</p>
      ) : results.length === 0 ? (
        <p className="t-sm muted">Nothing matched “{query.trim()}”.</p>
      ) : (
        <ul className="search-results">
          {results.map((result) => (
            <li key={result.id}>
              <button type="button" className="search-result" onClick={() => onPick(result.id)}>
                <Avatar name={result.who} src={result.avatarUrl} size={30} />
                <span className="search-result__text">
                  <b>{result.who}</b>
                  <span className="truncate">{result.text}</span>
                </span>
                <span className="t-micro faint">{result.when}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </BottomSheet>
  );
}
