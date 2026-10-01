import type { Locale } from "@/lib/locales";
import type { Dictionary } from "@/lib/i18n";
import { fmt } from "@/lib/format";
import { formatDate } from "@/lib/summary/format";
import { PageShell } from "@/components/PageShell";
import { ContactBlock } from "@/components/ContactBlock";

/** Change this date whenever you change the policy text in locales/*.json ("privacy"). */
export const POLICY_UPDATED = "2026-10-01";

/** The privacy policy. Used by the website (app/privacy/page.tsx) and the version inside Claude. */
export function PrivacyContent({ locale, t }: { locale: Locale; t: Dictionary }) {
  const p = t.privacy;
  return (
    <PageShell title={t.pages.privacyTitle}>
      <p className="text-sm text-muted">{fmt(p.updated, { date: formatDate(POLICY_UPDATED, locale) })}</p>
      <p className="rounded-xl bg-card p-4 font-medium">{p.intro}</p>
      {p.sections.map((section) => (
        <section key={section.title}>
          <h2 className="text-lg font-bold text-brand">{section.title}</h2>
          <ul className="mt-1 list-disc space-y-1.5 ps-6">
            {section.points.map((point) => <li key={point}>{point}</li>)}
          </ul>
        </section>
      ))}
      <section>
        <h2 className="text-lg font-bold text-brand">{p.contactTitle}</h2>
        <p className="mb-3">{p.contactText}</p>
        <ContactBlock locale={locale} t={t} />
      </section>
    </PageShell>
  );
}
