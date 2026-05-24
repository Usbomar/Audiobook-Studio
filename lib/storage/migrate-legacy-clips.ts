import { DEFAULT_EDITOR_SETTINGS } from "@/lib/audio/editor-settings";
import type { Block, ChapterClip } from "@/store/types";
import { loadBlockAudio } from "./audio-db";
import { saveClipAudio } from "./clips-db";

function createId(): string {
  return crypto.randomUUID();
}

/** Converteix àudio antic per bloc en una pista si encara no n'hi ha. */
export async function migrateLegacyBlockAudioToClips(
  blocks: Block[],
  clips: ChapterClip[]
): Promise<{ clips: ChapterClip[]; activeClipByBlock: Record<string, string> }> {
  const next = [...clips];
  const activeClipByBlock: Record<string, string> = {};

  for (const block of blocks) {
    if (block.status === "empty") continue;
    const existing = next.filter((c) => c.blockId === block.id);
    if (existing.length > 0) {
      const active =
        block.activeClipId &&
        existing.some((c) => c.id === block.activeClipId)
          ? block.activeClipId
          : existing[0].id;
      activeClipByBlock[block.id] = active;
      continue;
    }

    const blob = await loadBlockAudio(block.id);
    if (!blob) continue;

    const clipId = createId();
    await saveClipAudio(clipId, block.id, blob);
    next.push({
      id: clipId,
      blockId: block.id,
      title: "Pista 1",
      order: 0,
      durationSeconds: block.durationSeconds,
      createdAt: new Date().toISOString(),
      editorSettings: { ...DEFAULT_EDITOR_SETTINGS },
      audioBlob: blob,
    });
    activeClipByBlock[block.id] = clipId;
  }

  return { clips: next, activeClipByBlock };
}
