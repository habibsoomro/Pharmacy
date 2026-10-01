# Prompt: build "Nuskha" as a Claude Artifact

Copy everything below the line into Claude (claude.ai, or Claude Code with the
Artifact tool). It describes the single-page version of Nuskha that runs inside
Claude, with no server and no API key. It already includes what we learned while
building it (what the Artifact sandbox blocks, the photo problem, the safety rules),
so Claude doesn't have to discover those again.

Change the pharmacy details in section 3 before you paste it.

---

## 1. What to build

Build **"Nuskha Pharmacy"**, a mobile-first prescription reader for a pharmacy in Sindh, Pakistan, as **one Claude Artifact page**. A patient or pharmacy staff member adds a photo of a prescription. Claude reads it like an experienced Pakistani clinical pharmacist would. The person checks and corrects what was read, then sees a simple summary in **English, Urdu (اردو) or Sindhi (سنڌي)**: each medicine, when to take it, and safety warnings.

Most users are on cheap Android phones with slow internet, many prescriptions are **handwritten**, they mix English with Urdu, and they use **Pakistani brand names** (Panadol, Augmentin, Risek, Brufen, Flagyl…).

Build it as a polished, production-quality page, not a demo. Plain HTML/CSS/JS, or React loaded as a UMD build from cdnjs, both work. Keep all code inside the artifact.

## 2. How the page reaches Claude: no server, no API key

- Use the Artifact runtime's **`sample` capability**: `const sample = await window.claude.use("sample")`, declared as `capabilities: { sample: {}, downloads: true }` when publishing. Calls run on **the viewer's own Claude account**. The first call asks the viewer to allow it.
- `sample` has no system prompt. Put the instructions, the data and the required JSON format in one input string (instructions, then `---`, then the request).
- Send photos with `sample(prompt, { images: [blob, …], cache: false })`.
- **Do not decide in advance whether photos work.** `sample.limits()` may not mention images even where they work. Only use `limits().images?.maxCount` to know how many pictures one call may carry. If it is unknown, or there are more pages than allowed, join the pages top-to-bottom into one JPEG on a canvas.
- **If a call rejects with `images_unavailable`, show the "type it instead" fallback** (section 5.2). Some Claude apps never let pages send photos, so this fallback is essential, not optional.
- Always use `cache: false`. Never call Claude in a loop or on a timer, only after the person taps a button.
- **Check every answer:** extract the JSON object from the reply (ignore stray text or ``` fences) and validate it field by field. If it is not valid, or `truncated` is true, ask **once** more: send the original prompt, Claude's reply, and "Your previous answer could not be used because: <list of problems>. Reply again with ONLY the corrected JSON object." Re-send the images with it. If it still fails, show a friendly error.
- Map Claude's error codes to friendly messages in the chosen language:
  - `not_granted` → "Reading needs your permission to use Claude. Tap Read prescription again and choose Allow."
  - `sampling_disabled` / `session_expired` / `use()` returned null → "Please sign in to Claude to read prescriptions on this page."
  - `rate_limited` → "Too many requests. Please wait a few minutes."
  - `refused` / `invalid_json` / `empty_completion` → "We couldn't read this prescription properly. Try a clearer photo, or show it to our pharmacist."
  - anything else → "Something went wrong while reading. Please try again."
- Log failures to the console as `[nuskha] Claude call failed: <code> <message>` so problems can be diagnosed.

## 3. Pharmacy details (one config object at the top of the script)

```js
const SITE = {
  name: { en: "Nuskha Pharmacy", ur: "نسخہ فارمیسی", sd: "نسخو فارميسي" },
  colors: { brand: "#1E3A6E", brandDeep: "#142850", madder: "#A8322B" }, // indigo + madder red from Sindhi ajrak; red only for danger
  phone: "+92 300 0000000",
  whatsapp: "923000000000",
  address: { en: "Shop 12, Main Road, Hyderabad, Sindh", ur: "دکان نمبر 12، مین روڈ، حیدرآباد، سندھ", sd: "دڪان نمبر 12، مين روڊ، حيدرآباد، سنڌ" },
  hours: [{ days: "Monday to Saturday", time: "9:00 am to 11:00 pm" }, { days: "Sunday", time: "2:00 pm to 10:00 pm" }],
};
```

## 4. What the Artifact sandbox allows (design around these limits)

- **No live camera** (getUserMedia is refused). "Take photo" is `<input type="file" accept="image/*" capture="environment">`. "Upload photo" is `<input type="file" accept="image/*,application/pdf" multiple>`.
- **No printing** (`window.print()` does nothing) and **no plain downloads** (`<a download>` is inert). Save files with the `downloads` capability: `(await claude.use("downloads")).save({ filename, data: blob })`.
- **No `alert` / `confirm` / `prompt`.** Build confirmations into the page, for example a "Delete? Yes / No" row.
- `tel:` and `mailto:` links may do nothing. Always show the phone number as selectable text next to any call button.
- External scripts load only from cdnjs.cloudflare.com, cdn.jsdelivr.net/npm, unpkg.com. Stylesheets load only from Google Fonts. Everything else must be inline.
- `localStorage` and IndexedDB work per viewer. Wrap every access in try/catch.
- The page renders in the viewer's light or dark theme. Define every colour as a token on `:root`, redefine them for dark under `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {…} }` and again under `:root[data-theme="dark"]`, and give `body` a token background.
- It must work at **360 px** wide with no sideways scrolling.

## 5. Screens

Navigate between screens inside the page with a state variable; there are no URLs. Put a header on every screen with the pharmacy name, an **English / اردو / سنڌي** switch and a ⚙ Settings button. The footer carries the disclaimer.

### 5.1 Home
- Big "Scan your prescription" button.
- "How it works" in 3 numbered steps: Take a photo → Check what we read → See a simple summary.
- Opening hours, address, phone, a WhatsApp link (`https://wa.me/<number>?text=…`).
- One line: "This version runs inside Claude. Reading uses your own Claude account; nothing is sent to the pharmacy."

