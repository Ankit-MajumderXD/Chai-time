/**
 * The camera.
 *
 * Opens straight to a live preview, gets out of the way, and hands off to the
 * preview screen the instant the shutter fires. The chrome is deliberately thin
 * — the viewfinder is the interface.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PostPreview } from './PostPreview';
import { riseVariants, pressable, spring } from '../design/motion';
import { haptic } from '../lib/haptics';
import { useRouter } from '../lib/router';
import { useRooms } from '../data/useRooms';
import {
  capturePoster,
  prepareFile,
  preparePhoto,
  probeVideo,
  putMedia,
  tooBig,
  type MediaRef,
} from '../lib/upload';
import { useToast } from '../components/Toast';

/** What the camera hands to the preview screen: a finished media reference. */
export type Shot = { media: MediaRef };

const VIDEO_MAX_MS = 5000;

export function Camera({ code }: { code?: string }) {
  const { back } = useRouter();
  const { rooms } = useRooms();
  const toast = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimer = useRef<number>(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const [facing, setFacing] = useState<'user' | 'environment'>('environment');
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [flash, setFlash] = useState(false);
  const [shot, setShot] = useState<Shot | null>(null);

  /* ---- stream lifecycle ------------------------------------------------- */

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setReady(false);

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video:
            mode === 'video'
              ? { facingMode: facing, width: { ideal: 960 }, height: { ideal: 960 }, frameRate: { ideal: 24, max: 30 } }
              : { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: mode === 'video',
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        stopStream();
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setDenied(null);
        setReady(true);
      } catch {
        if (!cancelled) {
          setDenied(
            "We can't reach your camera. Check the permission in your browser, or pick something from your gallery."
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [facing, mode, stopStream]);

  useEffect(() => () => window.clearTimeout(stopTimer.current), []);

  /* ---- capture ---------------------------------------------------------- */

  const flashScreen = () => {
    setFlash(true);
    window.setTimeout(() => setFlash(false), 130);
  };

  const takePhoto = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    haptic('heavy');
    flashScreen();
    try {
      // A front-facing shot should look the way the preview looked.
      const { blob, width, height } = await preparePhoto(video, facing === 'user');
      setShot({ media: await putMedia(blob, 'photo', { width, height }) });
    } catch {
      toast({ message: "That shot didn't save. Try again.", tone: 'error' });
    }
  };

  const startVideo = () => {
    const stream = streamRef.current;
    if (!stream || recording) return;
    haptic('medium');
    chunksRef.current = [];
    // Low bitrate on purpose: with no object storage the clip has to fit through
    // the database as a data URL. ~700 kb/s over 5s ≈ 440 KB.
    const recorder = new MediaRecorder(stream, {
      mimeType: pickVideoMime(),
      videoBitsPerSecond: 700_000,
      audioBitsPerSecond: 48_000,
    });
    recorder.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    recorder.onstop = () => {
      void (async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        try {
          const ref = await putMedia(blob, 'video', { mimeType: recorder.mimeType });
          if (tooBig(ref)) {
            toast({
              message: 'That clip came out too heavy — try a shorter one.',
              tone: 'error',
            });
            return;
          }
          const probe = await probeVideo(ref.url);
          const posterUrl = await capturePoster(ref.url);
          setShot({ media: { ...ref, ...probe, posterUrl } });
        } catch {
          toast({ message: "That clip didn't save. Try again.", tone: 'error' });
        }
      })();
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
    stopTimer.current = window.setTimeout(stopVideo, VIDEO_MAX_MS);
  };

  const stopVideo = () => {
    window.clearTimeout(stopTimer.current);
    if (!recorderRef.current) return;
    recorderRef.current.stop();
    recorderRef.current = null;
    setRecording(false);
    haptic('light');
  };

  const onGalleryPick = async (file: File) => {
    try {
      setShot({ media: await prepareFile(file) });
    } catch {
      toast({ message: "We couldn't open that file.", tone: 'error' });
    }
  };

  /* ---- preview handoff -------------------------------------------------- */

  if (shot) {
    return (
      <PostPreview
        shot={shot}
        preferredCode={code}
        onDiscard={() => setShot(null)}
        onDone={back}
      />
    );
  }

  return (
    <motion.div
      className="camera"
      variants={riseVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <video
        ref={videoRef}
        className="camera__preview"
        data-mirrored={facing === 'user'}
        playsInline
        muted
        autoPlay
      />

      <AnimatePresence>
        {!ready && !denied && (
          <motion.div
            className="camera__warming"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <span className="camera__warming-ring" />
            <p className="t-sm">Warming up the lens…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {denied && (
        <div className="camera__denied">
          <span className="camera__denied-emoji">🎞️</span>
          <h2 className="t-h2">Camera's shy</h2>
          <p className="t-sm">{denied}</p>
          <motion.button
            className="btn btn--soft"
            onClick={() => fileRef.current?.click()}
            {...pressable}
          >
            Choose from gallery
          </motion.button>
        </div>
      )}

      <AnimatePresence>
        {flash && (
          <motion.span
            className="camera__flash"
            initial={{ opacity: 0.85 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          />
        )}
      </AnimatePresence>

      <header className="camera__top">
        <motion.button
          type="button"
          className="icon-btn icon-btn--glass"
          aria-label="Close camera"
          onClick={back}
          {...pressable}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
            <path
              d="m6.6 6.6 10.8 10.8M17.4 6.6 6.6 17.4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </motion.button>

        <div className="camera__mode">
          {(['photo', 'video'] as const).map((option) => (
            <button
              key={option}
              type="button"
              data-active={mode === option}
              onClick={() => {
                if (recording) return;
                haptic('light');
                setMode(option);
              }}
            >
              {option === 'photo' ? 'Photo' : 'Video'}
              {mode === option && (
                <motion.span className="camera__mode-pill" layoutId="camera-mode" />
              )}
            </button>
          ))}
        </div>

        <span className="camera__top-spacer" />
      </header>

      {rooms.length > 0 && (
        <div className="camera__target">
          <span className="pill pill--glass">
            Sharing to{' '}
            {code
              ? (rooms.find((r) => r.room.code === code)?.room.name ?? 'a room')
              : 'the room you pick next'}
          </span>
        </div>
      )}

      <footer className="camera__controls">
        <motion.button
          type="button"
          className="camera__side"
          aria-label="Open gallery"
          onClick={() => fileRef.current?.click()}
          {...pressable}
        >
          <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden>
            <rect
              x="3.4"
              y="5.4"
              width="17.2"
              height="13.2"
              rx="3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            />
            <path
              d="m5 16 4.2-4.4 3 3 2.6-2.4L19 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.button>

        <motion.button
          type="button"
          className="shutter"
          data-recording={recording}
          aria-label={mode === 'photo' ? 'Take photo' : 'Record video'}
          onClick={() => {
            if (mode === 'photo') void takePhoto();
            else if (recording) stopVideo();
            else startVideo();
          }}
          whileTap={{ scale: 0.9 }}
          transition={spring.pop}
        >
          <span className="shutter__ring" />
          <motion.span
            className="shutter__core"
            animate={
              recording
                ? { borderRadius: 10, scale: 0.5, backgroundColor: '#f0526a' }
                : { borderRadius: 999, scale: 1, backgroundColor: '#ffffff' }
            }
            transition={spring.bouncy}
          />
          {recording && (
            <motion.span
              className="shutter__timer"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: VIDEO_MAX_MS / 1000, ease: 'linear' }}
            />
          )}
        </motion.button>

        <motion.button
          type="button"
          className="camera__side"
          aria-label="Switch camera"
          onClick={() => {
            haptic('light');
            setFacing((f) => (f === 'user' ? 'environment' : 'user'));
          }}
          whileTap={{ scale: 0.9, rotate: 180 }}
          transition={spring.bouncy}
        >
          <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden>
            <path
              d="M4.6 10.4a7.4 7.4 0 0 1 12.5-3.3l2 2M19.4 13.6a7.4 7.4 0 0 1-12.5 3.3l-2-2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M19.4 5.2v4h-4M4.6 18.8v-4h4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.button>
      </footer>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onGalleryPick(file);
          e.target.value = '';
        }}
      />
    </motion.div>
  );
}

function pickVideoMime(): string {
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}
