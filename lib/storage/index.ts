export {
  deleteBlockAudio,
  loadBlockAudio,
  saveBlockAudio,
} from "./audio-db";
export {
  deleteClipAudio,
  deleteAllClipsForBlock,
  loadClipAudio,
  saveClipAudio,
} from "./clips-db";
export { saveBlobWithPicker, saveZipWithPicker } from "./file-save";
export { loadProjectSnapshot, saveProjectSnapshot } from "./project-db";
export { exportProjectBackup } from "./backup";
export { removeBlockFromStudio } from "./remove-block";
export {
  importAudioIntoChapter,
  isAcceptedAudioFile,
} from "./import-chapter-audio";
export { resolveClipBlob, resolveBlockExportBlob } from "./resolve-export-audio";

import { saveClipAudio } from "./clips-db";
import { useStudioStore } from "@/store";

export async function persistClipRecording(
  clipId: string,
  blockId: string,
  blob: Blob,
  durationSeconds: number
): Promise<void> {
  await saveClipAudio(clipId, blockId, blob);
  useStudioStore.getState().updateClip(clipId, {
    audioBlob: blob,
    durationSeconds,
  });
  useStudioStore.getState().updateBlock(blockId, { status: "recorded" });
}

export async function persistEditedClipAudio(
  clipId: string,
  blockId: string,
  blob: Blob,
  durationSeconds: number
): Promise<void> {
  await saveClipAudio(clipId, blockId, blob);
  useStudioStore.getState().updateClip(clipId, {
    audioBlob: blob,
    durationSeconds,
  });
  useStudioStore.getState().updateBlock(blockId, { status: "edited" });
}

export function ensureActiveClip(blockId: string): string {
  const state = useStudioStore.getState();
  const block = state.blocks.find((b) => b.id === blockId);
  if (!block) throw new Error("Capítol no trobat.");

  if (block.activeClipId) {
    const existing = state.clips.find((c) => c.id === block.activeClipId);
    if (existing) return existing.id;
  }

  const blockClips = state.clips
    .filter((c) => c.blockId === blockId)
    .sort((a, b) => a.order - b.order);

  if (blockClips.length > 0) {
    useStudioStore.getState().setActiveClip(blockClips[0].id);
    return blockClips[0].id;
  }

  return useStudioStore.getState().addClip(blockId);
}

export function createClipForImport(blockId: string, title?: string): string {
  return useStudioStore.getState().addClip(blockId, title ?? "Importat");
}
