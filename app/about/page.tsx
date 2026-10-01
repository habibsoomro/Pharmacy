import { getLocale } from "@/lib/get-locale";
import { getDictionary } from "@/lib/i18n";
import { PageShell } from "@/components/PageShell";

export default async function AboutPage() {
  const t = getDictionary(await getLocale());
  return (
    <PageShell title={t.pages.aboutTitle}>
      <p>{t.pages.aboutText}</p>
    </PageShell>
  );
}
