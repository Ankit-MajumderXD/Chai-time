/**
 * The media pipeline.
 *
 * Bytes never go into a SpacetimeDB row. This module turns a Blob into a
 * *reference* — a URL plus the metadata the UI needs to lay the media out
 * before it loads — and the reducers store only that.
 *
 * Two backends, one interface:
 *
 *   production   VITE_MEDIA_UPLOAD_URL points at a presigning endpoint. We ask
 *                for a signed PUT, upload the bytes to object storage (R2/S3),
 *                and keep the returned public URL.
 *   local dev    No endpoint configured, so the URL is a data URL. Same row
 *                shape, same reducers, same UI — only this function changes.
 */

import { debug } from './log';

export type MediaKind = 'photo' | 'video' | 'voice';

export interface MediaRef {
  kind: MediaKind;
  url: string;
  /** Video only: a still frame (JPEG data URL) to show before the clip plays. */
  posterUrl: string;
  mimeType: string;
  width: number;
  height: number;
  durationMs: number;
  sizeBytes: number;
  /** Voice only: one base-36 character per waveform bar. */
  waveform: string;
}

/** The "no media" reference, for text-only moments and messages. */
export const NO_MEDIA: MediaRef = {
  kind: 'photo',
  url: '',
  posterUrl: '',
  mimeType: '',
  width: 0,
  height: 0,
  durationMs: 0,
  sizeBytes: 0,
  waveform: '',
};

const PRESIGN_ENDPOINT = import.meta.env.VITE_MEDIA_UPLOAD_URL as string | undefined;

/** Data URLs travel through the database, so keep them phone-sized. */
export const MAX_INLINE_BYTES = 3_200_000;
const MAX_PHOTO_EDGE = 1280;

export function usingObjectStorage(): boolean {
  return !!PRESIGN_ENDPOINT;
}

export async function putMedia(
  blob: Blob,
  kind: MediaKind,
  meta: Partial<MediaRef> = {}
): Promise<MediaRef> {
  const url = PRESIGN_ENDPOINT ? await uploadToStore(blob, kind) : await toDataUrl(blob);
  const ref = {
    ...NO_MEDIA,
    ...meta,
    kind,
    url,
    mimeType: blob.type || meta.mimeType || '',
    sizeBytes: blob.size,
  };
  debug('media', 'putMedia', {
    kind,
    blobType: blob.type || '(none)',
    blobSize: blob.size,
    urlScheme: url.slice(0, url.indexOf(',') + 1) || url.slice(0, 24),
    urlLen: url.length,
    tooBig: !usingObjectStorage() && url.length > MAX_INLINE_BYTES,
  });
  return ref;
}

async function uploadToStore(blob: Blob, kind: MediaKind): Promise<string> {
  const res = await fetch(PRESIGN_ENDPOINT!, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind, mime: blob.type, size: blob.size }),
  });
  if (!res.ok) throw new Error("We couldn't reach storage — try again in a moment.");
  const { uploadUrl, publicUrl } = await res.json();
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'content-type': blob.type },
  });
  if (!put.ok) throw new Error('That upload did not go through.');
  return publicUrl;
}

export function toDataUrl(blob: Blob): Promise<string> {
  // A data URL's media type ends at the first comma, so a MediaRecorder blob
  // typed `video/webm;codecs=vp9,opus` produces `data:video/webm;codecs=vp9,`
  // followed by `opus;base64,...` as the *data* — an unplayable file. Re-wrap
  // with just the container type; a data URL doesn't need the codec list.
  const source =
    blob.type && blob.type.includes(';')
      ? new Blob([blob], { type: blob.type.split(';')[0].trim() })
      : blob;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("We couldn't read that file."));
    reader.readAsDataURL(source);
  });
}

/* ------------------------------------------------------------- Processing -- */

