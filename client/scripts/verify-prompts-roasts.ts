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
    b.onConnect((c) => resolve(c)).onConnectError((_c, e) => reject(e)).build();
  });
}
function sub(conn: DbConnection) {
  return new Promise<void>((resolve) => {
    conn.subscriptionBuilder().onApplied(() => resolve()).subscribe([
      tables.person, tables.room, tables.roomMember, tables.moment, tables.media,
      tables.promptLibrary, tables.customPrompt, tables.roomPromptSchedule, tables.roomPrompt,
      tables.roastLineLibrary, tables.roastReaction, tables.roomEvent,
    ]);
  });
}

(async () => {
  const conn = await connect();
  await sub(conn);
  const hex = conn.identity!.toHexString();
  await conn.reducers.saveProfile({ displayName: 'PRVerify', handle: 'prv', avatarUrl: '', bio: '' });
  await wait(400);
  await conn.reducers.seedDemoRooms({});
  await wait(1500);

  // ---- libraries seeded ----
  const pl = [...conn.db.promptLibrary.iter()];
  check('prompt_library seeded (10 rows)', pl.length === 10);
  check('prompt_library has family + friends', pl.some(p => p.roomType === 'family') && pl.some(p => p.roomType === 'friends'));
  const rll = [...conn.db.roastLineLibrary.iter()];
  check('roast_line_library seeded (11 rows)', rll.length === 11);
  check('roast lines span all 3 heats',
    ['mild','spicy','savage'].every(h => rll.some(r => r.heatLevel === h)));

  const me = [...conn.db.person.iter()].find(p => p.identity.toHexString() === hex)!;
  const room = [...conn.db.room.iter()].find(r => r.ownerId === me.id && r.name === 'Family')!;
  const myMember = [...conn.db.roomMember.iter()].find(m => m.roomId === room.id && m.personId === me.id)!;

  // ---- schedule ----
  await conn.reducers.setRoomPromptSchedule({ roomId: room.id, scheduledTime: '08:30', source: 'default_family', isActive: true });
  await wait(500);
  const sched = [...conn.db.roomPromptSchedule.iter()].find(s => s.roomId === room.id)!;
  check('setRoomPromptSchedule created a schedule', !!sched && sched.scheduledTime === '08:30' && sched.isActive);
  check('schedule source normalised', sched.source === 'default_family');

  // update (upsert, not duplicate)
  await conn.reducers.setRoomPromptSchedule({ roomId: room.id, scheduledTime: '21:00', source: 'default_friends', isActive: false });
  await wait(500);
  const after = [...conn.db.roomPromptSchedule.iter()].filter(s => s.roomId === room.id);
  check('schedule updates in place (no duplicate)', after.length === 1 && after[0].scheduledTime === '21:00' && !after[0].isActive);

  let badTime = '';
  try { await conn.reducers.setRoomPromptSchedule({ roomId: room.id, scheduledTime: '99:99', source: 'custom', isActive: true }); }
  catch (e: any) { badTime = e.message; }
  check('rejects a bad HH:MM', /HH:MM/i.test(badTime));

  // ---- custom prompt ----
  await conn.reducers.addCustomPrompt({ roomId: room.id, text: 'Aaj kiska mood off hai? 😤' });
  await wait(400);
  await conn.reducers.addCustomPrompt({ roomId: room.id, text: 'Show your desk right now' });
  await wait(400);
  const customs = [...conn.db.customPrompt.iter()].filter(c => c.roomId === room.id);
  check('two custom prompts stored', customs.length === 2);
  check('only the latest custom prompt is active', customs.filter(c => c.active).length === 1 && customs.find(c => c.active)!.text === 'Show your desk right now');

  // ---- manual prompt cycle ----
  await conn.reducers.triggerPromptCycle({ roomId: room.id, text: '', source: 'manual' });
  await wait(600);
  const live = conn.db.roomPrompt.roomId.find(room.id);
  check('triggerPromptCycle set a live prompt from the pack', !!live && live.text.length > 0);
  check('prompt logged a room_event', [...conn.db.roomEvent.iter()].some(e => e.roomId === room.id && e.kind === 'prompt'));

  await conn.reducers.triggerPromptCycle({ roomId: room.id, text: 'CUSTOM NUDGE', source: 'manual' });
  await wait(500);
  check('a new cycle replaces the live prompt (still one row)',
    [...conn.db.roomPrompt.iter()].filter(p => p.roomId === room.id).length === 1 &&
    conn.db.roomPrompt.roomId.find(room.id)!.text === 'CUSTOM NUDGE');

  await conn.reducers.dismissRoomPrompt({ roomId: room.id });
  await wait(400);
  check('dismissRoomPrompt clears it', !conn.db.roomPrompt.roomId.find(room.id));

  // ---- roast reactions ----
  await conn.reducers.postMoment({
    roomId: room.id, kind: 'text', caption: 'roast me', mediaUrl: '', posterUrl: '', mimeType: '',
    width: 0, height: 0, durationMs: 0, sizeBytes: 0, waveform: '',
  });
  await wait(600);
  const mo = [...conn.db.moment.iter()].find(m => m.roomId === room.id && m.memberId === myMember.id)!;
  const savage = rll.find(r => r.heatLevel === 'savage')!;

  await conn.reducers.sendRoastReaction({ momentId: mo.id, lineId: savage.id, customText: '', heatLevel: 'savage' });
  await wait(500);
  let rr = [...conn.db.roastReaction.iter()].filter(r => r.momentId === mo.id);
  check('sendRoastReaction with a library line', rr.length === 1 && rr[0].lineId === savage.id && rr[0].heatLevel === 'savage');

  // re-send replaces (one per person per moment)
  await conn.reducers.sendRoastReaction({ momentId: mo.id, lineId: 0n, customText: 'my own heat 🔥', heatLevel: 'spicy' });
  await wait(500);
  rr = [...conn.db.roastReaction.iter()].filter(r => r.momentId === mo.id);
  check('re-send replaces (still one, now custom)', rr.length === 1 && rr[0].lineId === 0n && rr[0].customText === 'my own heat 🔥' && rr[0].heatLevel === 'spicy');

  let emptyErr = '';
  try { await conn.reducers.sendRoastReaction({ momentId: mo.id, lineId: 0n, customText: '   ', heatLevel: 'mild' }); }
  catch (e: any) { emptyErr = e.message; }
  check('rejects an empty custom roast', /write your roast/i.test(emptyErr));

  await conn.reducers.clearRoastReaction({ momentId: mo.id });
  await wait(400);
  check('clearRoastReaction removes it', [...conn.db.roastReaction.iter()].filter(r => r.momentId === mo.id).length === 0);

  // ---- ownership guard ----
  const other = await connect();
  await sub(other);
  await other.reducers.saveProfile({ displayName: 'NotOwner', handle: 'no', avatarUrl: '', bio: '' });
  await wait(300);
  let ownErr = '';
  try { await other.reducers.setRoomPromptSchedule({ roomId: room.id, scheduledTime: '10:00', source: 'custom', isActive: true }); }
  catch (e: any) { ownErr = e.message; }
  check('non-owner cannot set a schedule', /only the room owner/i.test(ownErr));

  console.log(fails === 0 ? '\nALL GREEN' : `\n${fails} FAILED`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error('threw:', e); process.exit(1); });
