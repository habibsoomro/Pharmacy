import type { Metadata } from "next";
import { getLocale } from "@/lib/get-locale";
import { getDictionary } from "@/lib/i18n";
import { PageShell } from "@/components/PageShell";
import { HistoryScreen } from "@/components/history/HistoryScreen";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).pages.historyTitle, robots: { index: false } };
}

/** "My prescriptions": saved only on this phone (IndexedDB), never on the server. */
export default async function HistoryPage() {
  const t = getDictionary(await getLocale());
  return (
    <PageShell title={t.pages.historyTitle}>
      <p>{t.pages.historyText}</p>
      <HistoryScreen />
    </PageShell>
  );
}
