import type { Metadata } from "next";
import { getLocale } from "@/lib/get-locale";
import { getDictionary } from "@/lib/i18n";
import { SummaryScreen } from "@/components/summary/SummaryScreen";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).summary.title, robots: { index: false } };
}

export default function SummaryPage() {
  return <SummaryScreen />;
}
