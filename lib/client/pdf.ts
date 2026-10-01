import { saveFile } from "@/lib/client/save-file";

/**
 * Turns the summary on screen into a PDF, one picture per card, so Urdu and
 * Sindhi text look exactly as on screen. The libraries (~500 KB) are only
 * downloaded when someone presses "Download PDF".
 */
export async function downloadSummaryPdf(container: HTMLElement, fileName: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
  await document.fonts?.ready;

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const usableW = pageW - margin * 2;
  const usableH = pageH - margin * 2;
  let y = margin;

  container.classList.add("pdf-mode");
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); // let the wider layout settle
  try {
    // Empty wrappers (e.g. no safety alerts) are skipped.
    const blocks = Array.from(container.querySelectorAll<HTMLElement>("[data-pdf-block]")).filter((b) => b.offsetHeight > 0);
    for (const block of blocks) {
      const canvas = await html2canvas(block, { scale: 1.6, backgroundColor: "#ffffff", useCORS: true, logging: false });
      const h = (canvas.height * usableW) / canvas.width;

      if (h <= usableH) {
        if (y + h > pageH - margin) {
          pdf.addPage();
          y = margin;
        }
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.82), "JPEG", margin, y, usableW, h);
        y += h + 3;
        continue;
      }

      // A block taller than a page (e.g. a long interactions list): cut it into page-sized slices.
      if (y > margin) {
        pdf.addPage();
        y = margin;
      }
      const slicePx = Math.floor((usableH * canvas.width) / usableW);
      for (let top = 0; top < canvas.height; top += slicePx) {
        const part = document.createElement("canvas");
        part.width = canvas.width;
        part.height = Math.min(slicePx, canvas.height - top);
        part.getContext("2d")!.drawImage(canvas, 0, top, canvas.width, part.height, 0, 0, canvas.width, part.height);
        const partH = (part.height * usableW) / part.width;
        if (top > 0) pdf.addPage();
        pdf.addImage(part.toDataURL("image/jpeg", 0.82), "JPEG", margin, margin, usableW, partH);
        y = margin + partH + 4;
      }
    }
  } finally {
    container.classList.remove("pdf-mode");
  }
  await saveFile(fileName, pdf.output("blob"));
}
