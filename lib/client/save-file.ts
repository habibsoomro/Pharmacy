/**
 * Give the person a file (calendar reminders, PDF). On the website this is a
 * normal download. The version inside Claude swaps this file for one that asks
 * Claude's viewer to save it, because pages there can't start downloads.
 */
export async function saveFile(fileName: string, blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
