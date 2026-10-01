"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/components/I18nProvider";
import { useSettings } from "@/components/SettingsProvider";
import { applySiteLocale } from "@/components/LanguageSwitcher";
import { CheckIcon, CloseIcon } from "@/components/icons";
import { fmt } from "@/lib/format";
import { LANG_INFO, SUMMARY_LANGS, isSiteLocale, scriptClass, type SummaryLang } from "@/lib/languages";
import { HIDEABLE_CARDS, type HideableCard, type Settings } from "@/lib/settings";
import { clearTranslations } from "@/lib/client/translate";

/** The Settings panel: a sheet that slides up from the bottom on phones, a box in the middle on bigger screens. */
export function SettingsDialog() {
  const { t, locale } = useI18n();
  const { settings, update, reset, open, setOpen } = useSettings();
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [done, setDone] = useState<"translations" | "reset" | null>(null);
  const s = t.settings;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => setDone(null), 2500);
    return () => clearTimeout(id);
  }, [done]);

  const current: SummaryLang = settings.summaryLang ?? locale;

  function chooseLanguage(lang: SummaryLang) {
    if (isSiteLocale(lang)) {
      update({ summaryLang: null });
      if (lang !== locale) {
        applySiteLocale(lang);
        router.refresh();
      }
    } else {
      update({ summaryLang: lang });
    }
  }

  function toggleCard(card: HideableCard, on: boolean) {
    const hidden = new Set(settings.hiddenCards);
    if (on) hidden.delete(card);
    else hidden.add(card);
    update({ hiddenCards: HIDEABLE_CARDS.filter((c) => hidden.has(c)) });
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="settings-title"
      onClose={() => setOpen(false)}
      onClick={(e) => e.target === ref.current && setOpen(false)} // tap outside to close
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-card p-0 text-ink shadow-2xl backdrop:bg-black/50 sm:m-auto sm:max-w-lg sm:rounded-3xl"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-card px-4 py-3">
        <h2 id="settings-title" className="text-xl font-bold text-brand">{s.title}</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label={s.close} className="grid size-11 place-items-center rounded-full hover:bg-surface">
          <CloseIcon className="size-6" />
        </button>
      </div>

      <div className="space-y-6 px-4 pb-8 pt-4">
        <p className="text-sm text-muted">{s.savedOnPhone}</p>

        {/* 1. Language */}
        <Group title={s.language.title} hint={s.language.hint}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SUMMARY_LANGS.map((lang) => {
              const info = LANG_INFO[lang];
              const active = current === lang;
              return (
                <button
                  key={lang}
                  type="button"
                  lang={info.tag}
                  aria-pressed={active}
                  onClick={() => chooseLanguage(lang)}
                  className={`flex min-h-14 flex-col items-center justify-center rounded-xl border-2 px-2 py-1 text-center ${
                    active ? "border-brand bg-brand text-white" : "border-line bg-card hover:border-brand"
                  }`}
                >
                  <span className={`${scriptClass(lang)} text-base font-semibold`}>{info.label}</span>
                  <span className="latin text-xs opacity-80">
                    {[info.english !== info.label && info.english, !isSiteLocale(lang) && (info.beta ? s.language.beta : s.language.summaryOnly)].filter(Boolean).join(" · ")}
                  </span>
                </button>
              );
            })}
          </div>
          {settings.summaryLang && (
            <p className="mt-2 rounded-xl bg-surface p-3 text-sm">
              {fmt(s.language.summaryNote, { lang: LANG_INFO[settings.summaryLang].english, site: LANG_INFO[locale].label })}
            </p>
          )}
        </Group>

        {/* 2. Reading level */}
        <Choice<Settings["level"]>
          title={s.level.title}
          value={settings.level}
          onChange={(level) => update({ level })}
          options={[
            { value: "simple", label: s.level.simple, hint: s.level.simpleHint },
            { value: "detailed", label: s.level.detailed, hint: s.level.detailedHint },
          ]}
        />

        {/* 3. Text size */}
        <Choice<Settings["textSize"]>
          title={s.textSize.title}
          value={settings.textSize}
          onChange={(textSize) => update({ textSize })}
          columns={3}
          options={[
            { value: "normal", label: s.textSize.normal, preview: <span className="text-base font-bold">A</span> },
            { value: "large", label: s.textSize.large, preview: <span className="text-xl font-bold">A</span> },
            { value: "xl", label: s.textSize.xl, preview: <span className="text-2xl font-bold">A</span> },
          ]}
        />

        {/* 4. View */}
        <Choice<Settings["view"]>
          title={s.view.title}
          value={settings.view}
          onChange={(view) => update({ view })}
          options={[
            { value: "patient", label: s.view.patient, hint: s.view.patientHint },
            { value: "pharmacist", label: s.view.pharmacist, hint: s.view.pharmacistHint },
          ]}
        />

        {/* 5. Picture mode */}
        <Choice<"on" | "off">
          title={s.pictures.title}
          hint={s.pictures.hint}
          value={settings.pictures ? "on" : "off"}
          onChange={(v) => update({ pictures: v === "on" })}
          options={[
            { value: "on", label: s.pictures.on },
            { value: "off", label: s.pictures.off },
          ]}
        />

        {/* 6. Light / dark */}
        <Choice<Settings["theme"]>
          title={s.theme.title}
          value={settings.theme}
          onChange={(theme) => update({ theme })}
          columns={3}
          options={[
            { value: "auto", label: s.theme.auto },
            { value: "light", label: s.theme.light },
            { value: "dark", label: s.theme.dark },
          ]}
        />

        {/* 7. Read-aloud speed */}
        <Choice<Settings["speechRate"]>
          title={s.speech.title}
          value={settings.speechRate}
          onChange={(speechRate) => update({ speechRate })}
          options={[
            { value: "slow", label: s.speech.slow },
            { value: "normal", label: s.speech.normal },
          ]}
        />

        {/* 8. Save automatically in My prescriptions */}
        <Choice<"on" | "off">
          title={s.autoSave.title}
          hint={s.autoSave.hint}
          value={settings.autoSave ? "on" : "off"}
          onChange={(v) => update({ autoSave: v === "on" })}
          options={[
            { value: "on", label: s.autoSave.on },
            { value: "off", label: s.autoSave.off },
          ]}
        />

        {/* 9. Cards */}
        <Group title={s.cards.title} hint={s.cards.hint}>
          <ul className="divide-y divide-line rounded-xl border border-line">
            <li className="flex min-h-12 items-center gap-3 px-3 text-muted">
              <input type="checkbox" checked disabled className="size-5 accent-[var(--brand)]" aria-label={s.cards.safety} />
              <span>{s.cards.safety}</span>
            </li>
            {HIDEABLE_CARDS.map((card) => (
              <li key={card}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3">
                  <input
                    type="checkbox"
                    checked={!settings.hiddenCards.includes(card)}
                    onChange={(e) => toggleCard(card, e.target.checked)}
                    className="size-5 accent-[var(--brand)]"
                  />
                  <span>{s.cards.names[card]}</span>
                </label>
              </li>
            ))}
          </ul>
        </Group>

        {/* 10. Saved on this phone */}
        <Group title={s.privacy.title}>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { clearTranslations(); setDone("translations"); }}
              className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-line px-4 text-sm font-semibold hover:border-brand">
              {done === "translations" && <CheckIcon className="size-4 text-emerald-700" />}
              {done === "translations" ? s.privacy.cleared : s.privacy.clearTranslations}
            </button>
            <button type="button" onClick={() => { reset(); setDone("reset"); }}
              className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-line px-4 text-sm font-semibold hover:border-brand">
              {done === "reset" && <CheckIcon className="size-4 text-emerald-700" />}
              {done === "reset" ? s.privacy.resetDone : s.privacy.reset}
            </button>
          </div>
        </Group>
      </div>
    </dialog>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-base font-bold">{title}</h3>
      {hint && <p className="mb-2 text-sm text-muted">{hint}</p>}
      <div className={hint ? "" : "mt-2"}>{children}</div>
    </section>
  );
}

type Option<V extends string> = { value: V; label: string; hint?: string; preview?: ReactNode };

/** A row of big buttons where exactly one is chosen (radio buttons underneath, for screen readers). */
function Choice<V extends string>({ title, hint, value, onChange, options, columns = 2 }: {
  title: string; hint?: string; value: V; onChange: (v: V) => void; options: Option<V>[]; columns?: 2 | 3;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="text-base font-bold">{title}</legend>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      <div className={`mt-2 grid gap-2 ${columns === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <label
              key={o.value}
              className={`flex min-h-12 cursor-pointer flex-col items-center justify-center rounded-xl border-2 px-2 py-2 text-center has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand ${
                active ? "border-brand bg-brand text-white" : "border-line bg-card hover:border-brand"
              }`}
            >
              <input type="radio" name={name} value={o.value} checked={active} onChange={() => onChange(o.value)} className="sr-only" />
              {o.preview}
              <span className="text-sm font-semibold">{o.label}</span>
              {o.hint && <span className={`text-xs ${active ? "text-white/90" : "text-muted"}`}>{o.hint}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
