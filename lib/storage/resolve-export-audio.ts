import { applyEditorSettingsToBlob } from "@/lib/audio/render-editor-audio";
import type { Block, ChapterClip } from "@/store/types";
import { getClipsForBlock } from "@/store";
import { loadClipAudio } from "./clips-db";
import { loadBlockAudio } from "./audio-db";

export async function resolveClipBlob(clip: ChapterClip): Promise<Blob | null> {
  if (clip.audioBlob) return clip.audioBlob;
  return loadClipAudio(clip.id);
}

export async function prepareClipForExport(clip: ChapterClip): Promise<Blob | null> {
  const raw = await resolveClipBlob(clip);
  if (!raw) return null;
  return applyEditorSettingsToBlob(raw, clip.editorSettings);
}

/** Blob del capítol per exportar: pista activa amb edició aplicada. */
export async function resolveBlockExportBlob(
  block: Block,
  clips: ChapterClip[]
): Promise<Blob | null> {
  const blockClips = getClipsForBlock(clips, block.id);

  if (blockClips.length > 0) {
    const active =
      blockClips.find((c) => c.id === block.activeClipId) ?? blockClips[0];
    return prepareClipForExport(active);
  }

  const legacy = block.audioBlob ?? (await loadBlockAudio(block.id));
  if (!legacy) return null;
  return legacy;
}
