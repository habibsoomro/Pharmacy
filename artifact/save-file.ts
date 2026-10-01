import { useCapability } from "./claude";

/** Inside Claude, pages can't start downloads: Claude's viewer asks the person to save the file instead. */
export async function saveFile(fileName: string, blob: Blob): Promise<void> {
  const downloads = await useCapability<{ save(req: { filename: string; data: Blob }): Promise<unknown> }>("downloads");
  if (!downloads) throw new Error("Saving files isn't available here");
  await downloads.save({ filename: fileName, data: blob });
}
