/**
 * Voice: recording, waveforms, and the shared audio context.
 *
 * A voice note is three things — a blob, a duration, and a shape. The shape is
 * computed once at record time and stored as a short string so every client can
 * draw the waveform instantly, without downloading the audio first.
 */

/** One base-36 character per bar: 36 levels is more than the eye resolves. */
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
export const WAVEFORM_BARS = 48;

let sharedContext: AudioContext | null = null;

export function audioContext(): AudioContext {
  if (!sharedContext) {
    const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
    sharedContext = new Ctor();
  }
  if (sharedContext.state === 'suspended') void sharedContext.resume();
  return sharedContext;
}

export function encodeWaveform(peaks: number[]): string {
  return peaks
    .map((p) => ALPHABET[Math.max(0, Math.min(35, Math.round(p * 35)))])
    .join('');
}

export function decodeWaveform(encoded: string): number[] {
  if (!encoded) return [];
  return [...encoded].map((ch) => {
    const index = ALPHABET.indexOf(ch);
    return index < 0 ? 0 : index / 35;
  });
}

/** A gently randomised placeholder so a missing waveform still looks like audio. */
export function placeholderWaveform(seed: string, bars = WAVEFORM_BARS): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return Array.from({ length: bars }, (_, i) => {
    hash = (hash * 1103515245 + 12345) >>> 0;
    const envelope = Math.sin((i / bars) * Math.PI);
    return 0.22 + ((hash % 1000) / 1000) * 0.55 * (0.5 + envelope * 0.5);
  });
}

/** Reduces decoded audio to `bars` normalised peaks. */
export async function waveformFrom(blob: Blob, bars = WAVEFORM_BARS): Promise<string> {
  try {
    const buffer = await blob.arrayBuffer();
    const decoded = await audioContext().decodeAudioData(buffer.slice(0));
    const channel = decoded.getChannelData(0);
    const chunk = Math.max(1, Math.floor(channel.length / bars));

    const peaks: number[] = [];
    let loudest = 0.0001;
    for (let i = 0; i < bars; i++) {
      let sum = 0;
      const start = i * chunk;
      for (let j = 0; j < chunk; j++) {
        const sample = channel[start + j] ?? 0;
        sum += sample * sample;
      }
      const rms = Math.sqrt(sum / chunk);
      loudest = Math.max(loudest, rms);
      peaks.push(rms);
    }
    // Normalise so a quiet recording still draws a full-height waveform.
    return encodeWaveform(peaks.map((p) => Math.min(1, p / loudest)));
  } catch {
    // Some browsers refuse to decode their own webm/opus. The note still plays;
    // it just gets a generated shape instead of a measured one.
    return encodeWaveform(placeholderWaveform(String(blob.size)));
  }
}

export function pickAudioMime(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

export interface Recording {
  blob: Blob;
  durationMs: number;
  waveform: string;
  mimeType: string;
}

/**
 * A press-and-hold recorder. `onLevel` fires ~20×/sec with the current input
 * level so the UI can pulse in time with the voice.
 */
export class VoiceRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private raf = 0;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  async start(onLevel?: (level: number) => void): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = pickAudioMime();
    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.chunks = [];
    this.recorder.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.recorder.start();
    this.startedAt = performance.now();

    if (onLevel) {
      const ctx = audioContext();
      this.source = ctx.createMediaStreamSource(this.stream);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.source.connect(this.analyser);
      const data = new Uint8Array(this.analyser.frequencyBinCount);

      const tick = () => {
        if (!this.analyser) return;
        this.analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        onLevel(Math.min(1, Math.sqrt(sum / data.length) * 3.2));
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    }
  }

  get elapsedMs(): number {
    return this.startedAt ? performance.now() - this.startedAt : 0;
  }

  async stop(): Promise<Recording | null> {
    const recorder = this.recorder;
    if (!recorder) return null;
    const durationMs = Math.round(this.elapsedMs);

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () =>
        resolve(new Blob(this.chunks, { type: recorder.mimeType || 'audio/webm' }));
      recorder.stop();
    });

    this.teardown();
    if (blob.size === 0) return null;
    return {
      blob,
      durationMs,
      waveform: await waveformFrom(blob),
      mimeType: blob.type,
    };
  }

  cancel(): void {
    try {
      this.recorder?.stop();
    } catch {
      /* already stopped */
    }
    this.teardown();
  }

  private teardown() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.source = null;
    this.analyser = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
    this.startedAt = 0;
  }
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
