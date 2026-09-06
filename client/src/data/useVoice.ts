/**
 * Live voice — a WebRTC mesh, signalled through SpacetimeDB.
 *
 * The division of labour matters:
 *
 *   SpacetimeDB   session state, who is in the room, mute flags, voice-activity
 *                 timestamps, and a short-lived `signal` table used purely to
 *                 exchange offers / answers / ICE candidates.
 *   WebRTC        the audio itself, peer to peer. No audio byte ever reaches
 *                 the database.
 *
 * A mesh is the right shape for the sizes this app is built for (5–15 people in
 * a private room). Beyond that you would put an SFU in the middle and keep this
 * exact signalling layer.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTable } from 'spacetimedb/react';
import { tables } from '../module_bindings';
import { call, useConn } from './db';
import { audioContext } from '../lib/audio';
import type { VoiceView } from './useRoom';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

/** How often we're willing to tell the server "still talking". */
const SPEAK_PING_MS = 900;
const SPEAK_THRESHOLD = 0.055;
/** Everyone else's ring is held open by the server for 1.6s; hold mine too. */
const SPEAK_HOLD_MS = 700;

export interface VoiceControls {
  connecting: boolean;
  micDenied: boolean;
  muted: boolean;
  deafened: boolean;
  /** Local input level 0..1, for the ring around your own avatar. */
  level: number;
  /** Debounced "I am talking" — held briefly so your own ring doesn't strobe. */
  speaking: boolean;
  start: () => Promise<void>;
  join: () => Promise<void>;
  leave: () => Promise<void>;
  toggleMute: () => void;
  toggleDeafen: () => void;
}

