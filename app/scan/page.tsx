import { getLocale } from "@/lib/get-locale";
import { getDictionary } from "@/lib/i18n";
import { PageShell } from "@/components/PageShell";

// Placeholder: the camera and upload screen is built in Stage 2.
export default async function ScanPage() {
  const t = getDictionary(await getLocale());
  return (
    <PageShell title={t.pages.scanTitle}>
      <p className="rounded-xl border border-dashed border-line bg-card p-5 text-muted">{t.common.comingSoon}</p>
    </PageShell>
  );
}
