import { fetchFile } from "@ffmpeg/util";
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { getFFmpeg } from "./ffmpeg-client";

export type ExportFormat = "mp3-128" | "mp3-320" | "aac" | "flac";

export interface ExportMetadata {
  album: string;
  title: string;
  track: number;
}

export interface ExportProgress {
  ratio: number;
  message: string;
}

function extensionForFormat(format: ExportFormat): string {
  if (format === "flac") return "flac";
  if (format === "aac") return "m4a";
  return "mp3";
}

function mimeForFormat(format: ExportFormat): string {
  if (format === "flac") return "audio/flac";
  if (format === "aac") return "audio/mp4";
  return "audio/mpeg";
}

function encodeArgs(
  format: ExportFormat,
  outputName: string,
  metadata: ExportMetadata
): string[] {
  const args = [
    "-af",
    "loudnorm=I=-16:TP=-1.5:LRA=11",
    "-metadata",
    `album=${metadata.album}`,
    "-metadata",
    `title=${metadata.title}`,
    "-metadata",
    `track=${metadata.track}`,
  ];

  if (format === "mp3-128") {
    args.push("-c:a", "libmp3lame", "-b:a", "128k", outputName);
  } else if (format === "mp3-320") {
    args.push("-c:a", "libmp3lame", "-b:a", "320k", outputName);
  } else if (format === "aac") {
    args.push("-c:a", "aac", "-b:a", "192k", outputName);
  } else {
    args.push("-c:a", "flac", outputName);
  }

  return args;
}

async function runWithProgress(
  ffmpeg: FFmpeg,
  args: string[],
  onProgress?: (progress: ExportProgress) => void
): Promise<void> {
  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress?.({
      ratio: Math.min(1, Math.max(0, progress)),
      message: "Codificant àudio…",
    });
  };

  ffmpeg.on("progress", progressHandler);
  try {
    await ffmpeg.exec(args);
  } finally {
    ffmpeg.off("progress", progressHandler);
  }
}

export async function exportSingleBlob(
  inputBlob: Blob,
  format: ExportFormat,
  metadata: ExportMetadata,
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  const ffmpeg = await getFFmpeg();
  const inputName = "input.wav";
  const outputName = `output.${extensionForFormat(format)}`;

  onProgress?.({ ratio: 0.05, message: "Preparant fitxer…" });
  await ffmpeg.writeFile(inputName, await fetchFile(inputBlob));

  const args = ["-i", inputName, ...encodeArgs(format, outputName, metadata)];
  onProgress?.({ ratio: 0.1, message: "Normalitzant i codificant…" });
  await runWithProgress(ffmpeg, args, onProgress);

  const data = await ffmpeg.readFile(outputName);
  const bytes =
    data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));

  onProgress?.({ ratio: 1, message: "Exportació completada" });
  const copy = Uint8Array.from(bytes);
  return new Blob([copy], { type: mimeForFormat(format) });
}

async function writeSilenceFile(
  ffmpeg: FFmpeg,
  fileName: string,
  durationSeconds: number
): Promise<void> {
  await ffmpeg.exec([
    "-f",
    "lavfi",
    "-i",
    `anullsrc=r=48000:cl=mono:d=${durationSeconds}`,
    "-c:a",
    "pcm_s16le",
    fileName,
  ]);
}

export async function exportMergedBlobs(
  blobs: Blob[],
  format: ExportFormat,
  metadata: ExportMetadata,
  gapSeconds = 0,
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  if (blobs.length === 0) throw new Error("Cap capítol seleccionat per fusionar.");
  if (blobs.length === 1) {
    return exportSingleBlob(blobs[0], format, metadata, onProgress);
  }

  const ffmpeg = await getFFmpeg();
  onProgress?.({ ratio: 0.05, message: "Preparant capítols…" });

  const concatFiles: string[] = [];
  for (let i = 0; i < blobs.length; i++) {
    const partName = `part${i}.wav`;
    await ffmpeg.writeFile(partName, await fetchFile(blobs[i]));
    concatFiles.push(partName);

    if (gapSeconds > 0 && i < blobs.length - 1) {
      const gapName = `gap${i}.wav`;
      await writeSilenceFile(ffmpeg, gapName, gapSeconds);
      concatFiles.push(gapName);
    }
  }

  const concatList = concatFiles.map((name) => `file '${name}'`).join("\n");
  await ffmpeg.writeFile("concat.txt", concatList);

  const outputName = `merged.${extensionForFormat(format)}`;
  const args = [
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    "concat.txt",
    ...encodeArgs(format, outputName, metadata),
  ];

  onProgress?.({ ratio: 0.2, message: "Fusionant i codificant…" });
  await runWithProgress(ffmpeg, args, onProgress);

  const data = await ffmpeg.readFile(outputName);
  const bytes =
    data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
  onProgress?.({ ratio: 1, message: "Fusió completada" });
  const copy = Uint8Array.from(bytes);
  return new Blob([copy], { type: mimeForFormat(format) });
}

export function defaultFilename(
  base: string,
  format: ExportFormat,
  suffix = ""
): string {
  const safe = base.replace(/[^\w\-àèéíòóúç .]/gi, "").trim() || "audiollibre";
  return `${safe}${suffix}.${extensionForFormat(format)}`;
}