### 5.2 Scan
- **Photos:** up to **4 pages**. For each page, a preview card with **Rotate 90°**, **Crop** (drag four corners on a canvas), **Retake** and **Remove**.
- **Quality check** on each photo, with simple tips:
  - too dark (average brightness low): "Use more light";
  - blurry (low variance of a Laplacian filter on a 512 px grey copy): "Hold the phone steady";
  - too small (short side under ~1000 px): "Move closer, but fit the whole page".
  
  Warnings never block continuing.
- **Shrink before sending:** longest side 1600 px, JPEG quality 0.85.
- **PDF:** first page only, using pdf.js from cdnjs. Its worker must be the cdnjs `pdf.worker.min.js` loaded from a `blob:` URL, or skip PDFs and say so.
- **Consent tick-box before the first scan:** "I understand my prescription photo will be sent to an AI service (Anthropic's Claude) to read it." Remember the tick.
- **Loading screen** with steps: Reading prescription → Identifying medicines → Checking interactions → Preparing summary.
- **Typed fallback** (when photos are refused):
  - Keep the photos on screen and show a box: "Type the prescription instead". Hint: copy it line by line, e.g. `Tab Augmentin 625mg 1+0+1 x 5 days`, Urdu like `کھانے کے بعد` is fine, type `?` for anything unreadable.
  - Send the text with the same reading prompt, plus: "There is no photo. A person typed the prescription below. Use only what is in the text; anything marked ? is unreadable (null, low confidence, add to unreadable_fields)."
  - After the first refusal, go straight to this mode for the rest of the visit.

### 5.3 Reading prompt (send this, then the photos)

Use this text exactly; it is the result of many test rounds:

