import { site } from "@/config/site";
import { pick, type Locale } from "@/lib/locales";
import type { Dictionary } from "@/lib/i18n";
import { whatsappLink } from "@/lib/whatsapp";
import { ClockIcon, PhoneIcon, PinIcon, WhatsAppIcon } from "@/components/icons";

/** Opening hours, address, call and WhatsApp. Used on Home and Contact. */
export function ContactBlock({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-line bg-card p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <ClockIcon className="size-5 text-brand" />
          {t.home.hoursTitle}
        </h3>
        <dl className="mt-3 space-y-2">
          {site.hours.map((row) => (
            <div key={row.days.en} className="flex flex-wrap justify-between gap-x-4">
              <dt className="text-muted">{pick(row.days, locale)}</dt>
              <dd className="font-medium">{pick(row.time, locale)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="rounded-2xl border border-line bg-card p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <PinIcon className="size-5 text-brand" />
          {t.home.addressTitle}
        </h3>
        <p className="mt-3">{pick(site.address, locale)}</p>
        <a href={site.mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-brand underline underline-offset-4">
          {t.home.openMap}
        </a>
      </div>

      <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row">
        <a
          href={`tel:${site.phoneLink}`}
          className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-brand bg-card px-4 font-semibold text-brand hover:bg-surface"
        >
          <PhoneIcon className="size-5" />
          {t.home.call}
          <span dir="ltr" className="latin font-normal text-muted">{site.phoneDisplay}</span>
        </a>
        <a
          href={whatsappLink(site.whatsappNumber, pick(site.whatsappMessage, locale))}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-whatsapp px-4 font-semibold text-white hover:brightness-110"
        >
          <WhatsAppIcon className="size-5" />
          {t.home.whatsapp}
        </a>
      </div>
    </div>
  );
}
