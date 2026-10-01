import type { Metadata } from "next";
import { getLocale } from "@/lib/get-locale";
import { getDictionary } from "@/lib/i18n";
import { fmt } from "@/lib/format";
import { formatDate } from "@/lib/summary/format";
import { PageShell } from "@/components/PageShell";
import { ContactBlock } from "@/components/ContactBlock";

/** Change this date whenever you change the policy text in locales/*.json ("privacy"). */
const POLICY_UPDATED = "2026-10-01";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).pages.privacyTitle };
}

export default async function PrivacyPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
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
