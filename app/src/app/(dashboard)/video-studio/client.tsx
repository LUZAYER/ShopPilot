"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SCENES, TOTAL_DURATION, W, H, sceneAt, type Scene, type SceneId,
} from "@/lib/video-renderer";
import { loadVoices, pickVoice, speak, speakScene, stopSpeaking, hasBanglaVoice, type Lang } from "@/lib/voiceover";
import { startRecording, pickMimeType, downloadBlob, fmtBytes, fmtTime, createAudioContext } from "@/lib/video-encoder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Play, Pause, Square, Download, RefreshCw, Volume2, VolumeX, Mic,
  Film, Sparkles, Check, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Phase = "idle" | "preview" | "recording" | "rendering" | "done" | "error";

const PHASE_LABEL: Record<Phase, { en: string; bn: string }> = {
  idle:      { en: "Ready",         bn: "প্রস্তুত" },
  preview:   { en: "Previewing",    bn: "প্রিভিউ" },
  recording: { en: "Recording",     bn: "রেকর্ডিং" },
  rendering: { en: "Rendering",     bn: "রেন্ডারিং" },
  done:      { en: "Done",          bn: "সম্পন্ন" },
  error:     { en: "Error",         bn: "ত্রুটি" },
};

export function VideoStudioClient() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewTimer = useRef<number | null>(null);
  const recordHandle = useRef<ReturnType<typeof startRecording> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAt = useRef<number>(0);
  const sceneStart = useRef<number>(0);

  const [phase, setPhase] = useState<Phase>("idle");
  const [time, setTime] = useState(0);              // seconds into timeline
  const [sceneIdx, setSceneIdx] = useState(0);
  const [lang, setLang] = useState<Lang>("en");
  const [voiceOn, setVoiceOn] = useState(true);
  const [bnVoiceAvailable, setBnVoiceAvailable] = useState(false);
  const [progress, setProgress] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState("");

  // ------- bootstrap -------
  useEffect(() => {
    setMimeType(pickMimeType());
    loadVoices().then(() => setBnVoiceAvailable(hasBanglaVoice()));
  }, []);

  // ------- preview loop (animation only, no recording) -------
  const drawFrame = useCallback((seconds: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { scene, localT } = sceneAt(seconds);
    scene.draw(ctx, clamp01(localT));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;
    // first paint
    drawFrame(0);
  }, [drawFrame]);

  // preview tick
  useEffect(() => {
    if (phase !== "preview") return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setTime((t) => {
        const next = t + dt;
        if (next >= TOTAL_DURATION) {
          stopPreview();
          return TOTAL_DURATION;
        }
        drawFrame(next);
        // update scene index
        const { index } = sceneAt(next);
        setSceneIdx(index);
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, drawFrame]);

  // ------- controls -------
  const stopPreview = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setPhase("idle");
  }, []);

  const startPreview = useCallback(() => {
    if (phase === "preview") return;
    setTime(0);
    setSceneIdx(0);
    setPhase("preview");
  }, [phase]);

  const stopAll = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    stopSpeaking();
    if (recordHandle.current) {
      recordHandle.current.stop();
      recordHandle.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setPhase("idle");
  }, []);

  // ------- recording -------
  const generateVideo = useCallback(async () => {
    setError(null);
    setBlob(null);
    if (recordingUrl) { URL.revokeObjectURL(recordingUrl); setRecordingUrl(null); }

    const canvas = canvasRef.current;
    if (!canvas) return;

    if (typeof MediaRecorder === "undefined") {
      setError("MediaRecorder is not supported in this browser. Try Chrome/Edge.");
      setPhase("error");
      return;
    }

    setPhase("rendering");
    setProgress(0);

    // setup audio context + media-stream destination (silent stream — TTS plays through speakers, we record silence track)
    const audioCtx = createAudioContext();
    audioCtxRef.current = audioCtx;
    let audioStream: MediaStream | null = null;
    if (audioCtx) {
      const dest = audioCtx.createMediaStreamDestination();
      // route nothing — but the destination node is needed to attach a track
      audioStream = dest.stream;
    }

    // prime voices before we start (so the first utterance is not cut off)
    await loadVoices();
    setBnVoiceAvailable(hasBanglaVoice());

    // start the recorder FIRST so we don't miss frames
    const handle = startRecording(canvas, audioStream, { fps: 30 });
    recordHandle.current = handle;
    setPhase("recording");
    startedAt.current = performance.now();
    sceneStart.current = performance.now();

    // start an offline animation loop that drives the canvas at 30fps
    let frame = 0;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // speak first scene immediately (overlap a bit)
    let speaking = false;
    const speakNext = (scene: Scene) => {
      if (!voiceOn) return;
      speaking = true;
      speakScene(scene, lang)
        .catch(() => {})
        .finally(() => { speaking = false; });
    };

    // pre-speak scene 0 at start
    speakNext(SCENES[0]);

    let currentIdx = 0;
    const loop = () => {
      const now = performance.now();
      const elapsed = (now - startedAt.current) / 1000;
      if (elapsed >= TOTAL_DURATION) {
        // done
        return finish();
      }
      // which scene
      let acc = 0;
      let idx = 0;
      for (let i = 0; i < SCENES.length; i++) {
        if (elapsed < acc + SCENES[i].durationSec) { idx = i; break; }
        acc += SCENES[i].durationSec;
        idx = i;
      }
      const localT = (elapsed - acc) / SCENES[idx].durationSec;
      // draw
      SCENES[idx].draw(ctx, clamp01(localT));
      // ui updates
      setTime(elapsed);
      setSceneIdx(idx);
      setProgress(elapsed / TOTAL_DURATION);

      // kick off the next scene's voiceover at the transition
      if (idx !== currentIdx) {
        currentIdx = idx;
        if (voiceOn) speakNext(SCENES[idx]);
      }

      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    const finish = async () => {
      cancelAnimationFrame(frame);
      stopSpeaking();
      handle.stop();
      const result = await handle.promise;
      setBlob(result);
      const url = URL.createObjectURL(result);
      setRecordingUrl(url);
      setProgress(1);
      setPhase("done");
      if (audioCtx && audioCtx.state !== "closed") {
        audioCtx.close().catch(() => {});
      }
      recordHandle.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOn, lang]);

  // ------- download -------
  const handleDownload = useCallback(() => {
    if (!blob) return;
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    downloadBlob(blob, `shoppilot-promo-${ts}.webm`);
  }, [blob]);

  // ------- export as MP4 (server-side ffmpeg transcode) -------
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const handleExportMp4 = useCallback(async () => {
    if (!blob) return;
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch("/api/video/export", {
        method: "POST",
        headers: { "Content-Type": blob.type || "video/webm" },
        body: blob
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Server returned ${res.status}: ${errText.slice(0, 200)}`);
      }
      const transcodeFailed = res.headers.get("X-Transcode-Failed") === "true";
      const out = await res.blob();
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const ext = transcodeFailed ? "webm" : "mp4";
      const ct = transcodeFailed ? "video/webm" : "video/mp4";
      downloadBlob(new Blob([out], { type: ct }), `shoppilot-promo-${ts}.${ext}`);
      if (transcodeFailed) {
        setExportError("ffmpeg not available — downloaded as WebM");
      }
    } catch (e) {
      setExportError(String(e instanceof Error ? e.message : e));
    } finally {
      setExporting(false);
    }
  }, [blob]);

  // ------- seek -------
  const seekTo = useCallback((s: number) => {
    setTime(s);
    setSceneIdx(sceneAt(s).index);
    drawFrame(s);
  }, [drawFrame]);

  const phaseLabel = PHASE_LABEL[phase];

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Film className="h-6 w-6 text-cyan-500" />
            <h1 className="text-2xl font-bold text-gray-900">Video Studio</h1>
            <Badge variant="secondary">ভিডিও স্টুডিও</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Generate a 3-minute promotional video — in your browser, no server required.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={phase === "recording" ? "default" : "outline"} className="text-xs">
            {phaseLabel.en} · {phaseLabel.bn}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {SCENES.length} scenes · {fmtTime(TOTAL_DURATION)} total
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* main preview */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-base">Preview</CardTitle>
                <CardDescription>1920×1080 · 30fps</CardDescription>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant={phase === "preview" ? "secondary" : "outline"}
                  onClick={phase === "preview" ? stopPreview : startPreview}
                  disabled={phase === "recording"}
                >
                  {phase === "preview" ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Preview</>}
                </Button>
                <Button
                  size="sm"
                  onClick={generateVideo}
                  disabled={phase === "recording" || phase === "rendering"}
                  className="bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-600 hover:to-violet-600"
                >
                  {phase === "recording" || phase === "rendering" ? (
                    <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Recording…</>
                  ) : (
                    <><Sparkles className="h-3.5 w-3.5" /> Generate Video</>
                  )}
                </Button>
                {(phase === "recording" || phase === "rendering" || phase === "preview") && (
                  <Button size="sm" variant="ghost" onClick={stopAll}>
                    <Square className="h-3.5 w-3.5" /> Stop
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative w-full bg-black rounded-lg overflow-hidden aspect-video shadow-inner">
              <canvas
                ref={canvasRef}
                className="w-full h-full"
                style={{ display: "block" }}
              />
              {/* overlay scene label */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-white text-xs">
                <span className="bg-black/50 backdrop-blur px-2 py-1 rounded">
                  {SCENES[sceneIdx]?.title} · {SCENES[sceneIdx]?.bn}
                </span>
                <span className="bg-black/50 backdrop-blur px-2 py-1 rounded tabular-nums">
                  {fmtTime(time)} / {fmtTime(TOTAL_DURATION)}
                </span>
              </div>
              {/* progress bar */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-violet-400 transition-all"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            </div>

            {/* timeline scrubber */}
            <div className="mt-3">
              <input
                type="range"
                min={0}
                max={TOTAL_DURATION}
                step={0.1}
                value={time}
                onChange={(e) => seekTo(parseFloat(e.target.value))}
                disabled={phase === "recording"}
                className="w-full accent-cyan-500"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                {SCENES.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => seekTo(SCENES.slice(0, i).reduce((a, c) => a + c.durationSec, 0))}
                    className={cn("hover:text-cyan-600 transition-colors", sceneIdx === i && "text-cyan-600 font-semibold")}
                  >
                    {i + 1}.{s.title.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* error */}
            {error && (
              <div className="mt-3 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* download */}
            {phase === "done" && blob && recordingUrl && (
              <div className="mt-4 p-4 rounded-md bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-sm font-semibold text-green-900 flex items-center gap-1">
                      <Check className="h-4 w-4" /> Video ready!
                    </p>
                    <p className="text-xs text-green-700 mt-0.5">
                      {fmtBytes(blob.size)} · {mimeType || "video/webm"} · {fmtTime(TOTAL_DURATION)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={recordingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-green-300 bg-white px-3 text-sm font-medium text-green-700 hover:bg-green-50"
                    >
                      <ChevronRight className="h-3.5 w-3.5" /> Open
                    </a>
                    <Button size="sm" onClick={handleDownload} className="bg-green-600 hover:bg-green-700">
                      <Download className="h-3.5 w-3.5" /> .webm
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleExportMp4}
                      disabled={exporting}
                      className="bg-blue-600 hover:bg-blue-700"
                      title="Transcode to MP4 on the server (ffmpeg)"
                    >
                      {exporting ? (
                        <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Exporting…</>
                      ) : (
                        <><Film className="h-3.5 w-3.5" /> Export .mp4</>
                      )}
                    </Button>
                  </div>
                </div>
                {exportError && (
                  <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    {exportError}
                  </p>
                )}
                <video
                  src={recordingUrl}
                  controls
                  className="mt-3 w-full max-h-72 rounded"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* settings + scene list */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Voiceover</span>
                <Button size="sm" variant={voiceOn ? "default" : "outline"} onClick={() => setVoiceOn((v) => !v)}>
                  {voiceOn ? <><Volume2 className="h-3.5 w-3.5" /> On</> : <><VolumeX className="h-3.5 w-3.5" /> Off</>}
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <span>Language</span>
                <div className="flex gap-1">
                  <Button size="sm" variant={lang === "en" ? "default" : "outline"} onClick={() => setLang("en")}>EN</Button>
                  <Button
                    size="sm"
                    variant={lang === "bn" ? "default" : "outline"}
                    onClick={() => setLang("bn")}
                    disabled={!bnVoiceAvailable}
                    title={bnVoiceAvailable ? "Bangla voice ready" : "No Bangla voice installed — install a bn-BD system voice for Bangla narration"}
                  >
                    বাংলা
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Mic className="h-3 w-3" /> Bangla voice</span>
                <span className={bnVoiceAvailable ? "text-green-600" : "text-amber-600"}>
                  {bnVoiceAvailable ? "available" : "not installed"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground pt-2 border-t">
                <p>Codec: <code className="bg-muted px-1 rounded">{mimeType || "video/webm"}</code></p>
                <p className="mt-1">Tip: Use Chrome or Edge for best results. Speak test audio is mixed into the recording track.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Scene Timeline</CardTitle>
              <CardDescription>{SCENES.length} scenes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 max-h-96 overflow-auto">
              {SCENES.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => seekTo(SCENES.slice(0, i).reduce((a, c) => a + c.durationSec, 0))}
                  className={cn(
                    "w-full text-left p-2 rounded text-xs transition-colors flex items-center justify-between gap-2",
                    sceneIdx === i ? "bg-cyan-50 border border-cyan-200" : "hover:bg-gray-50",
                  )}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center font-semibold shrink-0">
                      {i + 1}
                    </span>
                    <span className="truncate">
                      <span className="font-medium text-gray-900">{s.title}</span>
                      <span className="text-muted-foreground ml-1">· {s.bn}</span>
                    </span>
                  </span>
                  <span className="text-muted-foreground shrink-0 tabular-nums">{s.durationSec}s</span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }
