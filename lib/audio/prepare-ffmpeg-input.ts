import { decodeBlobToMonoSamples, encodeWav } from "./wav-utils";

/** Converteix qualsevol blob d'àudio (WebM, MP3, etc.) a WAV per ffmpeg. */
export async function prepareFfmpegInputBlob(blob: Blob): Promise<Blob> {
  if (blob.type.includes("wav")) return blob;
  const { samples, sampleRate } = await decodeBlobToMonoSamples(blob);
  return encodeWav(samples, sampleRate);
}
