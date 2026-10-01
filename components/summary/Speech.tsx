"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LANG_INFO, type SummaryLang } from "@/lib/languages";
import { findVoice, speechChunks } from "@/lib/speech";

type Status = "idle" | "speaking" | "paused";
/** Why reading aloud couldn't start. "noVoice" offers an Urdu voice instead when the phone has one. */
type Problem = { kind: "unsupported" } | { kind: "noVoice"; lang: SummaryLang; urduAvailable: boolean; text: string; id: string };

type SpeechValue = {
  supported: boolean;
  status: Status;
  /** Which card (or "all") is being read. */
  current: string | null;
  problem: Problem | null;
  speak: (id: string, text: string, opts?: { useUrduVoice?: boolean }) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  dismissProblem: () => void;
};

const SpeechContext = createContext<SpeechValue | null>(null);

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length) return Promise.resolve(now);
  // Many Android phones fill the list a moment after the page loads.
  return new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener("voiceschanged", done);
      resolve(synth.getVoices());
    };
    synth.addEventListener("voiceschanged", done);
    setTimeout(done, 1500);
  });
}

/** Reads the summary aloud with the phone's own voices, one short piece at a time. */
export function SpeechProvider({ lang, rate, children }: { lang: SummaryLang; rate: number; children: ReactNode }) {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [current, setCurrent] = useState<string | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const session = useRef(0);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      session.current++;
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    session.current++;
    window.speechSynthesis?.cancel();
    setStatus("idle");
    setCurrent(null);
  }, []);

  // Changing language mid-sentence would sound wrong: stop instead.
  useEffect(() => stop, [lang, stop]);

  const speak = useCallback(
    async (id: string, text: string, opts?: { useUrduVoice?: boolean }) => {
      if (!("speechSynthesis" in window)) return setProblem({ kind: "unsupported" });
      const synth = window.speechSynthesis;
      synth.cancel();
      const mine = ++session.current;
      setProblem(null);

      const voices = await loadVoices();
      if (mine !== session.current) return;
      const voice = findVoice(voices, opts?.useUrduVoice ? LANG_INFO.ur.voices : LANG_INFO[lang].voices);
      if (!voice) {
        setStatus("idle");
        setCurrent(null);
        return setProblem({ kind: "noVoice", lang, urduAvailable: lang !== "ur" && LANG_INFO[lang].dir === "rtl" && !!findVoice(voices, LANG_INFO.ur.voices), text, id });
      }

      const chunks = speechChunks(text);
      setCurrent(id);
      setStatus("speaking");
      const next = (i: number) => {
        if (mine !== session.current) return;
        if (i >= chunks.length) {
          setStatus("idle");
          setCurrent(null);
          return;
        }
        const u = new SpeechSynthesisUtterance(chunks[i]);
        u.voice = voice;
        u.lang = voice.lang;
        u.rate = rate;
        u.onend = () => next(i + 1);
        u.onerror = (e) => {
          // "interrupted"/"canceled" happen when the person presses Stop.
          if (e.error !== "interrupted" && e.error !== "canceled") next(i + 1);
        };
        synth.speak(u);
      };
      next(0);
    },
    [lang, rate],
  );

  const pause = useCallback(() => {
    window.speechSynthesis?.pause();
    setStatus("paused");
  }, []);
  const resume = useCallback(() => {
    window.speechSynthesis?.resume();
    setStatus("speaking");
  }, []);
  const dismissProblem = useCallback(() => setProblem(null), []);

  const value = useMemo(
    () => ({ supported, status, current, problem, speak, pause, resume, stop, dismissProblem }),
    [supported, status, current, problem, speak, pause, resume, stop, dismissProblem],
  );
  return <SpeechContext.Provider value={value}>{children}</SpeechContext.Provider>;
}

/** Outside a SpeechProvider (e.g. on other pages) reading aloud is simply unavailable. */
export function useSpeech(): SpeechValue | null {
  return useContext(SpeechContext);
}
