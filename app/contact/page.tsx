import { getLocale } from "@/lib/get-locale";
import { getDictionary } from "@/lib/i18n";
import { PageShell } from "@/components/PageShell";
import { ContactBlock } from "@/components/ContactBlock";

export default async function ContactPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  return (
    <PageShell title={t.pages.contactTitle}>
      <p>{t.pages.contactText}</p>
      <ContactBlock locale={locale} t={t} />
    </PageShell>
  );
}
