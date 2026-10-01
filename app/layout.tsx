import type { CSSProperties, ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Inter, Noto_Nastaliq_Urdu, Noto_Naskh_Arabic } from "next/font/google";
import "./globals.css";
import { site } from "@/config/site";
import { getLocale } from "@/lib/get-locale";
import { getDictionary } from "@/lib/i18n";
import { getDir, pick } from "@/lib/locales";
import { I18nProvider } from "@/components/I18nProvider";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";

// Fonts are downloaded once and served from our own site (no Google request from the phone).
// Urdu and Sindhi fonts are NOT preloaded, so English users don't download them.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const urdu = Noto_Nastaliq_Urdu({ subsets: ["arabic"], weight: ["400", "700"], variable: "--font-urdu", display: "swap", preload: false });
const sindhi = Noto_Naskh_Arabic({ subsets: ["arabic"], weight: ["400", "700"], variable: "--font-sindhi", display: "swap", preload: false });

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const name = pick(site.name, locale);
  return {
    title: { default: `${t.meta.title} | ${name}`, template: `%s | ${name}` },
    description: t.meta.description,
    icons: { icon: site.logo },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: site.colors.brand,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const t = getDictionary(locale);

  const brandVars = {
    "--brand": site.colors.brand,
    "--brand-deep": site.colors.brandDeep,
    "--madder": site.colors.madder,
  } as CSSProperties;

  return (
    <html lang={locale} dir={getDir(locale)} style={brandVars} className={`${inter.variable} ${urdu.variable} ${sindhi.variable}`}>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only rounded bg-brand px-4 py-2 text-white focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50">
          {t.common.skipToContent}
        </a>
        <I18nProvider locale={locale} dict={t}>
          <Header locale={locale} t={t} />
          <main id="main">{children}</main>
          <Footer locale={locale} t={t} />
          <WhatsAppFloat locale={locale} label={t.home.whatsapp} />
        </I18nProvider>
      </body>
    </html>
  );
}
