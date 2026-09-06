/**
 * The onboarding collage.
 *
 * Three photographs that behave like physical snapshots dropped on a table:
 * rotated, overlapping, shadowed, with a couple of handwritten notes. The whole
 * stack sits in a real 3D space (`preserve-3d`) and tilts with the pointer or
 * the phone's gyroscope, so the depth is genuine rather than painted on.
 *
 * Photos, not WebGL textures, on purpose — an image that fails to decode still
 * shows its pastel card, and there is no CORS surface to lose.
 */
import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Avatar } from './Avatar';
import { ONBOARDING_PHOTOS, photoUrl } from '../lib/rooms';

const CAST = [
  { name: 'Aisha', face: 31 },
  { name: 'Bilal', face: 12 },
  { name: 'Mom', face: 45 },
];

export function PhotoStack() {
  const wrap = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState(false);

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateY = useSpring(useTransform(px, [-1, 1], [11, -11]), {
    stiffness: 120,
    damping: 18,
  });
  const rotateX = useSpring(useTransform(py, [-1, 1], [-9, 9]), {
    stiffness: 120,
    damping: 18,
  });

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const onPointer = (e: PointerEvent) => {
      px.set((e.clientX / window.innerWidth - 0.5) * 2);
      py.set((e.clientY / window.innerHeight - 0.5) * 2);
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      px.set(Math.max(-1, Math.min(1, (e.gamma ?? 0) / 35)));
      py.set(Math.max(-1, Math.min(1, ((e.beta ?? 45) - 45) / 35)));
    };
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('deviceorientation', onTilt);
    return () => {
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('deviceorientation', onTilt);
    };
  }, [px, py, reduced]);

  return (
    <div className="photostack" ref={wrap}>
      <motion.div className="photostack__space" style={{ rotateX, rotateY }}>
        {ONBOARDING_PHOTOS.map((photo, i) => (
          <motion.figure
            key={photo.seed}
            className="snap"
            data-index={i}
            style={{ ['--tilt' as string]: `${photo.tilt}deg` }}
            initial={{ opacity: 0, y: 42, rotate: photo.tilt * 2.2, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, rotate: photo.tilt, scale: 1 }}
            transition={{
              type: 'spring',
              stiffness: 190,
              damping: 20,
              delay: 0.12 + i * 0.11,
            }}
          >
            <img src={photoUrl(photo.seed, 640, 800)} alt="" />
            <figcaption className="snap__caption t-hand">{photo.label}</figcaption>
          </motion.figure>
        ))}

        {/* Faces peeking out of the stack — the app is about people, so people
            are the first thing you see. */}
        {CAST.map((person, i) => (
          <motion.span
            key={person.name}
            className="photostack__face"
            data-slot={i}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 0.55 + i * 0.1 }}
          >
            <Avatar
              name={person.name}
              src={`https://i.pravatar.cc/160?img=${person.face}`}
              size={40}
              presence={i === 2 ? 'away' : 'online'}
            />
          </motion.span>
        ))}

        <motion.span
          className="photostack__doodle photostack__doodle--heart"
          initial={{ opacity: 0, scale: 0.3, rotate: -30 }}
          animate={{ opacity: 1, scale: 1, rotate: -12 }}
          transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.85 }}
          aria-hidden
        >
          ♡
        </motion.span>
        <motion.span
          className="photostack__doodle photostack__doodle--star"
          initial={{ opacity: 0, scale: 0.3, rotate: 40 }}
          animate={{ opacity: 1, scale: 1, rotate: 14 }}
          transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.95 }}
          aria-hidden
        >
          ✦
        </motion.span>
      </motion.div>
    </div>
  );
}
