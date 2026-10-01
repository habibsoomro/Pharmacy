"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";

/** Tells people straight away when the phone loses internet, and when it comes back. */
export function OfflineBanner() {
  const { t } = useI18n();
  const [state, setState] = useState<"online" | "offline" | "back">("online");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const offline = () => {
      clearTimeout(timer);
      setState("offline");
    };
    const online = () => {
      setState((s) => (s === "offline" ? "back" : s));
      timer = setTimeout(() => setState("online"), 3000);
    };
    if (!navigator.onLine) offline();
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, []);

  if (state === "online") return null;
  return (
    <div role="status" className={`no-print sticky top-0 z-40 px-4 py-2 text-center text-sm font-semibold ${state === "offline" ? "bg-amber-600 text-white" : "bg-emerald-600 text-white"}`}>
      {state === "offline" ? t.errors.offline : t.errors.online}
    </div>
  );
}
