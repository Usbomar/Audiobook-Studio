import { getAudioDurationFromBlob, toStoredDurationSeconds } from "@/lib/audio";
import { createClipForImport, persistClipRecording } from "./index";

export function isAcceptedAudioFile(file: File): boolean {
  if (file.type.startsWith("audio/")) return true;
  return /\.(wav|mp3|mpeg|webm|ogg|m4a|aac|flac)$/i.test(file.name);
}

export async function importAudioIntoChapter(
  blockId: string,
  file: File
): Promise<void> {
  if (!isAcceptedAudioFile(file)) {
    throw new Error(
      "Format no compatible. Utilitza WAV, MP3, WebM, OGG, M4A o AAC."
    );
  }

  const data = await file.arrayBuffer();
  const mime =
    file.type ||
    (file.name.endsWith(".mp3") ? "audio/mpeg" : "audio/wav");
  const blob = new Blob([data], { type: mime });
  const duration = await getAudioDurationFromBlob(blob);
  const durationSeconds = toStoredDurationSeconds(duration);

  const clipId = createClipForImport(blockId, file.name.replace(/\.[^.]+$/, ""));
  await persistClipRecording(clipId, blockId, blob, durationSeconds);
}
