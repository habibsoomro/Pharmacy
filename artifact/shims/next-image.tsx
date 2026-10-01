import type { ImgHTMLAttributes } from "react";

/** Stand-in for next/image: a plain picture; "/logo.svg" becomes "logo.svg" next to the page. */
export default function Image({ src, alt, priority: _p, ...rest }: ImgHTMLAttributes<HTMLImageElement> & { src: string; alt: string; priority?: boolean }) {
  return <img src={src.startsWith("/") ? src.slice(1) : src} alt={alt} {...rest} />;
}
