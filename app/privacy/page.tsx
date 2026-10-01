import { getLocale } from "@/lib/get-locale";
import { getDictionary } from "@/lib/i18n";
import { PageShell } from "@/components/PageShell";

// Draft: the full policy is finalised in Stage 9.
export default async function PrivacyPage() {
  const t = getDictionary(await getLocale());
  return (
    <PageShell title={t.pages.privacyTitle}>
      <ul className="list-disc space-y-2 ps-6">
        {t.pages.privacyPoints.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <p className="text-sm text-muted">{t.pages.privacyDraft}</p>
    </PageShell>
  );
}
