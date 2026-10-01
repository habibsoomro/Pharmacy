import Link from "next/link";
import { getLocale } from "@/lib/get-locale";
import { getDictionary } from "@/lib/i18n";

export default async function NotFound() {
  const t = getDictionary(await getLocale());
  return (
    <div className="mx-auto max-w-2xl px-4 pt-10">
      <div className="rounded-2xl border border-line bg-card p-6">
        <h1 className="text-2xl font-bold text-brand">{t.errors.notFoundTitle}</h1>
        <p className="mt-2 text-muted">{t.errors.notFoundText}</p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link href="/" className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-brand px-5 font-semibold text-white">{t.errors.home}</Link>
          <Link href="/scan" className="flex min-h-12 flex-1 items-center justify-center rounded-xl border-2 border-brand px-5 font-semibold text-brand">{t.nav.scan}</Link>
        </div>
      </div>
    </div>
  );
}
