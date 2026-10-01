import { getLocale } from "@/lib/get-locale";
import { getDictionary } from "@/lib/i18n";
import { PageShell } from "@/components/PageShell";
import { ScanFlow } from "@/components/scan/ScanFlow";

export default async function ScanPage() {
  const t = getDictionary(await getLocale());
  return (
    <PageShell title={t.pages.scanTitle}>
      <ScanFlow />
    </PageShell>
  );
}