export function useVoice(
  roomId: bigint | undefined,
  myMemberId: bigint | undefined,
  voice: VoiceView
): VoiceControls {
  const conn = useConn();
  const [signals] = useTable(tables.signal);

  const [connecting, setConnecting] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [level, setLevel] = useState(0);
  const [speaking, setSpeaking] = useState(false);

  const localStream = useRef<MediaStream | null>(null);
  const peers = useRef(new Map<string, RTCPeerConnection>());
  const sinks = useRef(new Map<string, HTMLAudioElement>());
  const handled = useRef(new Set<string>());
  const lastPing = useRef(0);
  const meter = useRef(0);
  const lastLoud = useRef(0);

  const inVoice = voice.iAmIn;
  const sessionId = voice.session?.id;

  /* ---- teardown --------------------------------------------------------- */

  const closeAll = useCallback(() => {
    peers.current.forEach((pc) => pc.close());
    peers.current.clear();
    sinks.current.forEach((el) => {
      el.pause();
      el.srcObject = null;
    });
    sinks.current.clear();
    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;
    cancelAnimationFrame(meter.current);
    meter.current = 0;
    setLevel(0);
    setSpeaking(false);
  }, []);

  useEffect(() => closeAll, [closeAll]);

  /* ---- microphone + local voice-activity detection ---------------------- */

  const openMic = useCallback(async () => {
    if (localStream.current) return localStream.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    localStream.current = stream;

    // Voice activity is measured locally and published as a timestamp, so every
    // client can draw a speaking ring without inspecting anyone's audio.
    const ctx = audioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      setLevel(Math.min(1, rms * 3.4));

      const live = stream.getAudioTracks()[0]?.enabled;
      const now = performance.now();
      if (live && rms > SPEAK_THRESHOLD) {
        lastLoud.current = now;
        if (roomId !== undefined && now - lastPing.current > SPEAK_PING_MS) {
          lastPing.current = now;
          void call(conn?.reducers.pingSpeaking({ roomId }));
        }
      }
      setSpeaking(!!live && now - lastLoud.current < SPEAK_HOLD_MS);
      meter.current = requestAnimationFrame(tick);
    };
    meter.current = requestAnimationFrame(tick);
    return stream;
  }, [conn, roomId]);

  /* ---- peer plumbing ---------------------------------------------------- */

  const peerFor = useCallback(
    (otherMemberId: bigint) => {
      const key = String(otherMemberId);
      const existing = peers.current.get(key);
      if (existing) return existing;
      if (roomId === undefined) return null;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peers.current.set(key, pc);

      localStream.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStream.current!);
      });

      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        void call(
          conn?.reducers.sendSignal({
            roomId,
            toMemberId: otherMemberId,
            kind: 'ice',
            payload: JSON.stringify(e.candidate.toJSON()),
          })
        );
      };

      pc.ontrack = (e) => {
        let el = sinks.current.get(key);
        if (!el) {
          el = new Audio();
          el.autoplay = true;
          (el as any).playsInline = true;
          sinks.current.set(key, el);
        }
        el.srcObject = e.streams[0];
        el.muted = deafened;
        void el.play().catch(() => {
          /* the browser will retry after the next gesture */
        });
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          pc.close();
          peers.current.delete(key);
        }
      };

      return pc;
    },
    [conn, roomId, deafened]
  );

  /** The lower member id always makes the offer, so there is never any glare. */
  const offerTo = useCallback(
    async (otherMemberId: bigint) => {
      if (roomId === undefined) return;
      const pc = peerFor(otherMemberId);
      if (!pc || pc.signalingState !== 'stable') return;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await call(
        conn?.reducers.sendSignal({
          roomId,
          toMemberId: otherMemberId,
          kind: 'offer',
          payload: JSON.stringify(offer),
        })
      );
    },
    [conn, roomId, peerFor]
  );

  /* ---- connect to everyone already in the room -------------------------- */

  useEffect(() => {
    if (!inVoice || myMemberId === undefined || roomId === undefined) return;
    let cancelled = false;

    (async () => {
      try {
        await openMic();
      } catch {
        setMicDenied(true);
        return;
      }
      if (cancelled) return;

      for (const seat of voice.seats) {
        const other = seat.participant.memberId;
        if (other === myMemberId) continue;
        const key = String(other);
        if (peers.current.has(key)) continue;
        if (myMemberId < other) await offerTo(other);
        else peerFor(other); // they will call us
      }

      // Someone left: drop the connection we were holding for them.
      const present = new Set(voice.seats.map((s) => String(s.participant.memberId)));
      for (const [key, pc] of peers.current) {
        if (!present.has(key)) {
          pc.close();
          peers.current.delete(key);
          sinks.current.get(key)?.pause();
          sinks.current.delete(key);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [inVoice, myMemberId, roomId, voice.seats, openMic, offerTo, peerFor]);

  /* ---- inbound signalling ----------------------------------------------- */

  useEffect(() => {
    if (!inVoice || myMemberId === undefined || roomId === undefined || !sessionId) return;

    const mine = signals.filter(
      (s) => s.toMemberId === myMemberId && s.sessionId === sessionId
    );
    if (mine.length === 0) return;

    void (async () => {
      for (const item of mine) {
        const key = String(item.id);
        if (handled.current.has(key)) continue;
        handled.current.add(key);

        try {
          if (item.kind === 'bye') {
            const peerKey = String(item.fromMemberId);
            peers.current.get(peerKey)?.close();
            peers.current.delete(peerKey);
            sinks.current.get(peerKey)?.pause();
            sinks.current.delete(peerKey);
          } else {
            const pc = peerFor(item.fromMemberId);
            if (pc) {
              if (item.kind === 'offer') {
                await pc.setRemoteDescription(JSON.parse(item.payload));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await call(
                  conn?.reducers.sendSignal({
                    roomId,
                    toMemberId: item.fromMemberId,
                    kind: 'answer',
                    payload: JSON.stringify(answer),
                  })
                );
              } else if (item.kind === 'answer') {
                if (pc.signalingState === 'have-local-offer') {
                  await pc.setRemoteDescription(JSON.parse(item.payload));
                }
              } else if (item.kind === 'ice' && pc.remoteDescription) {
                await pc.addIceCandidate(JSON.parse(item.payload));
              }
            }
          }
        } catch (err) {
          console.warn('[voice] could not apply signal', err);
        }

        // Signalling rows are single-use.
        void call(conn?.reducers.consumeSignal({ signalId: item.id }));
      }
    })();
  }, [signals, inVoice, myMemberId, roomId, sessionId, conn, peerFor]);

  /* ---- controls --------------------------------------------------------- */

  const start = useCallback(async () => {
    if (roomId === undefined || connecting) return;
    setConnecting(true);
    setMicDenied(false);
    try {
      await openMic();
      await call(conn?.reducers.startVoice({ roomId }));
    } catch {
      setMicDenied(true);
    } finally {
      setConnecting(false);
    }
  }, [conn, roomId, connecting, openMic]);

  const join = useCallback(async () => {
    if (roomId === undefined || connecting) return;
    setConnecting(true);
    setMicDenied(false);
    try {
      await openMic();
      await call(conn?.reducers.joinVoice({ roomId }));
    } catch {
      setMicDenied(true);
    } finally {
      setConnecting(false);
    }
  }, [conn, roomId, connecting, openMic]);

  const leave = useCallback(async () => {
    if (roomId === undefined) return;
    await call(conn?.reducers.leaveVoice({ roomId }));
    closeAll();
    setMuted(false);
    setDeafened(false);
  }, [conn, roomId, closeAll]);

  const toggleMute = useCallback(() => {
    if (roomId === undefined) return;
    const next = !muted;
    setMuted(next);
    if (next) setSpeaking(false);
    localStream.current?.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    void call(conn?.reducers.setMuted({ roomId, muted: next }));
  }, [conn, roomId, muted]);

  const toggleDeafen = useCallback(() => {
    const next = !deafened;
    setDeafened(next);
    sinks.current.forEach((el) => {
      el.muted = next;
    });
  }, [deafened]);

  return {
    connecting,
    micDenied,
    muted,
    deafened,
    level,
    speaking,
    start,
    join,
    leave,
    toggleMute,
    toggleDeafen,
  };
}
