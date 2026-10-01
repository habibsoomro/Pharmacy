"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_SETTINGS, TEXT_SCALE, loadSettings, saveSettings, type Settings } from "@/lib/settings";

type SettingsValue = {
  settings: Settings;
  /** false until the saved settings have been read from the phone. */
  loaded: boolean;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
};

const SettingsContext = createContext<SettingsValue | null>(null);

function applyTheme(theme: Settings["theme"]) {
  const dark = theme === "dark" || (theme === "auto" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

/** Keeps the person's settings, saves them on the phone, and applies theme and text size to the page. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    applyTheme(settings.theme);
    document.documentElement.style.setProperty("--text-scale", String(TEXT_SCALE[settings.textSize]));
    if (settings.theme !== "auto") return;
    // "Automatic" follows the phone's own light/dark setting, even while the page is open.
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("auto");
    mq?.addEventListener("change", onChange);
    return () => mq?.removeEventListener("change", onChange);
  }, [loaded, settings.theme, settings.textSize]);

  // Printing always uses the light theme.
  useEffect(() => {
    let before: string | undefined;
    const toLight = () => {
      before = document.documentElement.dataset.theme;
      document.documentElement.dataset.theme = "light";
    };
    const restore = () => {
      if (before) document.documentElement.dataset.theme = before;
    };
    window.addEventListener("beforeprint", toLight);
    window.addEventListener("afterprint", restore);
    return () => {
      window.removeEventListener("beforeprint", toLight);
      window.removeEventListener("afterprint", restore);
    };
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    saveSettings(DEFAULT_SETTINGS);
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const value = useMemo(() => ({ settings, loaded, update, reset, open, setOpen }), [settings, loaded, update, reset, open]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings must be used inside <SettingsProvider>");
  return value;
}
