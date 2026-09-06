// End-to-end check of the real-time contract.
//
// Two independent connections ("A" and "B") stand in for two phones. Nothing
// here polls: every assertion waits for a SpacetimeDB push to land in the
// client cache, which is exactly what the UI depends on.
//
// Run:
//   npx tsc scripts/e2e.ts --module commonjs --moduleResolution node \
//     --target es2022 --esModuleInterop --skipLibCheck --outDir .e2e-out \
//   && node .e2e-out/scripts/e2e.js

declare const process: any; // Node-only; @types/node isn't part of the app build

import { DbConnection, tables } from '../src/module_bindings/index';

const URI = process.env.SPACETIMEDB_HOST || 'ws://localhost:3000';
const DB = process.env.SPACETIMEDB_DB_NAME || 'chai-time-r7mf4';
const CODE = `E2E${Math.floor(Math.random() * 900 + 100)}`;
const PHOTO = 'https://picsum.photos/seed/e2e/600/800';

let failures = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? '✅' : '❌'} ${label}`);
  if (!ok) failures++;
}

function connect(token?: string) {
  return new Promise<{ conn: DbConnection; token: string; identity: string }>(
    (resolve, reject) => {
      const builder = DbConnection.builder().withUri(URI).withDatabaseName(DB);
      if (token) builder.withToken(token);
      builder
        .onConnect((conn, identity, newToken) =>
          resolve({ conn, token: newToken, identity: identity.toHexString() })
        )
        .onConnectError((_ctx, err) => reject(err))
        .build();
    }
  );
}

function subscribe(conn: DbConnection) {
  return new Promise<void>((resolve) => {
    conn
      .subscriptionBuilder()
      .onApplied(() => resolve())
      .subscribe([
        tables.person,
        tables.room,
        tables.roomMember,
        tables.media,
        tables.moment,
        tables.message,
        tables.reaction,
        tables.roomEvent,
        tables.voiceSession,
        tables.voiceParticipant,
        tables.signal,
      ]);
  });
}

/** Waits for a push rather than sleeping a fixed amount. */
function waitFor<T>(probe: () => T | undefined, what: string, timeoutMs = 15000) {
  return new Promise<T>((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const value = probe();
      if (value !== undefined) return resolve(value);
      if (Date.now() - start > timeoutMs) return reject(new Error(`timed out: ${what}`));
      setTimeout(tick, 60);
    };
    tick();
  });
}

async function main() {
  console.log(`connecting to ${DB} at ${URI}\n`);

  const a = await connect();
  const b = await connect();
  await Promise.all([subscribe(a.conn), subscribe(b.conn)]);
  check('two clients connected and subscribed', true);

  await a.conn.reducers.saveProfile({
    displayName: 'Ayesha (A)',
    handle: 'ayesha',
    avatarUrl: 'https://i.pravatar.cc/240?img=31',
    bio: 'e2e',
  });
  await b.conn.reducers.saveProfile({
    displayName: 'Bilal (B)',
    handle: 'bilal',
    avatarUrl: 'https://i.pravatar.cc/240?img=12',
    bio: 'e2e',
  });

  // A creates a room; B must learn about it purely through its subscription.
  await a.conn.reducers.createRoom({
    code: CODE,
    name: 'E2E Room',
    emoji: '🧪',
    kind: 'friends',
    coverUrl: PHOTO,
    isEvent: false,
  });

  const roomForB = await waitFor(
    () => [...b.conn.db.room.iter()].find((r) => r.code === CODE),
    'B sees the new room'
  );
  check('room created by A is pushed to B', roomForB.name === 'E2E Room');

  await b.conn.reducers.joinRoom({ code: CODE });
  const bMemberForA = await waitFor(
    () =>
      [...a.conn.db.roomMember.iter()].find(
        (m) => m.roomId === roomForB.id && m.displayName === 'Bilal (B)'
      ),
    'A sees B join'
  );
  check('B joining is pushed to A', bMemberForA.status === 'online');

  const joinEvent = await waitFor(
    () =>
      [...a.conn.db.roomEvent.iter()].find(
        (e) => e.roomId === roomForB.id && e.kind === 'joined'
      ),
    'A receives the join event'
  );
  check('join shows up in the room ticker', joinEvent.text.includes('Bilal'));

  // B changes what they're doing; A should see the activity move.
  await b.conn.reducers.setActivity({
    activity: 'On the beach',
    activityEmoji: '🏖️',
    status: 'online',
  });
  const activity = await waitFor(
    () =>
      [...a.conn.db.roomMember.iter()].find(
        (m) => m.id === bMemberForA.id && m.activity === 'On the beach'
      ),
    'A sees B’s activity change'
  );
  check('presence/activity is pushed live', activity.activityEmoji === '🏖️');

  // A posts a moment; B must receive it without asking.
  await a.conn.reducers.postMoment({
    roomId: roomForB.id,
    kind: 'photo',
    caption: 'e2e moment',
    mediaUrl: PHOTO, posterUrl: '',
    mimeType: 'image/jpeg',
    width: 600,
    height: 800,
    durationMs: 0,
    sizeBytes: 0,
    waveform: '',
  });
  const momentForB = await waitFor(
    () =>
      [...b.conn.db.moment.iter()].find(
        (m) => m.roomId === roomForB.id && m.caption === 'e2e moment'
      ),
    'B sees the moment'
  );
  check('moment posted by A is pushed to B', momentForB.mediaId !== 0n);

  // The media reference lives in its own row — the moment only points at it.
  const mediaForB = await waitFor(
    () => [...b.conn.db.media.iter()].find((m) => m.id === momentForB.mediaId),
    'B sees the media reference'
  );
  check('media is stored as a reference row, not inline', mediaForB.url === PHOTO);

  // B reacts; A must see the reaction.
  await b.conn.reducers.toggleReaction({ momentId: momentForB.id, emoji: '❤️' });
  await waitFor(
    () =>
      [...a.conn.db.reaction.iter()].find(
        (r) => r.momentId === momentForB.id && r.emoji === '❤️'
      ),
    'A sees the reaction'
  );
  check('reaction is pushed back to A', true);

  // Same emoji again removes it — the toggle contract the UI relies on.
  await b.conn.reducers.toggleReaction({ momentId: momentForB.id, emoji: '❤️' });
  await waitFor(
    () =>
      [...a.conn.db.reaction.iter()].some((r) => r.momentId === momentForB.id)
        ? undefined
        : true,
    'A sees the reaction removed'
  );
  check('tapping the same emoji toggles it off', true);

  // B replies. A reply is a chat message that quotes the moment, so the room's
  // conversation and a moment's thread are the same rows.
  await b.conn.reducers.sendMessage({
    roomId: roomForB.id,
    kind: 'text',
    text: 'looks great',
    momentId: momentForB.id,
    mediaUrl: '', posterUrl: '',
    mimeType: '',
    width: 0,
    height: 0,
    durationMs: 0,
    sizeBytes: 0,
    waveform: '',
  });
  const reply = await waitFor(
    () => [...a.conn.db.message.iter()].find((m) => m.momentId === momentForB.id),
    'A sees the reply'
  );
  check('a reply is a message that quotes the moment', reply.text === 'looks great');

  /* ---- chat ------------------------------------------------------------- */

  await b.conn.reducers.sendMessage({
    roomId: roomForB.id,
    kind: 'text',
    text: 'this is unreal',
    momentId: 0n,
    mediaUrl: '', posterUrl: '',
    mimeType: '',
    width: 0,
    height: 0,
    durationMs: 0,
    sizeBytes: 0,
    waveform: '',
  });
  const chatForA = await waitFor(
    () =>
      [...a.conn.db.message.iter()].find(
        (m) => m.roomId === roomForB.id && m.text === 'this is unreal'
      ),
    'A sees the chat message'
  );
  check('chat message is pushed to A', chatForA.kind === 'text');

  // A voice note is a message plus a media row carrying duration and waveform.
  await a.conn.reducers.sendMessage({
    roomId: roomForB.id,
    kind: 'voice',
    text: '',
    momentId: 0n,
    mediaUrl: 'https://example.test/voice.webm', posterUrl: '',
    mimeType: 'audio/webm',
    width: 0,
    height: 0,
    durationMs: 4200,
    sizeBytes: 18000,
    waveform: 'ajmqtwzwtqmjgehknqtwzxwtqnjg',
  });
  const voiceNote = await waitFor(
    () => [...b.conn.db.message.iter()].find((m) => m.kind === 'voice'),
    'B sees the voice note'
  );
  const voiceMedia = await waitFor(
    () => [...b.conn.db.media.iter()].find((m) => m.id === voiceNote.mediaId),
    'B sees the voice media row'
  );
  check(
    'voice note carries its duration and waveform',
    voiceMedia.durationMs === 4200 && voiceMedia.waveform.length > 0
  );

  /* ---- live voice ------------------------------------------------------- */

  await a.conn.reducers.startVoice({ roomId: roomForB.id });
  const sessionForB = await waitFor(
    () => [...b.conn.db.voiceSession.iter()].find((s) => s.roomId === roomForB.id),
    'B sees the voice room open'
  );
  check('starting voice is pushed to everyone', sessionForB.startedBy !== 0n);

  await b.conn.reducers.joinVoice({ roomId: roomForB.id });
  const seats = await waitFor(() => {
    const list = [...a.conn.db.voiceParticipant.iter()].filter(
      (p) => p.sessionId === sessionForB.id
    );
    return list.length === 2 ? list : undefined;
  }, 'A sees B join voice');
  check('both people are seated in the voice room', seats.length === 2);

  // Signalling is an ordinary table: A offers, B receives, B deletes.
  const bSeat = seats.find((s) => s.memberId === bMemberForA.id)!;
  await a.conn.reducers.sendSignal({
    roomId: roomForB.id,
    toMemberId: bSeat.memberId,
    kind: 'offer',
    payload: '{"type":"offer"}',
  });
  const offer = await waitFor(
    () => [...b.conn.db.signal.iter()].find((s) => s.toMemberId === bSeat.memberId),
    'B receives the WebRTC offer'
  );
  check('WebRTC signalling flows through SpacetimeDB', offer.kind === 'offer');

  await b.conn.reducers.consumeSignal({ signalId: offer.id });
  await waitFor(
    () => ([...b.conn.db.signal.iter()].some((s) => s.id === offer.id) ? undefined : true),
    'the signal is consumed and deleted'
  );
  check('signalling rows are single-use', true);

  await b.conn.reducers.setMuted({ roomId: roomForB.id, muted: true });
  await waitFor(
    () =>
      [...a.conn.db.voiceParticipant.iter()].find(
        (p) => p.memberId === bSeat.memberId && p.muted
      ),
    'A sees B mute'
  );
  check('mute state is pushed live', true);

  await b.conn.reducers.leaveVoice({ roomId: roomForB.id });
  await a.conn.reducers.leaveVoice({ roomId: roomForB.id });
  await waitFor(
    () =>
      [...a.conn.db.voiceSession.iter()].some((s) => s.roomId === roomForB.id)
        ? undefined
        : true,
    'the voice room closes when the last person leaves'
  );
  check('an empty voice room closes itself', true);

  console.log(`\n${failures === 0 ? 'all good ✨' : `${failures} failure(s)`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('❌', err?.message ?? err);
  process.exit(1);
});
