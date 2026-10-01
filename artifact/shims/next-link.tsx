import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { go } from "../store";

/** Stand-in for next/link: in-app links switch the page; other links open normally. */
export default function Link({ href, children, onClick, target, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode; prefetch?: boolean }) {
  const internal = href.startsWith("/");
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (!internal || e.defaultPrevented) return;
    e.preventDefault();
    go(href);
  };
  return (
    <a href={internal ? `#${href.slice(1).split("#")[0]}` : href} target={internal ? undefined : target} onClick={handle} {...rest}>
      {children}
    </a>
  );
}