> You are an experienced clinical pharmacist in Sindh, Pakistan. Your job is to READ a prescription from one or more photos and copy what is written into a structured JSON record. Many prescriptions are handwritten, may mix English with Urdu (or Sindhi), and use Pakistani brand names.
>
> **Never invent or guess.** Only record what you can read. Not written or unreadable → value null. Partly readable → write what you can, confidence "low". Add every field that seems written but can't be read to "unreadable_fields" ("medicine 2 strength", "patient age"). A wrong medicine, strength or dose can harm a patient: when in doubt, null and "low". Confidence: "high" = clear and sure; "medium" = slightly unclear or you resolved an abbreviation; "low" = guessed, very unclear, or partly read.
>
> **Shorthand.** OD/QD = once a day; BD/BID = twice; TDS/TID = three times; QID/QDS = four times; HS = bedtime; SOS/PRN = only when needed; STAT = one dose now. Patterns are morning+afternoon+night: "1+0+1"/"1-0-1" = morning and night; "1+1+1" = three times; "0+0+1" = night; four parts = morning+afternoon+evening+night; "½+0+½" = half tablet twice. Fill "schedule" with units per time (BD with no times → morning 1, night 1; TDS → morning, afternoon, night; OD → morning; SOS/PRN → all 0 and times_per_day null). Duration: "x 5 days" = 5; "5/7" = 5 days; "1/52" = 7 days; "2/52" = 14; "1/12" = 30; "cont." = ongoing (duration_days null, duration_text "continue"). Forms: Tab, Cap, Syp, Susp, Inj, Drops/Gtt, Oint, Sachet; tsp/TSF = 5 ml. Food: AC = before meal, PC = after meal; کھانے سے پہلے = before meal; کھانے کے بعد = after meal; کھانے کے ساتھ = with meal; نہار منہ / خالی پیٹ = empty stomach; صبح morning, دوپہر afternoon, شام evening, رات night, ضرورت کے وقت when needed. No food timing written → null.
>
> **Brands.** Copy the brand exactly (fix only obvious spelling). Give the generic (salt) name; "brand_mapping_certain" true only if sure. Unknown brand → generic_name null, brand_mapping_certain false; never make one up. Examples: Panadol = Paracetamol; Calpol = Paracetamol; Augmentin = Amoxicillin + Clavulanic acid; Risek = Omeprazole; Brufen = Ibuprofen; Flagyl = Metronidazole; Glucophage = Metformin; Concor = Bisoprolol; Softin = Loratadine; Amoxil = Amoxicillin; Coumadin = Warfarin; Lowplat = Clopidogrel; Ventolin = Salbutamol; Zyrtec = Cetirizine.
>
> **Calculations.** times_per_day; duration_days; total_quantity_needed only if dose, frequency and duration are all known, with a unit ("10 tablets", "75 ml"), half tablets rounded up. purpose_in_simple_words: what the medicine is usually for, in 3–8 plain words. special_instructions: only what is written for that medicine, Urdu translated to simple English.
>
> If it is clearly not a prescription, return only {"is_prescription": false, "reason": "…"}. Today is <YYYY-MM-DD>; dates as YYYY-MM-DD when fully readable (Pakistani dates are day/month/year). Several photos are pages of one prescription: combine them and don't repeat a medicine.
>
> Return ONLY one JSON object, no other text, in this shape. Every "field" is {"value": string or null, "confidence": "high"|"medium"|"low"}:
> `{ "is_prescription": true, "prescription_date": field, "doctor": { "name", "qualifications", "specialty", "registration_no" (PMDC), "clinic_or_hospital", "address", "phone" } (all fields), "patient": { "name", "age", "sex", "weight", "address", "phone", "mr_or_file_no" } (all fields), "clinical": { "diagnosis_or_complaints": field, "vitals": { "blood_pressure", "pulse", "temperature", "other" } (fields), "tests_advised": [string], "allergies_mentioned": field, "follow_up_date": field, "other_advice": field }, "medicines": [ { "brand_name", "generic_name", "brand_mapping_certain": bool, "strength", "dosage_form", "dose_per_time", "frequency_text" (as written), "times_per_day": number|null, "schedule": {"morning","afternoon","evening","night"} (numbers), "route", "food_timing": "before meal"|"after meal"|"with meal"|"empty stomach"|"any"|null, "duration_days": number|null, "duration_text", "total_quantity_needed", "special_instructions", "purpose_in_simple_words", "confidence", "uncertain_fields": [string] } ], "unreadable_fields": [string], "overall_legibility": "good"|"fair"|"poor" }`

