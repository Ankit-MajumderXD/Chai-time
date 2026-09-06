/**
 * Members / Activity / Media — the room's people, in detail.
 *
 * Same data as the Live now rail upstairs, given room to breathe: who is here,
 * what they're doing, when they were last around.
 */
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TopBar, Segmented } from '../components/TopBar';
import { ActivityRow } from '../components/LiveNow';
import { MediaGallery } from '../components/MediaGallery';
import { MediaViewer, type ViewerItem } from '../components/MediaViewer';
import { EmptyState } from '../components/Feedback';
import { listVariants, pressable } from '../design/motion';
import { firstName, memberSummary, timeAgo, toMillis } from '../lib/format';
import { useRouter } from '../lib/router';
import { useRoom } from '../data/useRoom';
import { useNow } from '../data/useNow';
import { call, useConn } from '../data/db';

type Tab = 'members' | 'activity' | 'media';

export function Members({ code }: { code: string }) {
  const { back, go } = useRouter();
  const room = useRoom(code);
  const conn = useConn();
  const now = useNow(30_000);
  const [tab, setTab] = useState<Tab>('members');

  // The viewer walks the whole room gallery; moment media keeps its reactions.
  const viewerItems: ViewerItem[] = useMemo(() => {
    const byMoment = new Map(
      room.moments.filter((v) => v.media).map((v) => [v.media!.id, v])
    );
    return room.gallery.map((item) => {
      const owner = byMoment.get(item.id);
      const author = room.members.find((m) => m.id === item.memberId);
      return {
        key: `m${item.id}`,
        media: item,
        authorName: author?.displayName ?? 'Someone',
        authorAvatar: author?.avatarUrl,
        caption: owner?.moment.caption ?? '',
        createdAtMillis: toMillis(item.createdAt),
        momentId: owner?.moment.id,
        reactions: owner?.reactions,
      };
    });
  }, [room.gallery, room.moments, room.members]);
  const [viewerKey, setViewerKey] = useState<string | null>(null);

  if (!room.room) {
    return (
      <div className="screen">
        <TopBar title="Members" onBack={back} />
        <EmptyState
          art={<span className="empty__emoji">🫥</span>}
          title="That room isn't here."
          body="It may have been closed, or the link is out of date."
          action={{ label: 'Back to your rooms', onClick: () => go({ name: 'rooms' }) }}
        />
      </div>
    );
  }

  return (
    <div className="screen members-screen" data-mood={room.room.kind}>
      <TopBar
        title={`${room.room.name} ${room.room.emoji}`}
        subtitle={memberSummary(room.members.length, room.activeCount)}
        onBack={back}
        actions={
          <motion.button
            type="button"
            className="icon-btn"
            aria-label="Invite people"
            onClick={() => go({ name: 'invite', code })}
            {...pressable}
          >
            <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden>
              <path
                d="M12 5.6v12.8M5.6 12h12.8"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
              />
            </svg>
          </motion.button>
        }
      />

      <div className="gutter">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'members', label: 'Members', count: room.members.length },
            { value: 'activity', label: 'Activity' },
            { value: 'media', label: 'Media', count: room.gallery.length },
          ]}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {tab === 'members' && (
          <motion.div
            key="members"
            className="gutter member-list"
            variants={listVariants}
            initial="initial"
            animate="animate"
            exit={{ opacity: 0, y: -8 }}
          >
            {room.members.map((member) => (
              <ActivityRow
                key={String(member.id)}
                member={member}
                isMe={member.id === room.me?.id}
              />
            ))}

            {room.isMember && (
              <motion.button
                className="btn btn--soft btn--block member-list__invite"
                onClick={() => go({ name: 'invite', code })}
                {...pressable}
              >
                ✨ Bring more people in
              </motion.button>
            )}
          </motion.div>
        )}

        {tab === 'activity' && (
          <motion.div
            key="activity"
            className="gutter"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            {room.events.length === 0 ? (
              <EmptyState
                compact
                art={<span className="empty__emoji">🌱</span>}
                title="Nothing has happened yet."
                body="Joins, moments and comings-and-goings show up here."
              />
            ) : (
              <ul className="timeline">
                {room.events.slice(0, 30).map((event) => (
                  <li key={String(event.id)} className="timeline__row">
                    <span className="timeline__dot" data-kind={event.kind} />
                    <span className="timeline__text truncate">{event.text}</span>
                    <span className="t-micro faint">{timeAgo(event.createdAt, now)}</span>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}

        {tab === 'media' && (
          <motion.div
            key="media"
            className="gutter"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <MediaGallery
              items={room.gallery}
              onOpen={(item) => setViewerKey(`m${item.id}`)}
              emptyLabel="Nothing shared in this room yet."
            />
          </motion.div>
        )}
      </AnimatePresence>

      {room.me && room.members.length > 1 && tab === 'members' && (
        <p className="t-xs faint gutter members-screen__hint">
          {firstName(room.members.find((m) => m.id !== room.me?.id)?.displayName ?? 'They')} and{' '}
          {room.members.length - 2 > 0 ? `${room.members.length - 2} others ` : ''}can see when
          you're around. Nobody outside this room can.
        </p>
      )}

      <MediaViewer
        items={viewerItems}
        startKey={viewerKey}
        onClose={() => setViewerKey(null)}
        onReact={(momentId, emoji) =>
          void call(conn?.reducers.toggleReaction({ momentId, emoji }))
        }
      />
    </div>
  );
}
