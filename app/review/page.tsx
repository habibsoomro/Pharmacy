import type { Metadata } from "next";
import { getLocale } from "@/lib/get-locale";
import { getDictionary } from "@/lib/i18n";
import { ReviewScreen } from "@/components/review/ReviewScreen";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).review.title, robots: { index: false } };
}

export default function ReviewPage() {
  return <ReviewScreen />;
}
