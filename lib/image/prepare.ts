import { CAPTURE } from "@/config/capture";
import { blobToBase64, scaleTo, toJpegBlob } from "@/lib/image/canvas";

export type PreparedImage = { mediaType: "image/jpeg"; base64: string; bytes: number; width: number; height: number };

/** Shrink and compress a page just before it is sent for reading. */
export async function prepareForUpload(canvas: HTMLCanvasElement): Promise<PreparedImage> {
  const out = scaleTo(canvas, CAPTURE.outputMaxSide);
  const blob = await toJpegBlob(out, CAPTURE.outputJpegQuality);
  return { mediaType: "image/jpeg", base64: await blobToBase64(blob), bytes: blob.size, width: out.width, height: out.height };
}
