"use client";

import { useEffect, useMemo, useRef } from "react";
import { useI18n } from "@/components/I18nProvider";
import { useSettings } from "@/components/SettingsProvider";
import { BellIcon, CloseIcon } from "@/components/icons";
import { fmt } from "@/lib/format";
import { howToTake } from "@/lib/summary/how-to-take";
import { ONGOING_DAYS, buildIcs, planReminders, type IcsEvent } from "@/lib/summary/reminders";
import { SLOTS } from "@/lib/summary/timetable";
import type { ShareCtx } from "@/lib/summary/share-text";
import { saveFile } from "@/lib/client/save-file";

/** Lets the person pick reminder times and download a calendar (.ics) file for their phone. */
export function RemindersDialog({ ctx, onClose }: { ctx: ShareCtx; onClose: () => void }) {
  const { t } = useI18n();
  const { settings, update } = useSettings();
  const ref = useRef<HTMLDialogElement>(null);
  const r = t.summary.reminders;
  const times = settings.reminderTimes;

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const plan = useMemo(() => planReminders(ctx.rx.medicines, ctx.start, times), [ctx.rx.medicines, ctx.start, times]);
  const usedSlots = SLOTS.filter((slot) => plan.reminders.some((x) => x.slot === slot));
  const hasOngoing = plan.reminders.some((x) => x.ongoing);

  function download() {
    const stamp = Date.now().toString(36);
    const events: IcsEvent[] = plan.reminders.map((x, i) => {
      const med = ctx.rx.medicines[x.medIndex];
      const { how, shake } = howToTake(med);
      const title = `💊 ${fmt(r.eventTitle, { name: x.name })}${x.amount ? ` (${x.amount})` : ""}`;
      const description = [
        x.amount && fmt(r.eventAmount, { amount: x.amount }),
        x.food && x.food !== "any" && `${t.summary.med.food}: ${t.review.food[x.food]}`,
        `${t.summary.med.howToTake}: ${t.summary.howTo[how]}${shake ? `. ${t.summary.howTo.shake}` : ""}`,
        "",
        t.common.disclaimer,
      ].filter((l) => l !== false && l !== null).join("\n");
      return { uid: `${stamp}-${i}@nuskha`, firstDay: x.firstDay, time: x.time, days: x.days, title, description };
    });
    saveFile("medicine-reminders.ics", new Blob([buildIcs(events)], { type: "text/calendar;charset=utf-8" })).catch(() => {});
  }

  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && ref.current?.close()} aria-labelledby="reminders-title"
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-card p-0 text-ink shadow-2xl backdrop:bg-black/50 sm:m-auto sm:max-w-lg sm:rounded-3xl">
      <div className="sticky top-0 flex items-center justify-between border-b border-line bg-card px-4 py-3">
        <h2 id="reminders-title" className="flex items-center gap-2 text-xl font-bold text-brand"><BellIcon className="size-6" />{r.title}</h2>
        <button type="button" onClick={() => ref.current?.close()} aria-label={r.close} className="grid size-11 place-items-center rounded-full hover:bg-surface">
          <CloseIcon className="size-6" />
        </button>
      </div>

      <div className="space-y-4 px-4 pb-6 pt-4">
        {plan.reminders.length === 0 ? (
          <p className="rounded-xl bg-surface p-4">{r.none}</p>
        ) : (
          <>
            <p className="text-sm">{r.intro}</p>
            <fieldset>
              <legend className="font-semibold">{r.times}</legend>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {usedSlots.map((slot) => (
                  <label key={slot} className="block">
                    <span className="text-sm text-muted">{t.review.med[slot]}</span>
                    <input type="time" dir="ltr" value={times[slot]} required
                      onChange={(e) => /^\d{2}:\d{2}$/.test(e.target.value) && update({ reminderTimes: { ...times, [slot]: e.target.value } })}
                      className="latin mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-base" />
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="font-medium">{fmt(r.count, { n: plan.reminders.length })}</p>
            {hasOngoing && <p className="text-sm text-muted">{fmt(r.ongoingNote, { n: ONGOING_DAYS })}</p>}
          </>
        )}

        {plan.skipped.length > 0 && (
          <div className="text-sm">
            <p className="font-medium text-muted">{r.skipped}</p>
            <ul className="mt-1 list-disc ps-5">
              {plan.skipped.map((x) => (
                <li key={x.medIndex}><bdi dir="ltr" className="latin font-semibold">{x.name}</bdi>: {r.reasons[x.reason]}</li>
              ))}
            </ul>
          </div>
        )}

        {plan.reminders.length > 0 && (
          <>
            <button type="button" onClick={download} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-brand text-lg font-semibold text-white">
              <BellIcon className="size-5" />
              {r.download}
            </button>
            <p className="text-xs text-muted">{r.androidHint}</p>
          </>
        )}
      </div>
    </dialog>
  );
}