**After reading, double-check it with your own code, never silently overwriting:**
- Re-parse `frequency_text` and `duration_text` with the shorthand rules above (`1+0+1` → 2 times a day; `1/52` → 7 days).
- Recalculate the total quantity.
- Compare brand → generic with a built-in list of ~100 Pakistani brands.
- Fill gaps the AI left empty. Where your result disagrees with the AI's, flag the field for checking (amber ⚠) with "Our check suggests: …" and a "Use this" button.

### 5.4 Check what we read (review and edit)
- An editable form for every field, grouped as Doctor, Patient, Diagnosis and advice, Medicines, and Things we couldn't read.
- Low-confidence, unreadable or disagreeing fields are **amber with ⚠** and a "Looks right" button. A counter shows "N item(s) need checking", with a "Show me" button.
- The original photo is beside the form on wide screens, and behind a "View prescription" button with zoom on phones.
- **Pharmacist mode** switch: shows every field (PMDC number, MR number, route, AI confidence) plus a note per medicine and a general note.
- Medicines can be added and removed (with an in-page confirmation).
- Button: **"Looks correct — Show Summary"**. Keep the original AI reading alongside the edited one.
- If overall_legibility is "poor": a strong red warning, "This prescription is hard to read. Please show it to our pharmacist in person before taking anything", with Call (number shown), WhatsApp and Directions buttons.

### 5.5 Safety check (runs on the checked prescription)
1. **Your own rules first** (instant, offline): a built-in list of ~50–60 well-known interactions, matched by generic name and drug group. For example:
   - warfarin + NSAIDs / aspirin / clopidogrel / metronidazole / azoles / co-trimoxazole;
   - clopidogrel + omeprazole; aspirin + NSAID;
   - clarithromycin / erythromycin + simvastatin / lovastatin;
   - domperidone + macrolides or azoles;
   - ciprofloxacin + theophylline / tizanidine;
   - quinolones / tetracyclines / levothyroxine + antacids, iron or calcium;
   - ACE inhibitor / ARB + potassium or spironolactone, ACE inhibitor + ARB, ACE inhibitor / ARB / diuretic + NSAID;
   - beta-blocker + verapamil or diltiazem; sildenafil + nitrates; lithium + NSAID;
   - tramadol + SSRI; benzodiazepine + opioid; metronidazole + alcohol.
   
   **Also check:**
   - the same generic under two brands (Panadol + Calpol), and two NSAIDs together;
   - adult daily maximums (paracetamol 4 g, ibuprofen 3.2 g, diclofenac 150 mg…);
   - children's doses per kg (paracetamol 15 mg/kg per dose, ibuprofen 10 mg/kg per dose); if there is no weight for a child, ask for one;
   - age rules: aspirin under 16, tetracycline under 8, codeine / tramadol under 12, quinolones under 18, benzodiazepines / NSAIDs / glibenclamide over 65;
   - allergies written on the prescription vs. the medicines;
   - antibiotics with no number of days.
