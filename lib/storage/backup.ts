import JSZip from "jszip";
import type { Block, ChapterClip, Project } from "@/store/types";
import { loadClipAudio } from "./clips-db";
import { loadBlockAudio } from "./audio-db";
import { saveZipWithPicker } from "./file-save";

export async function exportProjectBackup(
  projects: Project[],
  blocks: Block[],
  clips: ChapterClip[]
): Promise<void> {
  const zip = new JSZip();
  const manifest = {
    version: 2,
    exportedAt: new Date().toISOString(),
    projects,
    blocks: blocks.map((block) => ({
      id: block.id,
      projectId: block.projectId,
      title: block.title,
      order: block.order,
      status: block.status,
      durationSeconds: block.durationSeconds,
      activeClipId: block.activeClipId,
      scriptText: block.scriptText ?? "",
    })),
    clips: clips.map((clip) => ({
      id: clip.id,
      blockId: clip.blockId,
      title: clip.title,
      order: clip.order,
      durationSeconds: clip.durationSeconds,
      createdAt: clip.createdAt,
      editorSettings: clip.editorSettings,
    })),
  };

  zip.file("project.json", JSON.stringify(manifest, null, 2));

  const scriptsFolder = zip.folder("scripts");
  if (scriptsFolder) {
    for (const block of blocks) {
      const text = block.scriptText?.trim();
      if (!text) continue;
      scriptsFolder.file(`${block.id}.txt`, text);
    }
  }

  const audioFolder = zip.folder("audio");
  if (audioFolder) {
    for (const clip of clips) {
      const blob = clip.audioBlob ?? (await loadClipAudio(clip.id));
      if (!blob) continue;
      const ext = blob.type.includes("wav")
        ? "wav"
        : blob.type.includes("mpeg")
          ? "mp3"
          : blob.type.includes("webm")
            ? "webm"
            : "audio";
      audioFolder.file(`${clip.id}.${ext}`, blob);
    }

    for (const block of blocks) {
      const hasClips = clips.some((c) => c.blockId === block.id);
      if (hasClips || block.status === "empty") continue;
      const blob = block.audioBlob ?? (await loadBlockAudio(block.id));
      if (!blob) continue;
      const ext = blob.type.includes("wav") ? "wav" : "webm";
      audioFolder.file(`legacy-${block.id}.${ext}`, blob);
    }
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const date = new Date().toISOString().slice(0, 10);
  await saveZipWithPicker(zipBlob, `audiobook-studio-backup-${date}.zip`);
}
