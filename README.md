# Nuskha: AI prescription reader for your pharmacy

A mobile-first pharmacy website that reads prescription photos (including
handwritten ones) and explains them in English, Urdu and Sindhi.

**Current stage: 4 of 10**

- Stage 1: project setup, home page, language switching
- Stage 2: taking/uploading prescription photos (camera, upload, iPhone HEIC, PDF first page, crop, rotate, retake, quality check, compression)
- Stage 3: AI reading of the prescription (`/api/extract`), shorthand double-check, brand list, consent
- Stage 4: "Check what we read" review-and-edit screen (`/review`), pharmacist mode

---

## What you need

- **Node.js 20 or newer**: download from https://nodejs.org (choose "LTS").
- **An Anthropic API key**: from https://console.anthropic.com (needed from Stage 3).

## Run it on your computer

1. Unzip the project and open a terminal in the `nuskha` folder.
2. Install the building blocks (one time only):
   ```
   npm install
   ```
3. Add your API key:
   - Copy `.env.example` and rename the copy to `.env.local`
   - Paste your key after `ANTHROPIC_API_KEY=`
   - `.env.local` is never uploaded to GitHub, so your key stays private.
4. Start the website:
   ```
   npm run dev
   ```
5. Open http://localhost:3000 in your browser.

### Try it without an API key (test mode)

Add `AI_MOCK=1` to `.env.local` and restart `npm run dev`. Every scan then
returns the same sample prescription (no AI call, no cost). Remove the line to
use the real AI. **Never set AI_MOCK on the live website.**

### Run the automatic tests

```
npm test
```
This checks the shorthand reader (`1+0+1`, `TDS`, `1/52`, quantities), the
double-check against the brand list, and how the app handles bad AI answers.

To test on your phone: connect phone and computer to the same Wi-Fi and open
`http://YOUR-COMPUTER-IP:3000` on the phone. (Most phones only allow the camera
on HTTPS sites, so full camera testing is easiest after deploying to Vercel.)

## Put it online (Vercel, free tier)

1. Upload the project to a GitHub repository.
2. Go to https://vercel.com, sign in with GitHub, click **Add New → Project** and pick the repository.
3. Under **Environment Variables**, add `ANTHROPIC_API_KEY` with your key.
4. Click **Deploy**. Vercel gives you a web address you can share.

---

## Where to change things

| What you want to change | File |
|---|---|
| Pharmacy name, logo, colours, phone, WhatsApp, address, opening hours | `config/site.ts` |
| AI model name | `config/ai.ts` |
| Any text on the website | `locales/en.json`, `locales/ur.json`, `locales/sd.json` |
| Logo image | put it in `public/` and update `logo` in `config/site.ts` |
| Photo limits, compression, and the dark / blurry / too-small warning levels | `config/capture.ts` |
| AI prompts | `prompts/` folder (`extract-system.md` is the main one) |
| Brand → generic list | `data/brand-generics.json` |
| How many scans per visitor | `app/api/extract/route.ts` (8 per 10 minutes) |

**Translation safety net:** if you add a new line to `en.json` but forget it in
`ur.json` or `sd.json`, run `npm run typecheck` and it will tell you exactly
which line is missing.

## Folder map

```
app/          pages: home, scan, history, about, contact, privacy (+ api/ from Stage 3)
components/   header, footer, language switcher, buttons, cards
config/       site.ts (pharmacy details), ai.ts (model)
lib/          language helpers, WhatsApp link helper
locales/      translation files
prompts/      AI prompts (Stage 3+)
data/         interaction list, brand-to-generic list (Stage 3+)
tests/        tests and sample prescriptions (Stage 10)
public/       logo and images
```

## How a scan works

1. The phone shrinks the photos and sends them to `/api/extract` on your server.
2. The server sends them to Claude with the prompt from `prompts/extract-system.md`.
3. The answer is checked against a strict format (Zod). If it's broken, Claude is asked once more.
4. The app double-checks the AI with its own rules: it re-reads shorthand like
   `1+0+1`, `TDS` and `1/52`, recalculates quantities, and compares brand → generic
   names with `data/brand-generics.json`. It fills gaps and flags disagreements;
   it never silently overwrites what the AI read.
5. The person checks everything on `/review`. Fields the AI was unsure about,
   couldn't read, or that disagreed with our own check are shown in amber with ⚠,
   with a "Looks right" button and (where possible) a suggested correction.
   Pharmacist mode (checkbox at the top) shows every field plus notes.
   The original AI reading is kept alongside the edited version.
6. Nothing is stored on the server. The result lives only in the user's browser tab.

## Notes

- **The brand list and prompts are medical content.** Have a pharmacist review
  `data/brand-generics.json` and `prompts/extract-system.md` before going live.

- **Photo quality warnings** are only advice: people can always continue.
  If the app warns too often on real prescriptions, lower `minSharpness` in
  `config/capture.ts` (or raise it if blurry photos get through).
- **PDF reading** uses the "legacy" version of pdf.js on purpose: the newest
  version doesn't work on many Android phones. Its helper file
  (`public/pdf.worker.min.mjs`) is copied automatically by `npm install`.

- Fonts (Inter, Noto Nastaliq Urdu, Noto Naskh Arabic) are downloaded once when
  the site is built and served from your own site. Urdu and Sindhi fonts are
  only downloaded by people who switch to those languages.
- The decorative strip at the top and bottom is inspired by Sindhi ajrak.
  Red is kept for danger alerts only.
