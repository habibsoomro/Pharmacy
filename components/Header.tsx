import Link from "next/link";
import Image from "next/image";
import { site } from "@/config/site";
import { pick, type Locale } from "@/lib/locales";
import type { Dictionary } from "@/lib/i18n";
import { AjrakBand } from "@/components/AjrakBand";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function Header({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <header className="bg-card">
      <AjrakBand />
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <Image src={site.logo} alt="" width={36} height={36} priority className="shrink-0" />
          <span className="text-base font-bold leading-tight text-brand sm:text-lg">{pick(site.name, locale)}</span>
        </Link>

        <nav aria-label={t.common.menu} className="hidden items-center gap-5 text-sm md:flex">
          <Link href="/scan" className="hover:text-brand">{t.nav.scan}</Link>
          <Link href="/history" className="hover:text-brand">{t.nav.history}</Link>
          <Link href="/contact" className="hover:text-brand">{t.nav.contact}</Link>
        </nav>

        <LanguageSwitcher current={locale} label={t.common.language} />
      </div>
    </header>
  );
}
