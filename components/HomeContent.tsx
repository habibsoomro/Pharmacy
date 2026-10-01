import Link from "next/link";
import type { Locale } from "@/lib/locales";
import type { Dictionary } from "@/lib/i18n";
import { CameraIcon } from "@/components/icons";
import { ContactBlock } from "@/components/ContactBlock";

/** The home page's content. Used by the website (app/page.tsx) and the version inside Claude. */
export function HomeContent({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <>
      {/* Hero: one job, get the person to the scanner. */}
      <section className="bg-card">
        <div className="mx-auto max-w-5xl px-4 pb-10 pt-8 sm:pb-14 sm:pt-12">
          <h1 className="max-w-[18ch] text-3xl font-bold text-ink sm:text-5xl">{t.home.heroTitle}</h1>
          <p className="mt-4 max-w-[58ch] text-lg text-muted">{t.home.heroText}</p>

          <Link
            href="/scan"
            className="group mt-8 flex w-full items-center gap-4 rounded-2xl bg-brand p-4 text-white shadow-md shadow-brand/30 hover:bg-brand-deep active:scale-[0.99] sm:max-w-md sm:p-5"
          >
            <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-white/15">
              <CameraIcon className="size-8" />
            </span>
            <span className="flex flex-col">
              <span className="text-xl font-bold sm:text-2xl">{t.home.scanButton}</span>
              <span className="text-sm text-white/80">{t.home.scanHint}</span>
            </span>
          </Link>

          <p className="mt-4 max-w-md text-sm text-muted">{t.home.reassure}</p>
        </div>
      </section>

      {/* How it works: a real sequence, so the steps are numbered. */}
      <section className="mx-auto max-w-5xl px-4 pt-12" aria-labelledby="how-title">
        <h2 id="how-title" className="text-2xl font-bold text-brand">{t.home.howTitle}</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {t.home.steps.map((step, i) => (
            <li key={step.title} className="flex gap-4 border-s-4 border-brand ps-4 sm:flex-col sm:gap-2">
              <span className="latin text-3xl font-bold text-brand/40" aria-hidden="true">{i + 1}</span>
              <div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-1 text-muted">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-5xl px-4 pt-12" aria-labelledby="visit-title">
        <h2 id="visit-title" className="mb-6 text-2xl font-bold text-brand">{t.home.visitTitle}</h2>
        <ContactBlock locale={locale} t={t} />
      </section>
    </>
  );
}
