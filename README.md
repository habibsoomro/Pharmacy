# Nuskha: AI prescription reader for your pharmacy

A mobile-first pharmacy website that reads prescription photos (including
handwritten ones) and explains them in English, Urdu and Sindhi.

## What it does

- **Home page** with a big "Scan your prescription" button, how it works, opening hours, call and WhatsApp.
- **Scan** (`/scan`): take photos with the back camera or upload (JPG, PNG, iPhone HEIC, first page of a PDF), up to 4 pages; crop, rotate, retake; warnings for dark, blurry or small photos; photos are shrunk on the phone to save data. Asks permission before the first scan.
- **AI reading** (`/api/extract`): Claude reads the prescription as a Pakistani clinical pharmacist would (shorthand like `1+0+1`, `TDS`, `x 1/52`, Urdu instructions, Pakistani brands). The answer is checked against a strict format, and our own rules double-check the shorthand, quantities and brand → generic names.
- **Check what we read** (`/review`): editable form beside the photo; unsure or unreadable items in amber with ⚠; pharmacist mode for staff.
- **Summary** (`/summary`): safety alerts, doctor, patient, diagnosis, one card per medicine with pictures, daily timetable, course calendar, interactions, general care. Copy, WhatsApp, print, PDF, read aloud, calendar reminders, save on the phone.
- **Safety check** (`/api/interactions` plus the pharmacy's own list of 58 rules): interactions, duplicates, doses for age and weight, allergies, antibiotics without a duration. Never tells anyone to stop or change a medicine.
- **Settings**: 7 summary languages (English, Urdu, Sindhi, Roman Urdu, Punjabi, Pashto, Balochi; the last three "beta"), Simple/Detailed, text size, light/dark, patient/pharmacist view, picture mode, show/hide cards, read-aloud speed, automatic saving.
- **My prescriptions** (`/history`): saved only on the phone; open, search, delete one or all.
- **Privacy and safety**: nothing about prescriptions is stored on the server; rate limits, size limits, optional daily budget, security headers, friendly errors in the person's language.

Built in 10 stages: (1) setup and home page, (2) photo capture, (3) AI reading,
(4) review screen, (5) safety check, (6) summary cards, (7) settings, translation,
read aloud and reminders, (8) My prescriptions, (9) privacy, limits and errors,
(10) sample prescriptions, tests and this guide.

---

## What you need

- **Node.js 20 or newer**: download from https://nodejs.org (choose "LTS").
- **An Anthropic API key**: from https://console.anthropic.com. (You can try everything without one in test mode, below.)

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

Add one of these lines to `.env.local` and restart `npm run dev`. Every scan then
returns a fixed sample prescription (no AI call, no cost, any photo will do):

| Line | Sample |
|---|---|
| `AI_MOCK=1` | messy handwriting, 5 medicines, some unreadable parts |
| `AI_MOCK=printed` | clean printed prescription (diabetes, blood pressure) |
| `AI_MOCK=child` | 4-year-old with syrups in ml, one dose too high for the weight |
| `AI_MOCK=elderly` | 72-year-old on 9 medicines with serious interactions |
| `AI_MOCK=notrx` | a photo that is not a prescription |

Translations in test mode are not real: each text just gets a marker such as
`[ps]` in front, so you can see where translated text appears.
Remove the line to use the real AI. **Never set AI_MOCK on the live website.**

To try the real AI with known answers, upload the pictures in `tests/samples/`
(see `tests/samples/README.md` for what each one should show).

### Run the automatic tests

```
npm test            # quick checks of the logic (about 2 seconds)
npm run typecheck   # also catches a missing line in ur.json / sd.json
npm run test:e2e    # browser tests on a 360 px phone screen (about 2 minutes)
```

- `npm test` checks the shorthand reader (`1+0+1` → 2 times a day, `1/52` → 7 days),
  quantities, duplicate medicines, the safety rules, the 5 sample prescriptions from
  start to finish, translations, reminders, saving on the phone, and the request limits.
- `npm run test:e2e` builds the site, starts it in test mode and, in a real browser:
  checks every page in Urdu and Sindhi is right-to-left with the right font and never
  scrolls sideways at 360 px (also with Extra-large text and the Settings panel open),
  and goes through upload → check → summary → save → delete. The first time on a
  computer, run `npx playwright install chromium` once. Screenshots of every Urdu and
  Sindhi page are saved in `test-results/` for you to look at.

To test on your phone: connect phone and computer to the same Wi-Fi and open
`http://YOUR-COMPUTER-IP:3000` on the phone. (Most phones only allow the camera
on HTTPS sites, so full camera testing is easiest after deploying to Vercel.)

## Put it online (Vercel, free tier)

1. Upload the project to a GitHub repository.
2. Go to https://vercel.com, sign in with GitHub, click **Add New → Project** and pick the repository.
3. Under **Environment Variables**, add `ANTHROPIC_API_KEY` with your key.
   Also add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (free at https://upstash.com)
   so the visitor limits work across all of Vercel's servers, and optionally
   `RATE_LIMIT_SALT` and `AI_DAILY_LIMIT` (see `.env.example`).
4. Click **Deploy**. Vercel gives you a web address you can share.

---

## Version inside Claude (no server, no API key)

`npm run build:artifact` builds the same website as one page that runs inside Claude
(an "Artifact") into `dist-artifact/`. There, reading, the safety check and
translations are done by Claude **on each visitor's own Claude account**: no API key,
no server, no hosting bill. Everything else (screens, rules, languages, My
prescriptions) is the same code as the website. The differences:

- Visitors must be signed in to Claude, and the page must be shared with them
  (Share menu on the page). The first time, Claude asks them to allow the page to use Claude.
- The in-page camera isn't allowed there: "Take photo" opens the phone's own camera or
  photo picker instead. Printing isn't available; "Download PDF" and calendar reminders
  are saved through Claude's own "save file" prompt.
- What changes: `artifact/` (app shell, page switching, the Claude connection) and
  `scripts/build-artifact.mjs`. The website itself is unchanged.

## Before going live (checklist)

1. **Pharmacy details**: name, logo, colours, phone, WhatsApp, address, hours in `config/site.ts`.
2. **Medical content reviewed by a pharmacist**: `prompts/` (all three prompts),
   `data/brand-generics.json`, `data/interactions.json`, `data/care.json`, and the dose
   limits in `lib/rx/safety.ts`.
3. **Translations checked by native speakers**: `locales/ur.json` and `locales/sd.json`.
4. **Privacy policy checked**, ideally by a lawyer, and compared with Anthropic's current
   terms (see "Privacy and safety" below). Update `POLICY_UPDATED` in `components/PrivacyContent.tsx`.
5. **On Vercel**: `ANTHROPIC_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
   and if you like `RATE_LIMIT_SALT` and `AI_DAILY_LIMIT`. Make sure `AI_MOCK` is **not** set.
6. **Try real prescriptions** on real phones: a few handwritten ones, an iPhone photo
   (HEIC), a PDF, and the camera on a cheap Android phone. Check Read aloud and the
   calendar reminders on those phones too.
7. Set a monthly spending limit in the Anthropic console.

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
| How many safety checks per visitor | `app/api/interactions/route.ts` (20 per 10 minutes) |
| Daily limit for the whole website | `AI_DAILY_LIMIT` environment variable (none by default) |
| Privacy policy text | `locales/*.json` → `privacy`; the "Last updated" date is `POLICY_UPDATED` in `components/PrivacyContent.tsx` |

**Translation safety net:** if you add a new line to `en.json` but forget it in
`ur.json` or `sd.json`, run `npm run typecheck` and it will tell you exactly
which line is missing.

## Folder map

```
app/          pages: home, scan, review, summary, history, about, contact, privacy; api/ (extract, interactions, translate)
components/   header, footer, language switcher, buttons, cards
config/       site.ts (pharmacy details), ai.ts (model), capture.ts (photo limits)
lib/          the logic: rx/ (shorthand, checks, safety), summary/, client/ (phone side), server/ (AI, limits), schemas/
locales/      translation files
prompts/      AI prompts: reading, safety check, translation
data/         interaction rules, medicine groups, brand → generic list, general care texts
tests/        unit/ (npm test), e2e/ (npm run test:e2e), fixtures/ (sample AI answers), samples/ (sample pictures)
scripts/      helper scripts (PDF reader file, sample pictures)
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

## Settings

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

## My prescriptions

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

## Privacy and safety

- **Nothing about a prescription is stored on the server.** Photos and results are used
  for one request and forgotten. Error logs contain only the kind of error.
- **Limits** on every AI route: requests must come from this website, be JSON, stay under a
  size limit (checked while reading, so huge uploads are stopped early), and each visitor
  has a limit per 10 minutes. Visitors are counted by a scrambled (hashed) form of their
  internet address. With Upstash set up, counts are shared across all servers; if Upstash
  is unreachable the site keeps working with each server's own count.
- **`AI_DAILY_LIMIT`** (optional) caps all AI requests per day (resets at midnight UTC,
  5 am in Pakistan). After that, people see "The reading service is very busy today".
- **Security headers**: a Content Security Policy (the page can only load code and data from
  this site and talk only to this site's server), no framing by other sites, camera only
  on this site. `'unsafe-eval'` is allowed because the iPhone (HEIC) photo converter needs it.
- **Errors** are explained in the person's language: no internet (a banner on every page,
  and again when the connection returns), not a prescription, too many scans, service busy,
  photos too big, reading failed or took too long. If the AI's answer is broken, the server
  asks it once more automatically before showing a message.
- **Hard-to-read prescriptions** ("poor" handwriting) show a strong red warning on the
  checking screen and the summary, with buttons to call, WhatsApp or find the pharmacy.
- **Before going live, have the privacy policy checked** (ideally by a lawyer), especially
  the part about Anthropic: compare it with Anthropic's current commercial terms and
  privacy policy, and make sure your Anthropic account settings match what it says.

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
