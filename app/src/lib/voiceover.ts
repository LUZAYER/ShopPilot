// src/lib/voiceover.ts
// Browser-only Web Speech API wrapper for the promotional video.
// Speaks a scene's narration in Bangla (preferred) or English fallback.

import type { Scene } from "./video-renderer";

export type Lang = "bn" | "en";

let cachedVoices: SpeechSynthesisVoice[] = [];

/** Load voices (some browsers populate async). */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return Promise.resolve([]);
  }
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const got = () => {
      cachedVoices = synth.getVoices();
      resolve(cachedVoices);
    };
    const v = synth.getVoices();
    if (v && v.length > 0) {
      cachedVoices = v;
      resolve(cachedVoices);
      return;
    }
    synth.onvoiceschanged = got;
    // safety timeout
    setTimeout(got, 800);
  });
}

/** Pick the best voice for the requested language. */
export function pickVoice(lang: Lang, voices: SpeechSynthesisVoice[] = cachedVoices): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  // 1. Exact match: bn-BD or bn-IN or bn-*
  if (lang === "bn") {
    const exact = voices.find((v) => /^bn[-_]/i.test(v.lang));
    if (exact) return exact;
  }
  // 2. Locale match: en-US
  const langPrefix = lang === "bn" ? "bn" : "en";
  const prefixMatch = voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));
  if (prefixMatch) return prefixMatch;
  // 3. Google / Microsoft preferred
  const premium = voices.find((v) => /google|microsoft|natural|neural/i.test(v.name) && v.lang.toLowerCase().startsWith(langPrefix));
  if (premium) return premium;
  // 4. First voice whose lang starts with the prefix
  return prefixMatch ?? voices[0] ?? null;
}

/** Speak a single line. Resolves when the utterance ends (or is cancelled). */
export function speak(text: string, lang: Lang = "en", opts: { rate?: number; pitch?: number; volume?: number } = {}): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    try { synth.cancel(); } catch {}
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "bn" ? "bn-BD" : "en-US";
    u.rate = opts.rate ?? 1.0;
    u.pitch = opts.pitch ?? 1.0;
    u.volume = opts.volume ?? 1.0;
    const v = pickVoice(lang);
    if (v) u.voice = v;
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    u.onend = finish;
    u.onerror = finish;
    // hard cap so a stuck utterance never blocks the timeline
    const ms = Math.max(2000, text.length * 80);
    setTimeout(finish, ms + 500);
    synth.speak(u);
  });
}

/** Speak an entire scene's narration (Bangla preferred, English fallback). */
export function speakScene(scene: Scene, lang: Lang = "en"): Promise<void> {
  const text = lang === "bn" ? scene.voiceoverBn : scene.voiceoverEn;
  // Bangla voice is sparse on most desktops; if not available, use English.
  const effective: Lang = lang === "bn" && !pickVoice("bn") ? "en" : lang;
  return speak(text, effective, { rate: 0.98, pitch: 1.0 });
}

/** Cancel any in-flight speech. */
export function stopSpeaking() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try { window.speechSynthesis.cancel(); } catch {}
}

/** Test whether a Bangla voice is actually installed. */
export function hasBanglaVoice(): boolean {
  return !!pickVoice("bn");
}
