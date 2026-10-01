/**
 * Builds the single-page version of Nuskha that runs inside Claude (an Artifact).
 * It reuses the website's own screens and logic; only three things are swapped:
 *  - the AI is asked through Claude's page API on the viewer's own Claude account
 *    (artifact/ai-transport.ts) instead of our server with an API key;
 *  - page links switch screens inside the page (artifact/store.ts, artifact/shims);
 *  - files are saved through Claude's viewer (artifact/save-file.ts).
 *
 * Run: npm run build:artifact   →   dist-artifact/ (index.html, app.js, pdf.worker.min.mjs, logo.svg)
 */
import { rolldown } from "rolldown";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "dist-artifact");
const r = (...p) => path.join(root, ...p);

const OVERRIDES = {
  "next/link": r("artifact/shims/next-link.tsx"),
  "next/navigation": r("artifact/shims/next-navigation.ts"),
  "next/image": r("artifact/shims/next-image.tsx"),
  "server-only": r("artifact/shims/server-only.ts"),
  "@/components/LanguageSwitcher": r("artifact/shims/LanguageSwitcher.tsx"),
  "@/lib/client/ai-transport": r("artifact/ai-transport.ts"),
  "@/lib/client/save-file": r("artifact/save-file.ts"),
};

const prompts = Object.fromEntries(fs.readdirSync(r("prompts")).filter((f) => f.endsWith(".md")).map((f) => [f, fs.readFileSync(r("prompts", f), "utf8")]));

const nuskhaPlugin = {
  name: "nuskha-artifact",
  async resolveId(source, importer) {
    if (source === "virtual:nuskha-prompts") return "\0nuskha-prompts";
    if (OVERRIDES[source]) return OVERRIDES[source];
    if (source.startsWith("@/")) return this.resolve(r(source.slice(2)), importer, { skipSelf: true });
    return null;
  },
  load(id) {
    if (id === "\0nuskha-prompts") return `export default ${JSON.stringify(prompts)};`;
    return null;
  },
};

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

// 1. JavaScript: the whole app in one file.
const bundle = await rolldown({
  input: r("artifact/main.tsx"),
  plugins: [nuskhaPlugin],
  platform: "browser",
  transform: {
    jsx: { runtime: "automatic" },
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
      "process.env.NEXT_PUBLIC_NUSKHA_ARTIFACT": JSON.stringify("1"),
    },
  },
  logLevel: "warn",
  // "use client" lines are for Next.js; here everything runs in the page anyway.
  onLog(level, log, handler) {
    if (log.code === "MODULE_LEVEL_DIRECTIVE") return;
    handler(level, log);
  },
});
await bundle.write({ file: path.join(out, "app.js"), format: "esm", minify: true, codeSplitting: false });
await bundle.close();

// 2. CSS: the website's own Tailwind styles (classes found in components/ and artifact/).
const globals = fs.readFileSync(r("app/globals.css"), "utf8");
const css = (await postcss([tailwind({ base: root })]).process(globals, { from: r("app/globals.css") })).css;

// 3. The page. No <html>/<head>/<body>: Claude wraps the page in its own skeleton.
const html = `<title>Nuskha Pharmacy</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@400;700&family=Noto+Nastaliq+Urdu:wght@400;700&display=swap">
<style>
:root {
  --font-inter: "Inter";
  --font-urdu: "Noto Nastaliq Urdu";
  --font-sindhi: "Noto Naskh Arabic";
  --brand: #1E3A6E; --brand-deep: #142850; --madder: #A8322B;
}
${css}
html, body { background: var(--surface); }
</style>
<div id="nuskha-root"></div>
<script type="module" src="app.js"></script>
`;
fs.writeFileSync(path.join(out, "index.html"), html);
fs.copyFileSync(r("node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs"), path.join(out, "pdf.worker.min.mjs"));

// Claude only accepts text files without raw control characters. In these files they only
// appear inside strings and regular expressions, where "\x1b" means exactly the same thing.
for (const f of ["app.js", "pdf.worker.min.mjs"]) {
  const file = path.join(out, f);
  const text = fs.readFileSync(file, "utf8").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, "0")}`);
  fs.writeFileSync(file, text);
}
fs.copyFileSync(r("public/logo.svg"), path.join(out, "logo.svg"));

for (const f of fs.readdirSync(out)) console.log(`${f.padEnd(22)} ${(fs.statSync(path.join(out, f)).size / 1024).toFixed(0)} KB`);
