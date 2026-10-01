# Sample prescriptions

Five test cases from the project brief. Each has the expected AI answer in
`tests/fixtures/` (used by the automatic tests and by test mode, `AI_MOCK`).
The pictures here let you try the **real** AI and compare its answer with the expected one.
All names, numbers and clinics are made up.

| # | Case | Picture | Expected answer | Test mode | What to look for |
|---|------|---------|-----------------|-----------|------------------|
| 1 | Clean printed prescription | `1-printed.png` | `extraction-printed.json` | `AI_MOCK=printed` | Everything read with high confidence; `x 1/12` = 30 days, `x 2/52` = 14 days; no serious alerts |
| 2 | Messy handwriting | (use a real, anonymised prescription) | `extraction-handwritten.json` | `AI_MOCK=1` | Unclear items marked ⚠ and listed as unreadable, never guessed |
| 3 | Child, syrups in ml | `3-child.png` | `extraction-child.json` | `AI_MOCK=child` | Totals in ml (105 ml, 45 ml); **serious alert: Calpol 10 ml is too much for 14 kg**; Calpol "TDS SOS" only when needed |
| 4 | Elderly, 9 medicines, real interactions | `4-elderly.png` | `extraction-elderly.json` | `AI_MOCK=elderly` | Warfarin (Coumadin) + Brufen and + Lowplat flagged serious; duplicate paracetamol; penicillin allergy vs Augmentin; age warnings |
| 5 | Not a prescription | `5-not-a-prescription.png` | `extraction-not-prescription.json` | `AI_MOCK=notrx` | "This doesn't look like a prescription" |

Pictures are made with `node scripts/make-sample-images.mjs` from the fixtures, so
if you change a fixture, run it again.

Handwriting can't be faked convincingly. Collect a few real prescriptions (with the
patient's permission, names covered) to check case 2 before going live.
