# Nuskha: AI prescription reader for your pharmacy

A mobile-first pharmacy website that reads prescription photos (including
handwritten ones) and explains them in English, Urdu and Sindhi.

**Current stage: 1 of 10** (project setup, home page, language switching).

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
| AI prompts (from Stage 3) | `prompts/` folder |

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

## Notes

- Fonts (Inter, Noto Nastaliq Urdu, Noto Naskh Arabic) are downloaded once when
  the site is built and served from your own site. Urdu and Sindhi fonts are
  only downloaded by people who switch to those languages.
- The decorative strip at the top and bottom is inspired by Sindhi ajrak.
  Red is kept for danger alerts only.
