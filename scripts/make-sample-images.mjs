/**
 * Makes the sample prescription pictures in tests/samples/ from the sample data
 * in tests/fixtures/, so you can try the REAL AI with known answers.
 * Run: node scripts/make-sample-images.mjs   (needs: npx playwright install chromium)
 *
 * These are clean, printed-style pictures. Messy handwriting can't be faked well:
 * test that with a few real (anonymised) prescriptions from the pharmacy.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "tests", "samples");
fs.mkdirSync(out, { recursive: true });
const load = (n) => JSON.parse(fs.readFileSync(path.join(root, "tests", "fixtures", `${n}.json`), "utf8"));
const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const v = (f) => f?.value ?? "";

const FORM = { tablet: "Tab", capsule: "Cap", syrup: "Syp", suspension: "Susp", "dry suspension": "Susp", injection: "Inj" };
const FOOD = { "after meal": "کھانے کے بعد", "before meal": "کھانے سے پہلے", "empty stomach": "خالی پیٹ" };

function prescription(rx, { slant = 0 } = {}) {
  const meds = rx.medicines.map((m) => `
    <li><b>${esc(FORM[m.dosage_form] ?? m.dosage_form ?? "")} ${esc(m.brand_name)} ${esc(m.strength)}</b>
      <span class="sig">${esc(m.dose_per_time ?? "")} &nbsp; ${esc(m.frequency_text)} &nbsp; ${esc(m.duration_text ?? "")}</span>
      ${m.food_timing && FOOD[m.food_timing] ? `<span class="ur">${FOOD[m.food_timing]}</span>` : ""}
      ${m.special_instructions ? `<div class="note">${esc(m.special_instructions)}</div>` : ""}
    </li>`).join("");
  const c = rx.clinical;
  return `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#fffdf7;font-family:Georgia,serif;color:#1d2a44;width:820px}
    .page{padding:36px 44px;transform:rotate(${slant}deg)}
    .head{border-bottom:3px double #1d2a44;padding-bottom:10px;display:flex;justify-content:space-between}
    .doc{font-size:26px;font-weight:bold}.small{font-size:15px;line-height:1.5}
    .pt{display:flex;gap:28px;font-size:17px;margin:14px 0;border-bottom:1px solid #999;padding-bottom:8px;flex-wrap:wrap}
    .rx{font-size:44px;font-style:italic;margin:6px 0}
    ol{font-size:20px;line-height:1.5}li{margin-bottom:12px}.sig{display:block;margin-left:24px}
    .ur{display:block;margin-left:24px;font-size:18px;direction:rtl;text-align:left}
    .note{margin-left:24px;font-size:15px;color:#444}.foot{margin-top:24px;font-size:16px;border-top:1px solid #999;padding-top:8px}
  </style><div class="page">
    <div class="head"><div><div class="doc">${esc(v(rx.doctor.name))}</div><div class="small">${esc(v(rx.doctor.qualifications))}<br>${esc(v(rx.doctor.specialty))}<br>${esc(v(rx.doctor.registration_no))}</div></div>
    <div class="small" style="text-align:right">${esc(v(rx.doctor.clinic_or_hospital))}<br>${esc(v(rx.doctor.address))}<br>Ph: ${esc(v(rx.doctor.phone))}</div></div>
    <div class="pt"><span>Name: <b>${esc(v(rx.patient.name))}</b></span><span>Age: ${esc(v(rx.patient.age))}</span><span>Sex: ${esc(v(rx.patient.sex))}</span>
      ${v(rx.patient.weight) ? `<span>Wt: ${esc(v(rx.patient.weight))}</span>` : ""}<span>Date: ${esc(v(rx.prescription_date))}</span></div>
    <div class="small">${v(c.vitals.blood_pressure) ? `BP ${esc(v(c.vitals.blood_pressure))} &nbsp; ` : ""}${v(c.vitals.temperature) ? `Temp ${esc(v(c.vitals.temperature))} &nbsp; ` : ""}<b>Dx:</b> ${esc(v(c.diagnosis_or_complaints))}
      ${v(c.allergies_mentioned) ? ` &nbsp; <b>Allergy:</b> ${esc(v(c.allergies_mentioned))}` : ""}</div>
    <div class="rx">℞</div><ol>${meds}</ol>
    <div class="foot">${c.tests_advised.length ? `<b>Tests:</b> ${esc(c.tests_advised.join(", "))}<br>` : ""}${v(c.other_advice) ? `<b>Advice:</b> ${esc(v(c.other_advice))}<br>` : ""}${v(c.follow_up_date) ? `<b>Follow up:</b> ${esc(v(c.follow_up_date))}` : ""}</div>
  </div>`;
}

const receipt = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#fff;font-family:monospace;width:420px}div{padding:24px;font-size:18px;line-height:1.6}</style>
<div><center><b>AL-MADINA GENERAL STORE</b><br>Hyderabad<br>------------------------</center>
Milk 1 L ........... 260<br>Bread .............. 180<br>Eggs (12) .......... 420<br>Sugar 1 kg ......... 175<br>Tea 190 g .......... 590<br>------------------------<br><b>TOTAL ............ 1625</b><br><center>Thank you!</center></div>`;

const samples = [
  ["1-printed.png", prescription(load("extraction-printed"))],
  ["3-child.png", prescription(load("extraction-child"), { slant: -0.6 })],
  ["4-elderly.png", prescription(load("extraction-elderly"), { slant: 0.5 })],
  ["5-not-a-prescription.png", receipt],
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ deviceScaleFactor: 1.25 });
for (const [name, html] of samples) {
  await page.setContent(html);
  await page.locator("body").screenshot({ path: path.join(out, name) });
  console.log("made", path.join("tests", "samples", name));
}
await browser.close();
