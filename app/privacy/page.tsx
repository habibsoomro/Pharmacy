import type { Metadata } from "next";
import { getLocale } from "@/lib/get-locale";
import { getDictionary } from "@/lib/i18n";
import { PrivacyContent } from "@/components/PrivacyContent";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).pages.privacyTitle };
}

export default async function PrivacyPage() {
  const locale = await getLocale();
  return <PrivacyContent locale={locale} t={getDictionary(locale)} />;
}
