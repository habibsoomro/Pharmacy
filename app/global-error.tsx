"use client";

/**
 * Last-resort page if even the main layout fails. It can't use the translation
 * files, so it shows English, Urdu and Sindhi together, with plain styles.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: 24, background: "#f3f5f8", color: "#1a2233" }}>
        <h1 style={{ fontSize: 22 }}>Something went wrong</h1>
        <p dir="rtl" lang="ur">کچھ غلط ہو گیا۔ براہ کرم دوبارہ کوشش کریں۔</p>
        <p dir="rtl" lang="sd">ڪجهه غلط ٿي ويو. مهرباني ڪري ٻيهر ڪوشش ڪريو.</p>
        <button type="button" onClick={reset} style={{ minHeight: 48, padding: "0 20px", borderRadius: 12, border: 0, background: "#1E3A6E", color: "#fff", fontSize: 16 }}>
          Try again / دوبارہ کوشش کریں
        </button>
      </body>
    </html>
  );
}
