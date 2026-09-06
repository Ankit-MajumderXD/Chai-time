declare const process: any;
import { DbConnection, tables } from '../src/module_bindings/index';

const URI = process.env.SPACETIMEDB_HOST || 'ws://127.0.0.1:3000';
const DB = process.env.SPACETIMEDB_DB_NAME || 'chai-time-r7mf4';

let fails = 0;
const check = (label: string, ok: boolean) => {
  console.log(`${ok ? '✅' : '❌'} ${label}`);
  if (!ok) fails++;
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function connect(token?: string) {
  return new Promise<DbConnection>((resolve, reject) => {
    const b = DbConnection.builder().withUri(URI).withDatabaseName(DB);
    if (token) b.withToken(token);
    b.onConnect((conn) => resolve(conn)).onConnectError((_c, e) => reject(e)).build();
  });
}
function sub(conn: DbConnection) {
  return new Promise<void>((resolve) => {
    conn
      .subscriptionBuilder()
      .onApplied(() => resolve())
      .subscribe([
        tables.person, tables.room, tables.roomMember, tables.moment, tables.media,
        tables.reaction, tables.badge, tables.roast, tables.roastVote, tables.roomEvent,
      ]);
  });
}

(async () => {
  const conn = await connect();
  await sub(conn);
  const myIdHex = conn.identity!.toHexString();

  await conn.reducers.saveProfile({
    displayName: 'Verifier', handle: 'verifier', avatarUrl: '', bio: '',
  });
  await wait(400);
  await conn.reducers.seedDemoRooms({});
  await wait(1200);

  const me = [...conn.db.person.iter()].find((p) => p.identity.toHexString() === myIdHex)!;
  const myRooms = [...conn.db.room.iter()].filter((r) => r.ownerId === me.id);
  check('seedDemoRooms created 3 rooms', myRooms.length === 3);

  const room = myRooms.find((r) => r.name === 'Family')!;
  const demoMembers = [...conn.db.roomMember.iter()].filter(
    (m) => m.roomId === room.id && m.isDemo
  );
  check(
    'demo members carry seeded streaks',
    demoMembers.some((m) => m.currentStreak > 0) && demoMembers.some((m) => m.currentStreak >= 7)
  );
  const demoBadges = [...conn.db.badge.iter()].filter((b) =>
    demoMembers.some((m) => m.id === b.membershipId)
  );
  check('7-day demo members got a 7_day_streak badge', demoBadges.some((b) => b.badgeType === '7_day_streak'));

  // ---- Streak: my first moment ----
  const myMember = [...conn.db.roomMember.iter()].find(
    (m) => m.roomId === room.id && m.personId === me.id
  )!;
  check('my streak starts at 0', myMember.currentStreak === 0);

  await conn.reducers.postMoment({
    roomId: room.id, kind: 'text', caption: 'first!', mediaUrl: '', posterUrl: '', mimeType: '',
    width: 0, height: 0, durationMs: 0, sizeBytes: 0, waveform: '',
  });
  await wait(700);
  const afterPost = conn.db.roomMember.id.find(myMember.id)!;
  check('posting a moment sets streak to 1', afterPost.currentStreak === 1);
  check('longest streak tracks current', afterPost.longestStreak === 1);
  check('lastMomentDate is set', afterPost.lastMomentDate > 0);

  // posting again same day: no change
  await conn.reducers.postMoment({
    roomId: room.id, kind: 'text', caption: 'second same day', mediaUrl: '', posterUrl: '', mimeType: '',
    width: 0, height: 0, durationMs: 0, sizeBytes: 0, waveform: '',
  });
  await wait(700);
  check('second moment same day does not bump streak', conn.db.roomMember.id.find(myMember.id)!.currentStreak === 1);

  const myMoment = [...conn.db.moment.iter()].find((m) => m.roomId === room.id && m.memberId === myMember.id)!;

  // ---- Roast mode ----
  let roastErr = '';
  try {
    await conn.reducers.postRoast({ momentId: myMoment.id, text: 'should fail, roast mode off' });
  } catch (e: any) { roastErr = e.message; }
  check('postRoast rejected while roast mode is off', /roast mode is off/i.test(roastErr));

  await conn.reducers.setRoastMode({ roomId: room.id, enabled: true });
  await wait(500);
  check('owner can enable roast mode', conn.db.room.id.find(room.id)!.roastMode === true);

  await conn.reducers.postRoast({ momentId: myMoment.id, text: 'yeh natural hai ya 10 retake laga?' });
  await wait(600);
  const roasts = [...conn.db.roast.iter()].filter((r) => r.momentId === myMoment.id);
  check('postRoast created a roast with roomId denormalised', roasts.length === 1 && roasts[0].roomId === room.id);

  await conn.reducers.voteRoast({ roastId: roasts[0].id });
  await wait(500);
  check('voteRoast recorded one vote', [...conn.db.roastVote.iter()].filter((v) => v.roastId === roasts[0].id).length === 1);

  let dupErr = '';
  try { await conn.reducers.voteRoast({ roastId: roasts[0].id }); }
  catch (e: any) { dupErr = e.message; }
  check('a second vote from the same person is rejected', /already voted/i.test(dupErr));

  await conn.reducers.unvoteRoast({ roastId: roasts[0].id });
  await wait(500);
  check('unvoteRoast removes the vote', [...conn.db.roastVote.iter()].filter((v) => v.roastId === roasts[0].id).length === 0);

  // non-owner cannot toggle
  let ownerErr = '';
  const other = await connect();
  await sub(other);
  await other.reducers.saveProfile({ displayName: 'Rando', handle: 'rando', avatarUrl: '', bio: '' });
  await wait(300);
  try { await other.reducers.setRoastMode({ roomId: room.id, enabled: false }); }
  catch (e: any) { ownerErr = e.message; }
  check('non-owner cannot toggle roast mode', /only the room owner/i.test(ownerErr));

  console.log(fails === 0 ? '\nALL GREEN' : `\n${fails} FAILED`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error('threw:', e); process.exit(1); });
