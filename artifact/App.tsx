import { useEffect, type CSSProperties } from "react";
import en from "@/locales/en.json";
import ur from "@/locales/ur.json";
import sd from "@/locales/sd.json";
import { site } from "@/config/site";
import { getDir, type Locale } from "@/lib/locales";
import type { Dictionary } from "@/lib/i18n";
import { I18nProvider } from "@/components/I18nProvider";
import { SettingsProvider } from "@/components/SettingsProvider";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { OfflineBanner } from "@/components/OfflineBanner";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";
import { PageShell } from "@/components/PageShell";
import { HomeContent } from "@/components/HomeContent";
import { PrivacyContent } from "@/components/PrivacyContent";
import { ContactBlock } from "@/components/ContactBlock";
import { ScanFlow } from "@/components/scan/ScanFlow";
import { ReviewScreen } from "@/components/review/ReviewScreen";
import { SummaryScreen } from "@/components/summary/SummaryScreen";
import { HistoryScreen } from "@/components/history/HistoryScreen";
import { useAppState, type PagePath } from "./store";

const DICTS: Record<Locale, Dictionary> = { en, ur, sd };

function Page({ page, locale, t }: { page: PagePath; locale: Locale; t: Dictionary }) {
  switch (page) {
    case "/scan":
      return <PageShell title={t.pages.scanTitle}><ScanFlow /></PageShell>;
    case "/review":
      return <ReviewScreen />;
    case "/summary":
      return <SummaryScreen />;
    case "/history":
      return <PageShell title={t.pages.historyTitle}><p>{t.pages.historyText}</p><HistoryScreen /></PageShell>;
    case "/about":
      return <PageShell title={t.pages.aboutTitle}><p>{t.pages.aboutText}</p></PageShell>;
    case "/contact":
      return <PageShell title={t.pages.contactTitle}><p>{t.pages.contactText}</p><ContactBlock locale={locale} t={t} /></PageShell>;
    case "/privacy":
      return <PrivacyContent locale={locale} t={t} />;
    default:
      return (
        <>
          <HomeContent locale={locale} t={t} />
          <p className="mx-auto mt-10 max-w-5xl px-4 text-sm text-muted">{t.claudePage.note}</p>
        </>
      );
  }
}

/** The whole website as one page, for running inside Claude. */
export function App() {
  const { page, locale } = useAppState();
  const t = DICTS[locale];

  useEffect(() => {
    const html = document.documentElement;
    html.lang = locale;
    html.dir = getDir(locale);
    document.title = `${t.meta.title} | ${site.name[locale]}`;
  }, [locale, t]);

  const brandVars = { "--brand": site.colors.brand, "--brand-deep": site.colors.brandDeep, "--madder": site.colors.madder } as CSSProperties;

  return (
    <div style={brandVars} className="min-h-dvh">
      {/* key: switching language rebuilds the screens in the new language, as a page reload does on the website */}
      <I18nProvider key={locale} locale={locale} dict={t}>
        <SettingsProvider>
          <OfflineBanner />
          <Header locale={locale} t={t} />
          <main id="main"><Page page={page} locale={locale} t={t} /></main>
          <Footer locale={locale} t={t} />
          <WhatsAppFloat locale={locale} label={t.home.whatsapp} />
          <SettingsDialog />
        </SettingsProvider>
      </I18nProvider>
    </div>
  );
}
