/**
 * Invite.
 *
 * The moment right after a room is born, so it has to feel like an invitation
 * rather than a settings page: big friendly actions, a code you can read aloud,
 * and a QR someone across the table can just point a phone at.
 */
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import QRCode from 'qrcode';
import { TopBar } from '../components/TopBar';
import { Avatar } from '../components/Avatar';
import { useToast } from '../components/Toast';
import { itemVariants, listVariants, pressable, spring } from '../design/motion';
import { moodFor } from '../lib/rooms';
import { haptic } from '../lib/haptics';
import { useRouter } from '../lib/router';
import { useRoom } from '../data/useRoom';

export function Invite({ code }: { code: string }) {
  const { back, go } = useRouter();
  const toast = useToast();
  const room = useRoom(code);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showQr, setShowQr] = useState(false);

  const link = `${window.location.origin}/join/${code}`;
  const mood = room.room ? moodFor(room.room.kind) : moodFor('other');

  useEffect(() => {
    if (!showQr || !canvasRef.current) return;
    void QRCode.toCanvas(canvasRef.current, link, {
      width: 220,
      margin: 1,
      color: { dark: '#16141a', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    });
  }, [showQr, link]);

  const share = async () => {
    haptic('medium');
    try {
      if (navigator.share) {
        await navigator.share({
          title: room.room?.name ?? 'Join my room',
          text: `Join ${room.room?.name ?? 'my room'} on Chai Time`,
          url: link,
        });
        return;
      }
      await navigator.clipboard.writeText(link);
      toast({ message: 'Link copied — go paste it', emoji: '🔗' });
    } catch {
      /* share sheet dismissed */
    }
  };

  const copyCode = async () => {
    haptic('light');
    try {
      await navigator.clipboard.writeText(code);
      toast({ message: `Code ${code} copied`, emoji: '📋' });
    } catch {
      toast({ message: 'Copy failed — read it out instead 🙂', tone: 'error' });
    }
  };

  return (
    <div className="screen invite-screen" data-mood={room.room?.kind ?? 'other'}>
      <TopBar onBack={back} />

      <motion.div
        className="gutter stack invite-screen__body"
        variants={listVariants}
        initial="initial"
        animate="animate"
      >
        <motion.div className="invite-hero" variants={itemVariants}>
          <motion.span
            className="invite-hero__badge"
            initial={{ scale: 0.4, rotate: -14 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={spring.bouncy}
          >
            {room.room?.emoji || mood.emoji}
          </motion.span>
          <h1 className="t-h1">Bring your people in</h1>
          <p className="t-sm muted">
            {room.room?.name ?? 'Your room'} is private. Only people with this link get in.
          </p>
        </motion.div>

        <motion.button
          className="invite-code"
          variants={itemVariants}
          onClick={copyCode}
          whileTap={{ scale: 0.98 }}
          transition={spring.snappy}
        >
          <span className="t-micro muted">Room code</span>
          <span className="invite-code__value">{code}</span>
          <span className="t-xs faint">Tap to copy</span>
        </motion.button>

        <motion.div className="stack invite-actions" variants={itemVariants}>
          <motion.button className="btn btn--primary btn--block" onClick={share} {...pressable}>
            🔗 Share invite link
          </motion.button>

          <motion.button
            className="btn btn--soft btn--block"
            onClick={() => {
              haptic('light');
              setShowQr((v) => !v);
            }}
            {...pressable}
          >
            {showQr ? 'Hide QR code' : '📷 Show QR code'}
          </motion.button>

          <motion.button
            className="btn btn--soft btn--block"
            onClick={() =>
              window.open(
                `sms:?&body=${encodeURIComponent(
                  `Join ${room.room?.name ?? 'my room'} on Chai Time: ${link}`
                )}`,
                '_self'
              )
            }
            {...pressable}
          >
            💬 Invite from contacts
          </motion.button>
        </motion.div>

        {showQr && (
          <motion.div
            className="invite-qr"
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={spring.bouncy}
          >
            <canvas ref={canvasRef} width={220} height={220} />
            <p className="t-xs muted">Point a camera at this</p>
          </motion.div>
        )}

        {room.members.length > 0 && (
          <motion.div className="invite-people" variants={itemVariants}>
            <p className="t-xs muted">Already here</p>
            <div className="invite-people__row">
              {room.members.slice(0, 6).map((member) => (
                <Avatar
                  key={String(member.id)}
                  name={member.displayName}
                  src={member.avatarUrl}
                  size={38}
                />
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>

      <div className="sticky-foot gutter">
        <motion.button
          className="btn btn--ink btn--block"
          onClick={() => go({ name: 'room', code }, { replace: true })}
          {...pressable}
        >
          Go to the room
        </motion.button>
      </div>
    </div>
  );
}
