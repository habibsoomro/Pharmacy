import Link from "next/link";
import { site } from "@/config/site";
import { pick, type Locale } from "@/lib/locales";
import type { Dictionary } from "@/lib/i18n";
import { AjrakBand } from "@/components/AjrakBand";

export function Footer({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <footer className="mt-16 bg-card">
      <AjrakBand />
      <div className="mx-auto max-w-5xl px-4 py-8 pb-24 text-sm text-muted">
        <nav aria-label={t.common.menu} className="mb-5 flex flex-wrap gap-x-5 gap-y-2 text-ink">
          <Link href="/" className="hover:text-brand">{t.nav.home}</Link>
          <Link href="/scan" className="hover:text-brand">{t.nav.scan}</Link>
          <Link href="/history" className="hover:text-brand">{t.nav.history}</Link>
          <Link href="/about" className="hover:text-brand">{t.nav.about}</Link>
          <Link href="/contact" className="hover:text-brand">{t.nav.contact}</Link>
          <Link href="/privacy" className="hover:text-brand">{t.nav.privacy}</Link>
        </nav>
        <p className="max-w-prose">{t.common.disclaimer}</p>
        <p className="mt-4">
          © {new Date().getFullYear()} {pick(site.name, locale)}. {t.common.rights}
        </p>
      </div>
    </footer>
  );
}