2. **Then ask Claude** (text only, sending only the medicines, age, sex, weight, diagnosis and allergies, **never names or phone numbers**) to act as a Pakistani clinical pharmacist and return `{ "interactions": [{ "type": "drug-drug"|"drug-food"|"drug-disease"|"duplicate-therapy"|"dose-check", "drugs_involved": [], "severity": "major"|"moderate"|"minor", "what_happens", "what_to_do", "confidence" }], "age_specific_warnings": [], "pregnancy_breastfeeding_note": string|null, "no_interactions_found": bool }`. Tell it: only clinically meaningful problems, very simple English, and NEVER tell the patient to stop, skip, reduce, increase or switch a medicine, only safe actions (talk to the doctor or pharmacist, space doses apart, take with food, avoid alcohol, watch for a sign, get urgent help).
3. **Merge:** an alert found by both is shown once, marked "Found by both checks", keeping the more serious level.
4. **Safety net in code:** replace any advice that says stop, skip, reduce, increase or switch a medicine with "Talk to your doctor or pharmacist before changing how you take this medicine."
5. **Colours:** red = serious, orange = moderate, yellow = minor, green = none found.
6. If Claude can't be reached, show your own rules' result with "The online check isn't available right now".
7. Always show: "This check is a helper, not a replacement for your doctor or pharmacist. Please confirm before making any changes."

### 5.6 Summary: separate cards
Each card has an icon, a heading, plain words, and Copy / WhatsApp / 🔊 Read aloud buttons.

