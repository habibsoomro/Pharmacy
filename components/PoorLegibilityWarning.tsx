"use client";

import { useI18n } from "@/components/I18nProvider";
import { site } from "@/config/site";
import { pick } from "@/lib/locales";
import { whatsappLink } from "@/lib/whatsapp";
import { AlertIcon, PhoneIcon, PinIcon, WhatsAppIcon } from "@/components/icons";

/**
 * Strong warning when the handwriting was hard to read ("poor" legibility):
 * asks the person to show the prescription to the pharmacist in person,
 * with buttons to call, WhatsApp or find the pharmacy.
 */
export function PoorLegibilityWarning() {
  const { t, locale } = useI18n();
  const p = t.poor;
  return (
    <div role="alert" data-pdf-block className="rounded-2xl border-2 border-red-400 bg-red-50 p-4 text-red-900">
      <p className="flex items-center gap-2 text-lg font-bold">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-red-600 text-white"><AlertIcon className="size-5" /></span>
        {p.title}
      </p>
      <p className="mt-2 font-medium">{p.text}</p>
      <div className="no-print mt-3 grid gap-2 sm:grid-cols-3">
        <a href={`tel:${site.phoneLink}`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-600 px-3 font-semibold text-white">
          <PhoneIcon className="size-5" />{p.call}
        </a>
        <a href={whatsappLink(site.whatsappNumber, pick(site.whatsappMessage, locale))} target="_blank" rel="noopener noreferrer"
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-whatsapp px-3 font-semibold text-white">
          <WhatsAppIcon className="size-5" />{p.whatsapp}
        </a>
        <a href={site.mapsUrl} target="_blank" rel="noopener noreferrer"
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-red-300 bg-card px-3 font-semibold">
          <PinIcon className="size-5" />{p.directions}
        </a>
      </div>
    </div>
  );
}
