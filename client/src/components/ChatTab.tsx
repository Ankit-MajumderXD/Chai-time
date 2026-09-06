/**
 * Chat, inside the room.
 *
 * Deliberately not a messaging app: the thread is anchored to the room, a
 * message can quote the moment it's about, and consecutive lines from one
 * person collapse into a run so the eye follows people rather than bubbles.
 */
import { memo, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar } from './Avatar';
import { VoiceNote } from './VoiceNote';
import { EmptyState } from './Feedback';
import { spring } from '../design/motion';
import { firstName, timeAgo } from '../lib/format';
import { formatDuration } from '../lib/audio';
import { debug } from '../lib/log';
import { useNow } from '../data/useNow';
import type { MessageView } from '../data/useRoom';

interface Props {
  messages: MessageView[];
  onOpenMedia: (mediaId: bigint) => void;
  onDelete: (messageId: bigint) => void;
  emptyAction: () => void;
}

export function ChatTab({ messages, onOpenMedia, onDelete, emptyAction }: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  const previousCount = useRef(messages.length);

  // Follow the conversation, but only when it grows — never yank the view while
  // someone is reading back.
  useEffect(() => {
    if (messages.length > previousCount.current) {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    previousCount.current = messages.length;
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <EmptyState
        art={<span className="empty__emoji">💬</span>}
        title="Say the first thing."
        body="Text, a photo, or hold the mic for a voice note. Everyone in the room sees it straight away."
        action={{ label: 'Share a moment instead', onClick: emptyAction }}
      />
    );
  }

  return (
    <div className="chat">
      <AnimatePresence initial={false}>
        {messages.map((view) => (
          <ChatRow key={String(view.message.id)} view={view} onOpenMedia={onOpenMedia} onDelete={onDelete} />
        ))}
      </AnimatePresence>
      <div ref={endRef} />
    </div>
  );
}

const ChatRow = memo(function ChatRow({
  view,
  onOpenMedia,
  onDelete,
}: {
  view: MessageView;
  onOpenMedia: (mediaId: bigint) => void;
  onDelete: (messageId: bigint) => void;
}) {
  const now = useNow(30_000);
  const { message, media, author, isMine, showAuthor, aboutMoment } = view;

  return (
    <motion.div
      className="chat-row"
      data-mine={isMine}
      data-run={!showAuthor}
      layout="position"
      initial={{ opacity: 0, y: 12, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={spring.gentle}
    >
      <div className="chat-row__gutter">
        {showAuthor && !isMine && (
          <Avatar
            name={author?.displayName ?? 'Someone'}
            src={author?.avatarUrl}
            size={30}
            presence={(author?.status as any) ?? null}
          />
        )}
      </div>

      <div className="chat-row__body">
        {showAuthor && (
          <div className="chat-row__meta">
            {!isMine && (
              <span className="chat-row__name">{firstName(author?.displayName ?? 'Someone')}</span>
            )}
            <span className="chat-row__time">{timeAgo(message.createdAt, now)}</span>
          </div>
        )}

        {aboutMoment && (
          <span className="chat-row__quote t-xs">
            ↩ on {aboutMoment.caption ? `“${aboutMoment.caption.slice(0, 38)}”` : 'a moment'}
          </span>
        )}

        {message.kind === 'voice' && media ? (
          <VoiceNote
            url={media.url}
            waveform={media.waveform}
            durationMs={media.durationMs}
            seed={String(message.id)}
            mine={isMine}
            onDelete={isMine ? () => onDelete(message.id) : undefined}
          />
        ) : media ? (
          <motion.button
            type="button"
            className="chat-media"
            onClick={() => onOpenMedia(media.id)}
            whileTap={{ scale: 0.98 }}
            aria-label={message.kind === 'video' ? 'Play video' : 'Open photo'}
          >
            {media.kind === 'video' ? (
              <>
                <video
                  src={media.url}
                  poster={media.posterUrl || undefined}
                  muted
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={(e) =>
                    debug('video', 'chat loadedmetadata', {
                      messageId: String(message.id),
                      w: e.currentTarget.videoWidth,
                      h: e.currentTarget.videoHeight,
                    })
                  }
                  onError={(e) =>
                    debug('video', 'chat ERROR', {
                      messageId: String(message.id),
                      code: e.currentTarget.error?.code,
                      message: e.currentTarget.error?.message,
                      mimeType: media.mimeType,
                      urlScheme: media.url.slice(0, media.url.indexOf(',') + 1) || media.url.slice(0, 24),
                      urlLen: media.url.length,
                    })
                  }
                />
                <span className="chat-media__play" aria-hidden>
                  ▶
                </span>
                {media.durationMs > 0 && (
                  <span className="chat-media__duration">{formatDuration(media.durationMs)}</span>
                )}
              </>
            ) : (
              <img src={media.url} alt={message.text || 'Shared photo'} loading="lazy" />
            )}
          </motion.button>
        ) : null}

        {message.text && <p className="chat-bubble">{message.text}</p>}

        {isMine && message.kind !== 'voice' && (
          <button
            type="button"
            className="chat-row__remove t-micro"
            onClick={() => onDelete(message.id)}
            aria-label="Delete this message"
          >
            Remove
          </button>
        )}
      </div>
    </motion.div>
  );
});
