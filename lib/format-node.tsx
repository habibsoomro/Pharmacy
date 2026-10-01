import { Fragment, type ReactNode } from "react";

/**
 * Like fmt(), but each filled-in value is wrapped in <bdi>, so English words
 * and numbers inside Urdu/Sindhi sentences keep their correct order.
 *   fmtNode("کل: {q}", { q: "10 tablets" })
 */
export function fmtNode(text: string, vars: Record<string, string | number>): ReactNode {
  const parts = text.split(/(\{\w+\})/);
  return parts.map((part, i) => {
    const key = part.match(/^\{(\w+)\}$/)?.[1];
    if (key && key in vars) return <bdi key={i} className="whitespace-nowrap">{vars[key]}</bdi>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}
