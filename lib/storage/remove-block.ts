import { deleteBlockAudio } from "./audio-db";
import { useStudioStore } from "@/store";

export async function removeBlockFromStudio(blockId: string): Promise<void> {
  await deleteBlockAudio(blockId);
  useStudioStore.getState().deleteBlock(blockId);
}
