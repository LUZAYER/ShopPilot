// src/lib/video-encoder.ts
// Browser-only MediaRecorder helper: captures a canvas stream (with optional
// audio track) and produces a webm Blob the page can download.

export interface EncoderOptions {
  fps?: number;
  bitsPerSecond?: number;
  mimeType?: string;
}

const DEFAULT_MIME_TYPES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

export function pickMimeType(): string {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return "";
  for (const t of DEFAULT_MIME_TYPES) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t;
    } catch {
      // ignore
    }
  }
  return "";
}

export interface RecordingHandle {
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
  promise: Promise<Blob>;
  stop: () => void;
}

/** Start a recording of the given canvas (and optional audio stream). */
export function startRecording(
  canvas: HTMLCanvasElement,
  audioStream: MediaStream | null,
  opts: EncoderOptions = {},
): RecordingHandle {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    throw new Error("MediaRecorder is not available in this environment.");
  }
  const fps = opts.fps ?? 30;
  const canvasStream = (canvas as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream }).captureStream
    ? canvas.captureStream(fps)
    : (canvas as unknown as { mozCaptureStream?: (fps: number) => MediaStream }).mozCaptureStream!(fps);

  // Merge audio tracks
  if (audioStream) {
    audioStream.getAudioTracks().forEach((t) => canvasStream.addTrack(t));
  }

  const mimeType = opts.mimeType ?? pickMimeType();
  const recorder = new MediaRecorder(canvasStream, {
    mimeType: mimeType || undefined,
    bitsPerSecond: opts.bitsPerSecond ?? 4_000_000,
  });
  const chunks: Blob[] = [];
  let resolveDone: (b: Blob) => void = () => {};
  const promise = new Promise<Blob>((resolve) => {
    resolveDone = resolve;
  });
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: mimeType || "video/webm" });
    resolveDone(blob);
  };
  recorder.onerror = (e) => {
    // eslint-disable-next-line no-console
    console.error("MediaRecorder error", e);
  };
  recorder.start(250);
  return {
    recorder,
    stream: canvasStream,
    chunks,
    promise,
    stop: () => {
      if (recorder.state !== "inactive") recorder.stop();
    },
  };
}

/** Create an AudioContext that the caller can route a TTS / media stream into. */
export function createAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor: typeof AudioContext | undefined =
    (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  return new Ctor();
}

/** Trigger a browser download for a Blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // free the object URL after a tick
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Format bytes for display. */
export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** Format seconds as M:SS. */
export function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
