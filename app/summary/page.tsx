import { getLocale } from "@/lib/get-locale";
import { getDictionary } from "@/lib/i18n";
import { PageShell } from "@/components/PageShell";
import { SummaryPlaceholder } from "@/components/summary/SummaryPlaceholder";

export default async function SummaryPage() {
  const t = getDictionary(await getLocale());
  return (
    <PageShell title={t.summary.title}>
      <SummaryPlaceholder />
    </PageShell>
  );
}
