/**
 * The room — the screen the whole product is built around.
 *
 * Three tabs in the order the hierarchy demands: people, then what they shared,
 * then what they said. Voice sits across the top of Live because it is the
 * loudest way to be together. The composer is always within thumb reach on the
 * two tabs where you'd want it.
 *
 * Nothing here polls. Presence, moments, messages, reactions, typing and the
 * voice roster are all live tables — a change on someone else's phone is
 * already a re-render on yours.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RoomHeader, Segmented } from '../components/TopBar';
import { LiveTab } from '../components/LiveTab';
import { ChatTab } from '../components/ChatTab';
import { Composer, TypingHint } from '../components/Composer';
import { MomentCard } from '../components/MomentCard';
import { MediaViewer, type ViewerItem } from '../components/MediaViewer';
import { VoiceRoom } from '../components/VoiceRoom';
import { RoomMenu, RoomSettings, RoomSearch } from '../components/RoomMenu';
import { RoastSheet } from '../components/RoastSheet';
import { RoastLeaderboard } from '../components/RoastLeaderboard';
import { RoastReactionSheet } from '../components/RoastReactionSheet';
import { PromptCard } from '../components/PromptCard';
import { PromptSettingsSheet } from '../components/PromptSettingsSheet';
import { ReplayRoom } from '../components/ReplayRoom';
import { EmptyState, MomentsSkeleton, ErrorState } from '../components/Feedback';
import { useToast } from '../components/Toast';
import { listVariants, pressable, spring } from '../design/motion';
import { firstName, memberSummary, timeAgo, toMillis } from '../lib/format';
import { moodFor } from '../lib/rooms';
import { haptic } from '../lib/haptics';
import { NO_MEDIA, prepareFile, stillUrl, tooBig, type MediaRef } from '../lib/upload';
import { useRouter } from '../lib/router';
import { useRoom } from '../data/useRoom';
import { useReplay } from '../data/useReplay';
import { useRoasts } from '../data/useRoasts';
import { useRoastReactions } from '../data/useRoastReactions';
import { useRoomPrompt } from '../data/usePrompts';
import { useVoice } from '../data/useVoice';
import type { Heat, RoastStyle } from '../lib/roastLines';
import { useTypingPing, useViewingRoom } from '../data/usePresence';
import { call, useConn } from '../data/db';
import { useNow } from '../data/useNow';
import type { RoomEvent, RoomMember } from '../module_bindings/types';

type Tab = 'live' | 'moments' | 'chat';

const MUTE_KEY = 'chai-time/muted-rooms';

export function Room({ code }: { code: string }) {
  const { go, back } = useRouter();
  const conn = useConn();
  const toast = useToast();
  const room = useRoom(code);
  const now = useNow(30_000);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<Tab>('live');
  const [viewerKey, setViewerKey] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [settings, setSettings] = useState(false);
  const [promptSettings, setPromptSettings] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<bigint | null>(null);
  const [roastMomentId, setRoastMomentId] = useState<bigint | null>(null);
  const [fireMomentId, setFireMomentId] = useState<bigint | null>(null);
  const [fireBurst, setFireBurst] = useState<{
    momentId: bigint;
    style: RoastStyle;
    heat: Heat;
    nonce: number;
  } | null>(null);
  const [muted, setMuted] = useState(() => readMuted().includes(code));

  const roomId = room.room?.id;
  const controls = useVoice(roomId, room.me?.id, room.voice);
  const roastMode = !!room.room?.roastMode;
  const roasts = useRoasts(roomId, room.members, room.me?.id);
  // momentId → still image, so the roast leaderboard can show each moment.
  const roastThumbs = useMemo(() => {
    const map = new Map<bigint, string>();
    for (const v of room.moments) {
      map.set(v.moment.id, v.media ? stillUrl(v.media) : '');
    }
    return map;
  }, [room.moments]);
  const roastReactions = useRoastReactions(room.members, room.me?.id);
  const roomPrompt = useRoomPrompt(roomId);
  const replay = useReplay(room);
  const [replayOpen, setReplayOpen] = useState(false);

  useViewingRoom(roomId, room.isMember);
  const ping = useTypingPing(roomId);
  useLiveEvents(room.events, room.me?.id, room.members, muted);

  // Leaving the screen should never leave you stuck in a voice room.
  useEffect(() => {
    if (!room.voice.iAmIn) setVoiceOpen(false);
  }, [room.voice.iAmIn]);

  const mood = room.room ? moodFor(room.room.kind) : moodFor('other');

  /* ---- writes ----------------------------------------------------------- */

  const fail = (message: string) => toast({ message, tone: 'error', emoji: '⚠️' });

  const react = (momentId: bigint, emoji: string) =>
    void call(conn?.reducers.toggleReaction({ momentId, emoji }), fail);

  const postRoast = (momentId: bigint, text: string) =>
    call(conn?.reducers.postRoast({ momentId, text }), fail);

  const voteRoast = (roastId: bigint, voted: boolean) =>
    void call(
      voted
        ? conn?.reducers.voteRoast({ roastId })
        : conn?.reducers.unvoteRoast({ roastId }),
      fail
    );

  const deleteRoast = (roastId: bigint) =>
    void call(conn?.reducers.deleteRoast({ roastId }), fail);

  const sendFireReaction = (
    momentId: bigint,
    lineId: bigint,
    customText: string,
    heat: Heat,
    style: RoastStyle
  ) => {
    setFireBurst({ momentId, style, heat, nonce: Date.now() });
    void call(
      conn?.reducers.sendRoastReaction({ momentId, lineId, customText, heatLevel: heat, style }),
      fail
    );
  };

  const respondToPrompt = () => {
    if (roomId !== undefined) void call(conn?.reducers.dismissRoomPrompt({ roomId }));
    go({ name: 'camera', code });
  };
  const dismissPrompt = () => {
    if (roomId !== undefined) void call(conn?.reducers.dismissRoomPrompt({ roomId }), fail);
  };

  const send = (kind: string, text: string, media: MediaRef = NO_MEDIA) => {
    if (roomId === undefined) return;
    if (tooBig(media)) {
      fail('That file is a bit heavy — try a shorter or smaller one.');
      return;
    }
    void call(
      conn?.reducers.sendMessage({
        roomId,
        kind,
        text,
        momentId: replyTo ?? 0n,
        mediaUrl: media.url,
        posterUrl: media.posterUrl,
        mimeType: media.mimeType,
        width: media.width,
        height: media.height,
        durationMs: media.durationMs,
        sizeBytes: media.sizeBytes,
        waveform: media.waveform,
      }),
      fail
    );
    setReplyTo(null);
    if (tab !== 'chat') setTab('chat');
  };

  const sendFile = async (file: File) => {
    try {
      const media = await prepareFile(file);
      send(media.kind === 'video' ? 'video' : 'photo', '', media);
    } catch (err: any) {
      fail(err?.message ?? "That file didn't work — try another.");
    }
  };

  const setActivity = (activityEmoji: string, activity: string) =>
    void call(conn?.reducers.setActivity({ activity, activityEmoji, status: 'online' }), fail);

  const shareLink = async () => {
    const url = `${window.location.origin}/join/${code}`;
    try {
      if (navigator.share) await navigator.share({ title: room.room?.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast({ message: 'Invite link copied', emoji: '🔗' });
      }
    } catch {
      /* share sheet dismissed */
    }
    setMenu(false);
  };

  const leave = async () => {
    setMenu(false);
    if (roomId === undefined) return;
    if (room.voice.iAmIn) await controls.leave();
    const ok = await call(conn?.reducers.leaveRoom({ roomId }), fail);
    if (ok) go({ name: 'rooms' });
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    writeMuted(code, next);
    toast({
      message: next ? 'Notifications muted for this room' : 'Notifications back on',
      emoji: next ? '🔕' : '🔔',
    });
    setMenu(false);
  };

  /* ---- viewer items ----------------------------------------------------- */

  // One flat list for the viewer, so swiping crosses moments and chat media
  // alike. Moment media keeps its reactions; chat media doesn't have any.
  const viewerItems: ViewerItem[] = useMemo(() => {
    const byMediaId = new Map<bigint, ViewerItem>();
    for (const view of room.moments) {
      if (!view.media) continue;
      byMediaId.set(view.media.id, {
        key: `m${view.media.id}`,
        media: view.media,
        authorName: view.author?.displayName ?? 'Someone',
        authorAvatar: view.author?.avatarUrl,
        caption: view.moment.caption,
        createdAtMillis: toMillis(view.moment.createdAt),
        momentId: view.moment.id,
        reactions: view.reactions,
      });
    }
    for (const view of room.messages) {
      if (!view.media || byMediaId.has(view.media.id)) continue;
      byMediaId.set(view.media.id, {
        key: `m${view.media.id}`,
        media: view.media,
        authorName: view.author?.displayName ?? 'Someone',
        authorAvatar: view.author?.avatarUrl,
        caption: view.message.text,
        createdAtMillis: toMillis(view.message.createdAt),
      });
    }
    return [...byMediaId.values()].sort((a, b) => b.createdAtMillis - a.createdAtMillis);
  }, [room.moments, room.messages]);

  /* ---- search ----------------------------------------------------------- */

  const searchResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    const hits: Array<{ id: string; who: string; avatarUrl?: string; text: string; when: string }> =
      [];

    for (const view of room.moments) {
      if (view.moment.caption.toLowerCase().includes(needle)) {
        hits.push({
          id: `moment:${view.moment.id}`,
          who: view.author?.displayName ?? 'Someone',
          avatarUrl: view.author?.avatarUrl,
          text: view.moment.caption,
          when: timeAgo(view.moment.createdAt, now),
        });
      }
    }
    for (const view of room.messages) {
      if (view.message.text.toLowerCase().includes(needle)) {
        hits.push({
          id: `message:${view.message.id}`,
          who: view.author?.displayName ?? 'Someone',
          avatarUrl: view.author?.avatarUrl,
          text: view.message.text,
          when: timeAgo(view.message.createdAt, now),
        });
      }
    }
    return hits.slice(0, 30);
  }, [query, room.moments, room.messages, now]);

  /* ---- render ----------------------------------------------------------- */

  if (!room.ready) {
    return (
      <div className="screen">
        <div style={{ height: 'calc(var(--safe-top) + 120px)' }} />
        <MomentsSkeleton />
      </div>
    );
  }

  if (room.notFound || !room.room) {
    return (
      <div className="screen">
        <ErrorState
          title="We couldn't find that room."
          body="The link may have expired, or the code has a typo."
          onRetry={() => go({ name: 'rooms' })}
        />
      </div>
    );
  }

  const typingNames = room.typing.map((m) => firstName(m.displayName));
  // The composer owns the bottom edge on every tab now that the app's bottom
  // nav is hidden inside a room — it's the only thing down there, and it's how
  // you drop a line or open the camera from wherever you are.
  const showComposer = room.isMember;
  const replyingToMoment =
    replyTo === null ? undefined : room.moments.find((v) => v.moment.id === replyTo);

  return (
    <div className="screen screen--flush room-screen" data-mood={room.room.kind}>
      <RoomHeader
        emoji={room.room.emoji || mood.emoji}
        name={room.room.name}
        summary={memberSummary(room.members.length, room.activeCount)}
        mood={room.room.kind}
        isEvent={room.room.isEvent}
        onBack={back}
        onMembers={() => go({ name: 'members', code })}
        onMore={() => setMenu(true)}
        scrollRef={scrollRef as React.RefObject<HTMLElement>}
      >
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'live', label: 'Live', count: room.activeCount },
            { value: 'moments', label: 'Moments', count: room.moments.length },
            { value: 'chat', label: 'Chat', count: room.messages.length },
          ]}
        />
      </RoomHeader>

      <div className="room-scroll" data-composer={showComposer} ref={scrollRef}>
        {!room.isMember && (
          <motion.div
            className="gutter join-strip"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div>
              <p className="t-body-strong">You're peeking in</p>
              <p className="t-sm muted">Join to share, react and talk.</p>
            </div>
            <motion.button
              className="btn btn--primary btn--sm"
              onClick={async () => {
                haptic('medium');
                const ok = await call(conn?.reducers.joinRoom({ code }), fail);
                if (ok) toast({ message: `You're in ${room.room?.name}`, emoji: '🎉' });
              }}
              {...pressable}
            >
              Join room
            </motion.button>
          </motion.div>
        )}

        <AnimatePresence>
          {room.isMember && replay.hasReplay && replay.unseen > 0 && (
            <motion.div
              className="gutter"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <motion.button
                type="button"
                className="replay-cta"
                onClick={() => {
                  haptic('medium');
                  setReplayOpen(true);
                }}
                whileTap={{ scale: 0.97 }}
                transition={spring.snappy}
              >
                <span className="replay-cta__play">▶</span>
                <span className="replay-cta__text">
                  <b>Replay the room</b>
                  <span className="t-xs">
                    You missed {replay.unseen} thing{replay.unseen === 1 ? '' : 's'} — watch it back
                  </span>
                </span>
                <span className="replay-cta__glow" aria-hidden />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {room.isMember && roomPrompt.live && (
            <div className="gutter">
              <PromptCard
                prompt={roomPrompt.live}
                onRespond={respondToPrompt}
                onDismiss={dismissPrompt}
              />
            </div>
          )}
        </AnimatePresence>

        {/* popLayout, not "wait": a "wait" AnimatePresence that has its exit
            animation interrupted — e.g. the tab is backgrounded mid-transition,
            freezing the frame loop — can fail to fire onExitComplete and then
            never mount the incoming tab, which reads as the app being stuck.
            popLayout always mounts the new tab immediately. (Same reasoning as
            ScreenSwap — see DESIGN-SYSTEM.md.) */}
        <AnimatePresence mode="popLayout" initial={false}>
          {tab === 'live' && (
            <motion.div
              key="live"
              className="gutter"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <LiveTab
                members={room.members}
                me={room.me}
                viewing={room.viewing}
                voice={room.voice}
                titles={room.titles}
                isEvent={room.room.isEvent}
                momentCount={room.moments.length}
                onSetActivity={setActivity}
                onOpenVoice={async () => {
                  if (!room.voice.iAmIn) await controls.join();
                  setVoiceOpen(true);
                }}
                onStartVoice={async () => {
                  await controls.start();
                  setVoiceOpen(true);
                }}
                onInvite={() => go({ name: 'invite', code })}
              />
            </motion.div>
          )}

          {tab === 'moments' && (
            <motion.div
              key="moments"
              className="gutter feed"
              variants={listVariants}
              initial="initial"
              animate="animate"
              exit={{ opacity: 0, y: -8 }}
            >
              {roastMode && (
                <RoastLeaderboard
                  roasts={roasts.leaderboard}
                  thumbs={roastThumbs}
                  onOpen={(momentId) => setRoastMomentId(momentId)}
                />
              )}

              {room.moments.length === 0 ? (
                <EmptyState
                  art={<span className="empty__emoji">📷</span>}
                  title="Nothing here yet."
                  body="Capture what's happening — everyone in the room sees it the moment you post."
                  action={{ label: 'Capture', onClick: () => go({ name: 'camera', code }) }}
                />
              ) : (
                <AnimatePresence initial={false}>
                  {room.moments.map((view) => (
                    <MomentCard
                      key={String(view.moment.id)}
                      view={view}
                      roast={
                        roastMode
                          ? {
                              count: roasts.byMoment.get(view.moment.id)?.length ?? 0,
                              leadText: roasts.byMoment.get(view.moment.id)?.[0]?.roast.text,
                              onOpen: () => setRoastMomentId(view.moment.id),
                            }
                          : undefined
                      }
                      roastReactions={roastReactions.forMoment(view.moment.id)}
                      onRoastReact={() => setFireMomentId(view.moment.id)}
                      roastBurst={
                        fireBurst && fireBurst.momentId === view.moment.id
                          ? { style: fireBurst.style, heat: fireBurst.heat, nonce: fireBurst.nonce }
                          : undefined
                      }
                      onReact={(emoji) => react(view.moment.id, emoji)}
                      onReply={() => {
                        // Replies are messages, so this arms a quote and hands
                        // the conversation to Chat where it belongs.
                        haptic('light');
                        setReplyTo(view.moment.id);
                        setTab('chat');
                      }}
                      onOpen={() => view.media && setViewerKey(`m${view.media.id}`)}
                      onDelete={
                        view.isMine
                          ? () =>
                              void call(
                                conn?.reducers.deleteMoment({ momentId: view.moment.id }),
                                fail
                              )
                          : undefined
                      }
                    />
                  ))}
                </AnimatePresence>
              )}
            </motion.div>
          )}

          {tab === 'chat' && (
            <motion.div
              key="chat"
              className="gutter"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <ChatTab
                messages={room.messages}
                onOpenMedia={(mediaId) => setViewerKey(`m${mediaId}`)}
                onDelete={(messageId) =>
                  void call(conn?.reducers.deleteMessage({ messageId }), fail)
                }
                emptyAction={() => go({ name: 'camera', code })}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="room-scroll__tail" />
      </div>

      {showComposer && (
        <Composer
          placeholder={tab === 'chat' ? 'Say something…' : "What's happening?"}
          hint={typingNames.length > 0 ? <TypingHint names={typingNames} /> : undefined}
          quote={
            replyingToMoment
              ? {
                  label: replyingToMoment.moment.caption
                    ? `Replying to “${replyingToMoment.moment.caption.slice(0, 40)}”`
                    : `Replying to ${firstName(replyingToMoment.author?.displayName ?? 'them')}`,
                  onClear: () => setReplyTo(null),
                }
              : undefined
          }
          onSendText={(text) => send('text', text)}
          onSendVoice={(media) => send('voice', '', media)}
          onPickMedia={(file) => void sendFile(file)}
          onOpenCamera={() => go({ name: 'camera', code })}
          onTyping={ping}
          onError={fail}
        />
      )}

      <MediaViewer
        items={viewerItems}
        startKey={viewerKey}
        onClose={() => setViewerKey(null)}
        onReact={react}
      />

      <AnimatePresence>
        {replayOpen && room.room && (
          <ReplayRoom
            open={replayOpen}
            data={replay}
            roomName={room.room.name}
            roomEmoji={room.room.emoji || mood.emoji}
            mood={room.room.kind}
            onEnter={() => {
              setReplayOpen(false);
              if (roomId !== undefined) {
                void call(conn?.reducers.markRoomCaughtUp({ roomId }));
              }
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {voiceOpen && room.voice.live && (
          <VoiceRoom
            roomName={room.room.name}
            roomEmoji={room.room.emoji || mood.emoji}
            mood={room.room.kind}
            voice={room.voice}
            controls={controls}
            onClose={() => setVoiceOpen(false)}
            onInvite={() => {
              setVoiceOpen(false);
              go({ name: 'invite', code });
            }}
          />
        )}
      </AnimatePresence>

      <RoomMenu
        open={menu}
        onClose={() => setMenu(false)}
        room={room.room}
        members={room.members}
        activeCount={room.activeCount}
        isOwner={room.isOwner}
        muted={muted}
        onToggleMute={toggleMute}
        onShare={shareLink}
        onInvite={() => {
          setMenu(false);
          go({ name: 'invite', code });
        }}
        onMembers={() => {
          setMenu(false);
          go({ name: 'members', code });
        }}
        onMedia={() => {
          setMenu(false);
          go({ name: 'members', code });
        }}
        onSearch={() => {
          setMenu(false);
          setSearch(true);
        }}
        onSettings={() => {
          setMenu(false);
          setSettings(true);
        }}
        onPrompts={() => {
          setMenu(false);
          setPromptSettings(true);
        }}
        onLeave={leave}
      />

      {room.isOwner && roomId !== undefined && (
        <PromptSettingsSheet
          open={promptSettings}
          onClose={() => setPromptSettings(false)}
          state={roomPrompt}
          onSaveSchedule={(_localTimes, utcTimes, source, isActive) => {
            void call(
              conn?.reducers.setRoomPromptSchedule({
                roomId,
                times: utcTimes,
                source,
                isActive,
              }),
              fail
            );
            toast({
              message:
                utcTimes.length === 0
                  ? 'Prompt schedule cleared'
                  : isActive
                    ? `${utcTimes.length} prompt time${utcTimes.length === 1 ? '' : 's'} scheduled`
                    : 'Prompt schedule off',
              emoji: '🗣️',
            });
          }}
          onAddCustomPrompt={(text) =>
            void call(conn?.reducers.addCustomPrompt({ roomId, text }), fail)
          }
          onSendNow={(text, source) => {
            void call(conn?.reducers.triggerPromptCycle({ roomId, text, source }), fail);
            toast({ message: 'Prompt sent to the room', emoji: '🔥' });
          }}
        />
      )}

      {room.isOwner && (
        <RoomSettings
          open={settings}
          onClose={() => setSettings(false)}
          room={room.room}
          members={room.members}
          onSave={async (patch) => {
            if (roomId === undefined) return;
            const { roastMode, ...roomPatch } = patch;
            const ok = await call(conn?.reducers.updateRoom({ roomId, ...roomPatch }), fail);
            if (roastMode !== room.room?.roastMode) {
              await call(conn?.reducers.setRoastMode({ roomId, enabled: roastMode }), fail);
            }
            if (ok) {
              toast({ message: 'Room updated', emoji: '✨' });
              setSettings(false);
            }
          }}
          onRemoveMember={(member) =>
            void call(conn?.reducers.removeMember({ memberId: member.id }), fail)
          }
          onDelete={async () => {
            if (roomId === undefined) return;
            const ok = await call(conn?.reducers.deleteRoom({ roomId }), fail);
            if (ok) {
              setSettings(false);
              toast({ message: 'Room deleted', emoji: '🗑️' });
              go({ name: 'rooms' }, { replace: true });
            }
          }}
        />
      )}

      <RoomSearch
        open={search}
        onClose={() => {
          setSearch(false);
          setQuery('');
        }}
        query={query}
        onQuery={setQuery}
        results={searchResults}
        onPick={(id) => {
          setSearch(false);
          setQuery('');
          setTab(id.startsWith('moment') ? 'moments' : 'chat');
        }}
      />

      <RoastSheet
        open={roastMomentId !== null}
        onClose={() => setRoastMomentId(null)}
        moment={room.moments.find((v) => v.moment.id === roastMomentId)}
        roasts={roastMomentId !== null ? (roasts.byMoment.get(roastMomentId) ?? []) : []}
        onPost={(text) => {
          if (roastMomentId === null) return Promise.resolve(false);
          return postRoast(roastMomentId, text);
        }}
        onVote={voteRoast}
        onDelete={deleteRoast}
      />

      <RoastReactionSheet
        open={fireMomentId !== null}
        onClose={() => setFireMomentId(null)}
        mineStyle={
          fireMomentId !== null ? roastReactions.forMoment(fireMomentId).mine?.style : undefined
        }
        mineHeat={
          fireMomentId !== null ? roastReactions.forMoment(fireMomentId).mine?.heat : undefined
        }
        onSend={(lineId, customText, heat, style) => {
          if (fireMomentId !== null) sendFireReaction(fireMomentId, lineId, customText, heat, style);
        }}
      />
    </div>
  );
}

/* --------------------------------------------------- Live activity layer -- */

/**
 * Somebody joined, posted, or started a voice room while I was looking — say so
 * once, quietly, with their face on it. Anything that already existed when the
 * screen mounted is history, not news.
 */
function useLiveEvents(
  events: RoomEvent[],
  myMemberId: bigint | undefined,
  members: RoomMember[],
  muted: boolean
) {
  const toast = useToast();
  const seen = useRef<Set<string> | null>(null);

  const latest = useMemo(() => events.slice(0, 6), [events]);

  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(latest.map((e) => String(e.id)));
      return;
    }
    for (const event of [...latest].reverse()) {
      const key = String(event.id);
      if (seen.current.has(key)) continue;
      seen.current.add(key);
      if (muted) continue;
      if (myMemberId !== undefined && event.memberId === myMemberId) continue;

      const who = members.find((m) => m.id === event.memberId);
      const emoji =
        event.kind === 'joined'
          ? '✨'
          : event.kind === 'posted'
            ? '📷'
            : event.kind === 'voice_started'
              ? '🎙️'
              : event.kind === 'voice_ended'
                ? '📴'
                : event.kind === 'roast_on' || event.kind === 'roast_off'
                  ? '🔥'
                  : event.kind === 'prompt'
                    ? '🗣️'
                    : '🏠';

      toast({ message: event.text, emoji, avatarUrl: who?.avatarUrl });
      haptic('light');
    }
  }, [latest, myMemberId, members, muted, toast]);
}

/* ------------------------------------------------------------ Mute state -- */

function readMuted(): string[] {
  try {
    return JSON.parse(localStorage.getItem(MUTE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeMuted(code: string, muted: boolean) {
  try {
    const current = new Set(readMuted());
    if (muted) current.add(code);
    else current.delete(code);
    localStorage.setItem(MUTE_KEY, JSON.stringify([...current]));
  } catch {
    /* storage blocked — the preference just won't survive a reload */
  }
}
