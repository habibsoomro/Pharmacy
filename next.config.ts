import type { NextConfig } from "next";

/**
 * Content Security Policy: the page may only load scripts, styles, fonts and
 * data from this website, may only talk to this website's own server, and
 * can't be put inside another site's frame.
 *  - 'unsafe-inline' scripts: Next.js and the small theme script need it.
 *  - 'unsafe-eval': the iPhone photo (HEIC) converter builds code at runtime.
 *  - blob: / data: for photos, the PDF reader's helper and making PDFs on the phone.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The AI prompts are read from /prompts at runtime; make sure Vercel includes them.
  outputFileTracingIncludes: { "/api/**": ["./prompts/**"] },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          // Camera is allowed only on our own pages (needed for "Take Photo").
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      {
        // Answers from the AI routes are personal: never store them in any cache.
        source: "/api/(.*)",
        headers: [{ key: "Cache-Control", value: "no-store" }, { key: "X-Robots-Tag", value: "noindex" }],
      },
    ];
  },
};

export default nextConfig;
