/**
 * The room card.
 *
 * The most-looked-at object in the app, so it earns real estate: the room's own
 * mood colour up top, its people as faces, and the last thing anyone shared as a
 * full-width photograph. Rooms differ by accent, cover and emoji — never by
 * layout, so a list of six still reads as one system.
 */
import { memo } from 'react';
import { motion } from 'framer-motion';
import { Avatar, AvatarStack } from './Avatar';
import { itemVariants, pressableCard } from '../design/motion';
import { firstName, memberSummary, shortTimeAgo } from '../lib/format';
import { coverFor, moodFor } from '../lib/rooms';
import type { RoomSummary } from '../data/useRooms';
import { useNow } from '../data/useNow';
import { debug } from '../lib/log';

interface Props {
  summary: RoomSummary;
  onOpen: () => void;
}

export const RoomCard = memo(function RoomCard({ summary, onOpen }: Props) {
  const now = useNow(30_000);
  const { room, members, others, activeCount, latest, latestAuthor } = summary;
  const mood = moodFor(room.kind);
  const preview = summary.latestMediaUrl || room.coverUrl || coverFor(room.kind, room.code);
  const liveNames = members.filter((m) => m.status === 'online').slice(0, 2);

  return (
    <motion.button
      type="button"
      className="room-card"
      data-mood={room.kind}
      variants={itemVariants}
      onClick={onOpen}
      {...pressableCard}
    >
      <div className="room-card__head">
        <div className="room-card__heading">
          <h3 className="t-h2 truncate">
            {room.name} <span className="room-card__emoji">{room.emoji || mood.emoji}</span>
          </h3>
          <p className="t-xs muted">{memberSummary(members.length, activeCount)}</p>
        </div>

        <AvatarStack
          people={others.map((m) => ({
            id: String(m.id),
            name: m.displayName,
            avatarUrl: m.avatarUrl,
          }))}
          size={28}
          max={4}
        />
      </div>

      <div className="room-card__media">
        <img
          src={preview}
          alt=""
          loading="lazy"
          onError={() =>
            debug('media', 'RoomCard preview failed', {
              room: room.code,
              scheme: preview.slice(0, preview.indexOf(',') + 1) || preview.slice(0, 24),
              len: preview.length,
              fromLatestMedia: preview === summary.latestMediaUrl,
            })
          }
        />
        <span className="room-card__scrim" aria-hidden />

        {activeCount > 0 && (
          <span className="pill pill--glass room-card__live">
            <span className="dot-live" />
            {activeCount} active
          </span>
        )}

        {latest ? (
          <div className="room-card__foot">
            <Avatar
              name={latestAuthor?.displayName ?? 'Someone'}
              src={latestAuthor?.avatarUrl}
              size={26}
            />
            <span className="room-card__note truncate">
              {latestAuthor
                ? `${firstName(latestAuthor.displayName)} just posted`
                : 'New moment'}
            </span>
            <span className="room-card__time">{shortTimeAgo(latest.createdAt, now)}</span>
          </div>
        ) : (
          <div className="room-card__foot">
            <span className="room-card__note truncate">
              {liveNames.length > 0
                ? `${liveNames.map((m) => firstName(m.displayName)).join(' & ')} ${
                    liveNames.length > 1 ? 'are' : 'is'
                  } around`
                : 'Nothing shared yet'}
            </span>
          </div>
        )}
      </div>
    </motion.button>
  );
});