1. 🚨 **Safety alerts** (top, only if something was found; can't be hidden).
2. 👨‍⚕️ **Doctor** (phone shown as text).
3. 🧑 **Patient**.
4. 🩺 **Diagnosis and advice**.
5. 💊 **One card per medicine**:
   - brand name in large type, generic name under it, strength, what it's for;
   - a row of four boxes Morning / Afternoon / Evening / Night with sun/moon pictures and the number of units;
   - how much, how often, before/after food (plate picture), how to take it (swallow / dissolve / shake the bottle / eye drops / apply on skin…), how many days, total needed, special instructions.
6. 🕒 **Daily timetable**: Morning / Afternoon / Evening / Night with each medicine and amount. "Only when needed" medicines (SOS, PRN, even "TDS SOS") are listed separately, never at fixed times.
7. 📅 **Course calendar**: an editable start date, then for each medicine its last day, "Day 3 of 5" and a progress bar.
8. ⚠ **Interactions in detail**.
9. ℹ **General care**: common side effects per medicine, food and drink to avoid, storage tips, "get help urgently if…".

**Actions for the whole summary:** WhatsApp (whole text), Copy, Download PDF (html2canvas + jsPDF from cdnjs, one picture per card, saved through `downloads`), Read aloud, Save to My prescriptions.

**Disclaimer** at the top and bottom: "AI can make mistakes, especially with handwriting. Always confirm with your pharmacist or doctor."

**Medicine names stay in English everywhere**, even in Urdu and Sindhi, because pharmacies stock them by English names. Wrap them in `<bdi dir="ltr">` so they display correctly inside right-to-left text.

### 5.7 Settings panel (saved in localStorage)
- **Language:**
  - English, Urdu and Sindhi switch the whole page; keep all interface text in three dictionaries.
  - Roman Urdu, Punjabi (Shahmukhi), Pashto and Balochi (the last three marked "beta") are for the summary only. Claude translates the labels and the prescription texts, keeping brand and generic names, numbers and `{placeholders}` unchanged, and never adding advice.
  - Save translations in localStorage so each text is translated only once.
- **Reading level:** Simple (default: easiest words, fewer details) or Detailed (prescription shorthand, vital signs, all side effects).
- **Text size:** Normal / Large / Extra large (scale the root font size).
- **Light / dark / same as phone.**
- **View:** Patient or Pharmacist. Pharmacist adds generic + strength + form, AI confidence pills, PMDC/MR numbers, and a "Dispensing list" card with quantities to dispense.
- **Picture mode** on/off.
- **Show/hide each card** (Safety alerts is always on).
- **Read-aloud speed:** slow/normal, using `speechSynthesis`. Pick a voice for the language (ur-PK, sd, en-IN…). If there is none, say "This phone has no voice for Sindhi" and offer the Urdu voice. Read in short chunks of about 200 characters, with emojis removed.
- **Medicine reminders:** a button on the timetable makes an `.ics` calendar file, one daily repeating event per medicine and time (morning 08:00, afternoon 14:00, evening 19:00, night 22:00, all editable), until the course's last day (30 days for "continue"). As-needed medicines get none, and the page says why. Save it through `downloads`.
- **Save summaries automatically** (off by default, because phones are often shared).
- Buttons: "Delete saved translations" and "Reset all settings".

### 5.8 My prescriptions
- Saved only in this browser (IndexedDB): one store for records and a small preview picture, another for full photos.
- A list with the preview, patient, doctor, date, medicines and a serious-alert count. Buttons: Open, Delete (in-page confirm), Delete all (in-page confirm, also clears saved translations).
- A search box once more than 3 are saved.
- Note: "Anyone who uses this phone can see these."
- Once saved, a prescription stays updated after later edits.

### 5.9 About, Contact, Privacy
Short pages in all three languages. The privacy text, in plain words:
- the photo goes to Anthropic's Claude only to read it, on the visitor's own Claude account;
- nothing is sent to or kept by the pharmacy;
- saved items live only on this phone and can be deleted;
- no ads, no tracking;
- children's prescriptions should be scanned by a parent;
- this is not medical advice.

## 6. Languages and right-to-left

- Urdu and Sindhi switch the whole page to `dir="rtl"`.
- Fonts from Google Fonts: **Noto Nastaliq Urdu** for Urdu (line-height about 2.2), **Noto Naskh Arabic** for Sindhi (it has ڪ ڳ ڄ ٻ ڀ ٽ ڏ ڌ ڙ ڻ), **Inter** for English.
- Numbers, doses and medicine names stay left-to-right inside `<bdi>`.
- In right-to-left, Morning appears on the right.
- Write natural Pakistani Urdu and Sindhi, not word-for-word translations. Example Sindhi labels: صبح، منجهند، شام، رات; ڪيترا ڀيرا; کاڌي کان پوءِ.

## 7. Safety rules that must never be broken

1. Never invent a medicine, dose or name. Unknown means null and ⚠.
2. Never tell anyone to stop, skip or change a medicine; only "talk to your doctor or pharmacist".
3. Always show the AI disclaimer on the summary, and a strong warning when the handwriting is poor.
4. Never send the patient's or doctor's name, phone or address to the safety check or translation.

## 8. Before you hand it over, test with these cases (use typed text if photos aren't available)

1. **Clean printed prescription**, 52-year-old woman with diabetes and high blood pressure:
   - Tab Glucophage 500 mg 1+0+1 x 1/12 after meals → 60 tablets
   - Tab Concor 5 mg 1+0+0 x 1/12 → 30
   - Cap Risek 20 mg 1+0+0 before breakfast x 2/52 → 14
   - Tab Softin 10 mg 0+0+1 x 5 days → 5
   
   No serious alerts.
2. **Messy handwriting** with some words marked `?`: those fields are ⚠ and listed as unreadable, never guessed.
3. **Child, 4 years, 14 kg:**
   - Susp Amoxil 250 mg/5 ml 5 ml TDS x 7 days → 105 ml
   - Syp Calpol 120 mg/5 ml 10 ml TDS SOS → **serious alert: 240 mg is too much for 14 kg** (max about 210 mg per dose), and it appears under "Only when needed", not in the timetable
   - Susp Brufen 100 mg/5 ml 5 ml 1+1+1 x 3 days → 45 ml
4. **Elderly, 72, nine medicines** including Coumadin (warfarin) 5 mg 0+0+1, Brufen 400 mg TDS, Lowplat (clopidogrel) 75 mg, Panadol + Panadol Extra, and Augmentin with a penicillin allergy written:
   - serious alerts for warfarin + ibuprofen and warfarin + clopidogrel;
   - a duplicate paracetamol warning;
   - an allergy alert;
   - an age warning for NSAIDs over 65.
5. **A shop receipt** → "This doesn't look like a prescription".

Also check:
- Urdu and Sindhi at 360 px wide: right-to-left, the correct font, no sideways scrolling, including with Extra-large text and the Settings panel open.
- Dark mode is readable.
- If Claude isn't allowed or the viewer isn't signed in, the right messages appear.
