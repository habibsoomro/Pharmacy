// The "legacy" (older-browser) build of pdf.js has the same functions as the main one.
declare module "pdfjs-dist/legacy/build/pdf.min.mjs" {
  export * from "pdfjs-dist";
}
