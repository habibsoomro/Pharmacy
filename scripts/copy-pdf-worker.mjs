// Copies the PDF reader's helper file into /public so the browser can load it.
// Runs automatically after `npm install`.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const src = require.resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs");
mkdirSync("public", { recursive: true });
copyFileSync(src, "public/pdf.worker.min.mjs");
console.log("Copied pdf.worker.min.mjs to /public");
