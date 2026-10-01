/**
 * Where this code is running. The normal website (Next.js on Vercel) leaves
 * NEXT_PUBLIC_NUSKHA_ARTIFACT unset. The single-page version that runs inside
 * Claude (npm run build:artifact) sets it to "1": there is no server, Claude is
 * reached through the page, and the in-page camera and printing are not allowed.
 */
export const IN_CLAUDE_PAGE = process.env.NEXT_PUBLIC_NUSKHA_ARTIFACT === "1";

/** Where pdf.js finds its helper file. */
export const PDF_WORKER_URL = IN_CLAUDE_PAGE ? "pdf.worker.min.mjs" : "/pdf.worker.min.mjs";
