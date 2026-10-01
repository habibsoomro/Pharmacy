# Nuskha: AI prescription reader for your pharmacy

A mobile-first pharmacy website that reads prescription photos (including
handwritten ones) and explains them in English, Urdu and Sindhi.

**Current stage: 8 of 10**

- Stage 1: project setup, home page, language switching
- Stage 2: taking/uploading prescription photos (camera, upload, iPhone HEIC, PDF first page, crop, rotate, retake, quality check, compression)
- Stage 3: AI reading of the prescription (`/api/extract`), shorthand double-check, brand list, consent
- Stage 4: "Check what we read" review-and-edit screen (`/review`), pharmacist mode
- Stage 5: safety check: interactions, duplicates, dose/age/allergy checks (`/api/interactions` + the pharmacy's own list)
- Stage 6: summary cards (`/summary`): safety alerts, doctor, patient, diagnosis, one card per medicine with pictures, daily timetable, course calendar, interactions, general care; copy, WhatsApp, print, PDF
- Stage 7: Settings panel (gear button in the header, and on the summary): summary languages incl. Roman Urdu, Punjabi, Pashto, Balochi (AI translation via `/api/translate`, saved on the phone), Simple/Detailed reading level, text size, read aloud, patient/pharmacist view, show/hide cards, picture mode, light/dark theme, medicine reminders (.ics calendar file)
- Stage 8: My prescriptions (`/history`): save summaries on the phone only (IndexedDB), open them again, search, delete one or delete all; optional automatic saving

---

## What you need

- **Node.js 20 or newer**: download from https://nodejs.org (choose "LTS").
- **An Anthropic API key**: from https://console.anthropic.com (needed from Stage 3).

## Run it on your computer

1. Download the project (or `git clone` it) and open a terminal in the project folder (the one with `package.json`).
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
returns the same sample prescription (no AI call, no cost).
Translations in test mode are not real: each text just gets a marker such as
`[ps]` in front, so you can see where translated text appears.
Use `AI_MOCK=elderly` instead to get a 72-year-old patient on 9 medicines with
real interactions, a duplicate, a penicillin allergy and an antibiotic with no duration. Remove the line to
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
| AI prompts | `prompts/` folder (`extract-system.md` is the main one; `translate-system.md` for translations) |
| Summary languages (names, right-to-left, fonts, phone voices) | `lib/languages.ts` |
| How each language is described to the AI (script, style) | `lib/server/translate.ts` (`LANGUAGE`) |
| Default settings (reading level, text size, reminder times…) | `lib/settings.ts` |
| Brand → generic list | `data/brand-generics.json` |
| The pharmacy's interaction list (58 rules) | `data/interactions.json` |
| Medicine groups used by the rules (e.g. NSAIDs) | `data/drug-groups.json` |
| Side effects, storage tips and urgent warning signs (General Care card) | `data/care.json` |
| Maximum doses and age rules | `lib/rx/safety.ts` (`ADULT_MAX_MG_PER_DAY`, `CHILD_MG_PER_KG`, `AGE_RULES`) |
| How many scans per visitor | `app/api/extract/route.ts` (8 per 10 minutes) |
| How many translation requests per visitor | `app/api/translate/route.ts` (40 per 10 minutes) |

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
prompts/      AI prompts (Stage 3+): reading, safety check, translation
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
6. On the summary page the safety check runs on the CHECKED prescription:
   - the pharmacy's own list runs instantly in the phone (works offline);
   - the AI check (`prompts/interactions-system.md`) runs on the server;
   - both are merged: an alert found by both is shown once, marked "Found by both checks",
     with the more serious level kept. Only age, sex and weight are sent, never names.
   - A safety net replaces any advice telling people to stop or change a medicine
     with "Talk to your doctor or pharmacist".
7. Nothing is stored on the server. The result lives only in the user's browser tab.

## Settings (Stage 7)

Everything is saved on the phone only (in the browser), and there is a
"Reset all settings" button at the bottom of the panel.

- **Language.** English, Urdu and Sindhi change the whole website (menus come from
  `locales/*.json`). Roman Urdu, Punjabi, Pashto and Balochi are for the **summary only**:
  its headings and labels, and the texts from the prescription and safety check, are
  translated by the AI. Punjabi, Pashto and Balochi are marked "beta" because they
  have no hand-checked translation file. For Urdu and Sindhi, only the prescription and
  safety-check texts are AI-translated; the labels come from your own translation files.
  Medicine brand and generic names always stay in English.
  Translations are saved on the phone, so each text is translated (and paid for) only
  once; "Delete saved translations" in Settings removes them. Website labels are also
  remembered on the server for everyone; prescription texts never are. Only the texts
  are sent for translation, never the patient's or doctor's name or phone number.
- **Reading level.** *Simple* (default) uses the easiest words when translating and
  shows less detail. *Detailed* adds the prescription's own shorthand (e.g. "1+0+1"),
  how it is taken, vital signs, doctor's qualifications, and all side effects.
- **Pharmacist view** is the same switch as "Pharmacist mode" on the checking screen.
  On the summary it adds a Dispensing list card, AI confidence for each medicine,
  generic name + strength + form, PMDC and MR numbers, and "brand match not certain" warnings.
- **Read aloud** uses the phone's own voices (works offline). Many phones have no
  Sindhi, Punjabi, Pashto or Balochi voice; the app then says so and, if the phone has
  an Urdu voice, offers to read with it.
- **Reminders** ("Add reminders to my calendar" on the Daily timetable card) download
  a `.ics` calendar file with one daily reminder per medicine and time, until the
  course's last day (30 days for medicines to keep taking). As-needed medicines and
  ones without a number of days get no reminders, and the screen says why.
- **Light / dark** follows the phone by default. Printing and PDFs are always light.

## My prescriptions (Stage 8)

- Nothing is saved until the person taps **Save to My prescriptions** on the summary
  (or turns on "Save summaries automatically" in Settings; it is off by default because
  phones are often shared).
- Saved prescriptions live only in the phone's browser storage (IndexedDB), never on the
  server. The reading, the checks, notes, start date and a small preview picture are in one
  store; the full photos in another, loaded only when a prescription is opened.
- Once saved, later changes (editing on the checking screen, changing the start date,
  the safety check finishing) are kept up to date automatically.
- **Delete** removes one; **Delete all** removes every saved prescription and the saved
  translations. If the phone is full, the prescription is saved without its photos and the
  person is told. In a private window saving isn't possible and the page says so.
- Clearing the browser's site data for this website also deletes everything.

## Notes

- **Download PDF** turns each card into a picture inside the PDF, so Urdu and
  Sindhi look exactly as on screen. The text in the PDF is therefore not
  selectable. "Print" uses the phone or computer's own printing (and "Save as PDF").

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
