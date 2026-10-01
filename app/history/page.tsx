import { getLocale } from "@/lib/get-locale";
import { getDictionary } from "@/lib/i18n";
import { PageShell } from "@/components/PageShell";

// Placeholder: on-device history (IndexedDB) is built in Stage 8.
export default async function HistoryPage() {
  const t = getDictionary(await getLocale());
  return (
    <PageShell title={t.pages.historyTitle}>
      <p>{t.pages.historyText}</p>
      <p className="rounded-xl border border-dashed border-line bg-card p-5 text-muted">{t.common.comingSoon}</p>
    </PageShell>
  );
}
