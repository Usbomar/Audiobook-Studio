import { deleteAllClipsForBlock } from "./clips-db";
import { deleteBlockAudio } from "./audio-db";
import { useStudioStore } from "@/store";

export async function removeBlockFromStudio(blockId: string): Promise<void> {
  await Promise.all([
    deleteBlockAudio(blockId),
    deleteAllClipsForBlock(blockId),
  ]);
  useStudioStore.getState().deleteBlock(blockId);
}
