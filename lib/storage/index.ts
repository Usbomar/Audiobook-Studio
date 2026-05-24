export {
  deleteBlockAudio,
  loadBlockAudio,
  saveBlockAudio,
} from "./audio-db";
export { saveBlobWithPicker, saveZipWithPicker } from "./file-save";
export { loadProjectSnapshot, saveProjectSnapshot } from "./project-db";
export { exportProjectBackup } from "./backup";

import { saveBlockAudio } from "./audio-db";
import { useStudioStore } from "@/store";

export async function persistBlockRecording(
  blockId: string,
  blob: Blob,
  durationSeconds: number
): Promise<void> {
  await saveBlockAudio(blockId, blob);
  useStudioStore.getState().updateBlock(blockId, {
    audioBlob: blob,
    durationSeconds,
    status: "recorded",
  });
}

export async function persistEditedBlockAudio(
  blockId: string,
  blob: Blob,
  durationSeconds: number
): Promise<void> {
  await saveBlockAudio(blockId, blob);
  useStudioStore.getState().updateBlock(blockId, {
    audioBlob: blob,
    durationSeconds,
    status: "edited",
  });
}
