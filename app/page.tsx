import { getLocale } from "@/lib/get-locale";
import { getDictionary } from "@/lib/i18n";
import { HomeContent } from "@/components/HomeContent";

export default async function HomePage() {
  const locale = await getLocale();
  return <HomeContent locale={locale} t={getDictionary(locale)} />;
}
