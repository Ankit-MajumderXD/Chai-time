/**
 * Profile.
 *
 * Deliberately small: a face, three numbers that mean something to you rather
 * than to an algorithm, your own recent photos, and the settings you'd actually
 * open. No follower count anywhere.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Ambient } from '../components/AmbientLazy';
import { Avatar } from '../components/Avatar';
import { AvatarPicker } from '../components/AvatarPicker';
import { StreakFlame } from '../components/StreakFlame';
import { MediaGallery } from '../components/MediaGallery';
import { MediaViewer, type ViewerItem } from '../components/MediaViewer';
import { BottomSheet } from '../components/Overlay';
import { EmptyState } from '../components/Feedback';
import { useToast } from '../components/Toast';
import { itemVariants, listVariants, pressable, spring } from '../design/motion';
import { handleFrom } from '../lib/format';
import { haptic } from '../lib/haptics';
import { useRouter } from '../lib/router';
import { useSession } from '../data/useSession';
import { useRooms } from '../data/useRooms';
import { useMyBadges } from '../data/useBadges';
import { call, useConn } from '../data/db';
import { useTable } from 'spacetimedb/react';
import { tables } from '../module_bindings';
import { BADGE_ORDER, BADGES } from '../lib/badges';


export function Profile() {
  const { go } = useRouter();
  const conn = useConn();
  const toast = useToast();
  const { me } = useSession();
  const { rooms, people } = useRooms();
  const { earned } = useMyBadges();
  const [allMoments] = useTable(tables.moment);
  const [allMembers] = useTable(tables.roomMember);
  const [allMedia] = useTable(tables.media);

  // Streaks live on the room membership; a person's headline streak is their
  // hottest room right now.
  const streak = useMemo(() => {
    const mine = me ? allMembers.filter((m) => m.personId === me.id) : [];
    return {
      current: mine.reduce((n, m) => Math.max(n, m.currentStreak), 0),
      longest: mine.reduce((n, m) => Math.max(n, m.longestStreak), 0),
    };
  }, [allMembers, me]);
  const [editing, setEditing] = useState(false);
  const [viewerKey, setViewerKey] = useState<string | null>(null);

  const myMemberIds = useMemo(
    () =>
      new Set(
        allMembers.filter((m) => me && m.personId === me.id).map((m) => String(m.id))
      ),
    [allMembers, me]
  );

  const myMoments = useMemo(
    () =>
      [...allMoments]
        .filter((m) => myMemberIds.has(String(m.memberId)))
        .sort((a, b) =>
          Number(b.createdAt.microsSinceUnixEpoch - a.createdAt.microsSinceUnixEpoch)
        ),
    [allMoments, myMemberIds]
  );

  // My own media across every room, newest first.
  const myMedia = useMemo(() => {
    const byId = new Map(allMedia.map((m) => [m.id, m]));
    return myMoments
      .map((moment) => byId.get(moment.mediaId))
      .filter((item): item is NonNullable<typeof item> => !!item && !!item.url);
  }, [myMoments, allMedia]);

  const viewerItems: ViewerItem[] = useMemo(
    () =>
      myMedia.map((item) => {
        const moment = myMoments.find((m) => m.mediaId === item.id);
        return {
          key: `m${item.id}`,
          media: item,
          authorName: me?.displayName ?? 'You',
          authorAvatar: me?.avatarUrl,
          caption: moment?.caption ?? '',
          createdAtMillis: Number(item.createdAt.microsSinceUnixEpoch / 1000n),
        };
      }),
    [myMedia, myMoments, me]
  );

  return (
    <div className="screen profile-screen">
      <div className="profile-hero">
        <Ambient intensity={0.5} />

        <motion.div
          className="profile-hero__inner"
          variants={listVariants}
          initial="initial"
          animate="animate"
        >
          <motion.div variants={itemVariants}>
            <Avatar
              name={me?.displayName ?? 'You'}
              src={me?.avatarUrl}
              size={96}
              presence="online"
              ring
            />
          </motion.div>

          <motion.h1 className="t-h1" variants={itemVariants}>
            {me?.displayName ?? 'You'}
          </motion.h1>
          <motion.p className="t-sm muted" variants={itemVariants}>
            @{me?.handle || handleFrom(me?.displayName ?? 'you')}
          </motion.p>
          <motion.p className="t-sm profile-hero__bio" variants={itemVariants}>
            {me?.bio || 'Building moments with my people ✨'}
          </motion.p>

          {streak.current > 0 && (
            <motion.div className="profile-streak" variants={itemVariants}>
              <StreakFlame count={streak.current} best={streak.longest} size={26} />
              <span className="t-sm muted">
                day streak{streak.longest > streak.current ? ` · best ${streak.longest}` : ''}
              </span>
            </motion.div>
          )}

          <motion.div className="stats" variants={itemVariants}>
            <Stat value={rooms.length} label={rooms.length === 1 ? 'Room' : 'Rooms'} />
            <Stat value={myMoments.length} label="Moments" />
            <Stat value={people.length} label={people.length === 1 ? 'Friend' : 'Friends'} />
          </motion.div>
        </motion.div>
      </div>

      <section className="section gutter">
        <div className="section-head">
          <h2 className="t-h3">Badges</h2>
          <span className="t-xs faint">
            {earned.length} of {BADGE_ORDER.length}
          </span>
        </div>
        <div className="badge-shelf">
          {BADGE_ORDER.map((type) => {
            const meta = BADGES[type];
            const got = earned.find((e) => e.badge.badgeType === type);
            return (
              <motion.div
                key={type}
                className="badge-chip"
                data-earned={!!got}
                style={{ ['--badge-hue' as string]: meta.hue }}
                whileHover={got ? { y: -3 } : undefined}
                transition={spring.snappy}
                title={meta.blurb}
              >
                <span className="badge-chip__glyph">{meta.emoji}</span>
                <span className="badge-chip__label">{meta.label}</span>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="t-h3">Your moments</h2>
          {myMoments.length > 0 && (
            <span className="t-xs faint">{myMoments.length} shared</span>
          )}
        </div>

        <div className="gutter">
          {myMoments.length === 0 ? (
            <EmptyState
              compact
              art={<span className="empty__emoji">📸</span>}
              title="Nothing shared yet."
              body="Capture something small. That's the whole point."
              action={{ label: 'Capture', onClick: () => go({ name: 'camera' }) }}
            />
          ) : (
            <MediaGallery
              items={myMedia}
              onOpen={(item) => setViewerKey(`m${item.id}`)}
              emptyLabel="Nothing shared yet."
            />
          )}
        </div>
      </section>

      <section className="section gutter">
        <div className="settings-list">
          <SettingsRow icon="✏️" label="Edit profile" onClick={() => setEditing(true)} />
          <SettingsRow
            icon="🔔"
            label="Notifications"
            onClick={() => go({ name: 'settings' })}
          />
          <SettingsRow icon="🔒" label="Privacy" onClick={() => go({ name: 'settings' })} />
          <SettingsRow icon="💬" label="Help & support" onClick={() => go({ name: 'settings' })} />
        </div>
      </section>

      <EditProfileSheet
        open={editing}
        onClose={() => setEditing(false)}
        onSave={async (displayName, bio, avatarUrl) => {
          const ok = await call(
            conn?.reducers.saveProfile({
              displayName,
              handle: me?.handle || handleFrom(displayName),
              avatarUrl,
              bio,
            }),
            (message) => toast({ message, tone: 'error' })
          );
          if (ok) {
            toast({ message: 'Profile updated', emoji: '✨' });
            setEditing(false);
          }
        }}
        initial={{
          displayName: me?.displayName ?? '',
          bio: me?.bio ?? '',
          avatarUrl: me?.avatarUrl ?? '',
        }}
      />

      <MediaViewer
        items={viewerItems}
        startKey={viewerKey}
        onClose={() => setViewerKey(null)}
        onReact={() => {}}
      />
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="stat">
      <motion.span
        className="stat__value"
        key={value}
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={spring.gentle}
      >
        {value}
      </motion.span>
      <span className="stat__label">{label}</span>
    </div>
  );
}

function SettingsRow({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      className="settings-row"
      onClick={() => {
        haptic('light');
        onClick();
      }}
      whileTap={{ scale: 0.99 }}
      transition={spring.snappy}
    >
      <span className="settings-row__icon">{icon}</span>
      <span className="t-body-strong">{label}</span>
      <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden className="settings-row__chev">
        <path
          d="m9.5 5.5 6.5 6.5-6.5 6.5"
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

function EditProfileSheet({
  open,
  onClose,
  onSave,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (displayName: string, bio: string, avatarUrl: string) => void;
  initial: { displayName: string; bio: string; avatarUrl: string };
}) {
  const [name, setName] = useState(initial.displayName);
  const [bio, setBio] = useState(initial.bio);
  const [avatar, setAvatar] = useState(initial.avatarUrl);

  // The profile row may land after this sheet mounts; refill the fields each
  // time it opens so it always starts from what's actually saved.
  useEffect(() => {
    if (!open) return;
    setName(initial.displayName);
    setBio(initial.bio);
    setAvatar(initial.avatarUrl);
  }, [open, initial.displayName, initial.bio, initial.avatarUrl]);

  return (
    <BottomSheet open={open} onClose={onClose} label="Edit profile">
      <h2 className="t-h2 sheet__title">Edit profile</h2>

      <AvatarPicker name={name} value={avatar} onChange={setAvatar} />



      <div className="field">
        <label className="field__label" htmlFor="edit-name">
          Name
        </label>
        <input
          id="edit-name"
          className="input"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="edit-bio">
          Bio
        </label>
        <textarea
          id="edit-bio"
          className="input"
          value={bio}
          maxLength={140}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Say something short and true"
        />
      </div>

      <motion.button
        className="btn btn--primary btn--block"
        onClick={() => onSave(name.trim(), bio.trim(), avatar)}
        disabled={!name.trim()}
        {...pressable}
      >
        Save changes
      </motion.button>
    </BottomSheet>
  );
}