/** Downscales a photo and reads its final dimensions. */
export async function preparePhoto(source: Blob | HTMLVideoElement, mirror = false) {
  const bitmapWidth = source instanceof HTMLVideoElement ? source.videoWidth : 0;
  const bitmapHeight = source instanceof HTMLVideoElement ? source.videoHeight : 0;

  let draw: CanvasImageSource;
  let width: number;
  let height: number;

  if (source instanceof HTMLVideoElement) {
    draw = source;
    width = bitmapWidth;
    height = bitmapHeight;
  } else {
    const bitmap = await createImageBitmap(source);
    draw = bitmap;
    width = bitmap.width;
    height = bitmap.height;
  }

  const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("This browser wouldn't give us a canvas.");

  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(draw, 0, 0, canvas.width, canvas.height);
  if ('close' in draw && typeof (draw as ImageBitmap).close === 'function') {
    (draw as ImageBitmap).close();
  }

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("That photo didn't save."))),
      'image/jpeg',
      0.74
    )
  );

  return { blob, width: canvas.width, height: canvas.height };
}

/** Reads a video's duration and frame size without decoding the whole file. */
export function probeVideo(url: string): Promise<{ durationMs: number; width: number; height: number }> {
  return new Promise((resolve) => {
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.muted = true;
    const done = () => {
      const out = {
        durationMs: Number.isFinite(el.duration) ? Math.round(el.duration * 1000) : 0,
        width: el.videoWidth || 0,
        height: el.videoHeight || 0,
      };
      debug('media', 'probeVideo ok', out);
      resolve(out);
    };
    el.onloadedmetadata = done;
    el.onerror = () => {
      debug('media', 'probeVideo FAILED', {
        code: el.error?.code,
        message: el.error?.message,
        urlScheme: url.slice(0, url.indexOf(',') + 1) || url.slice(0, 24),
      });
      resolve({ durationMs: 0, width: 0, height: 0 });
    };
    el.src = url;
  });
}

/**
 * Grabs a still frame from a video so the UI has a poster to show before the
 * clip is tapped. Without this a video has no thumbnail at all — an `<img>`
 * pointed at the video URL just renders the broken-image icon. Best-effort:
 * any failure (a codec the canvas can't read, a tainted cross-origin frame,
 * a slow decode) resolves to '' and the caller falls back to the bare
 * `<video>` element.
 */
export function capturePoster(url: string): Promise<string> {
  return new Promise((resolve) => {
    const el = document.createElement('video');
    el.preload = 'auto';
    el.muted = true;
    el.playsInline = true;
    el.crossOrigin = 'anonymous';
    let settled = false;
    const finish = (poster: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      el.removeAttribute('src');
      el.load();
      debug('media', 'capturePoster', { ok: !!poster, posterLen: poster.length });
      resolve(poster);
    };
    const timer = setTimeout(() => finish(''), 4000);

    const grab = async () => {
      try {
        if (!el.videoWidth) return finish('');
        const { blob } = await preparePhoto(el);
        finish(await toDataUrl(blob));
      } catch (err) {
        debug('media', 'capturePoster FAILED', { message: (err as Error)?.message });
        finish('');
      }
    };

    el.onloadeddata = () => {
      const target = Math.min(0.1, (el.duration || 1) / 2);
      if (el.currentTime < target && Number.isFinite(target)) {
        el.onseeked = grab;
        try {
          el.currentTime = target;
        } catch {
          void grab();
        }
      } else {
        void grab();
      }
    };
    el.onerror = () => finish('');
    el.src = url;
  });
}

export function tooBig(ref: MediaRef): boolean {
  return !usingObjectStorage() && ref.url.length > MAX_INLINE_BYTES;
}

/**
 * Turns a file the user picked into a media reference: photos are downscaled,
 * videos are probed for duration and frame size. One call, both paths.
 */
export async function prepareFile(file: File): Promise<MediaRef> {
  if (file.type.startsWith('video')) {
    const ref = await putMedia(file, 'video', { mimeType: file.type });
    const probe = await probeVideo(ref.url);
    const posterUrl = await capturePoster(ref.url);
    return { ...ref, ...probe, posterUrl };
  }
  const { blob, width, height } = await preparePhoto(file);
  return putMedia(blob, 'photo', { width, height });
}

/** The still image to show for a media ref: a video's poster, a photo itself. */
export function stillUrl(media: { kind: string; url: string; posterUrl: string }): string {
  if (media.kind === 'voice') return '';
  return media.kind === 'video' ? media.posterUrl : media.url;
}
