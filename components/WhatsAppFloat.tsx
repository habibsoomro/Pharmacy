import { site } from "@/config/site";
import { pick, type Locale } from "@/lib/locales";
import { whatsappLink } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/icons";

/** Round WhatsApp button that stays in the bottom corner on every page. */
export function WhatsAppFloat({ locale, label }: { locale: Locale; label: string }) {
  return (
    <a
      href={whatsappLink(site.whatsappNumber, pick(site.whatsappMessage, locale))}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="fixed end-4 z-40 grid size-14 place-items-center rounded-full bg-whatsapp text-white shadow-lg shadow-black/20 hover:brightness-110"
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <WhatsAppIcon className="size-7" />
    </a>
  );
}
