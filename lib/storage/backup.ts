import JSZip from "jszip";
import type { Block, Project } from "@/store/types";
import { loadBlockAudio } from "./audio-db";
import { saveZipWithPicker } from "./file-save";

export async function exportProjectBackup(
  projects: Project[],
  blocks: Block[]
): Promise<void> {
  const zip = new JSZip();
  const manifest = {
    version: 1,
    exportedAt: new Date().toISOString(),
    projects,
    blocks: blocks.map((block) => ({
      id: block.id,
      projectId: block.projectId,
      title: block.title,
      order: block.order,
      status: block.status,
      durationSeconds: block.durationSeconds,
      scriptText: block.scriptText ?? "",
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
    for (const block of blocks) {
      if (block.status === "empty") continue;
      const blob = block.audioBlob ?? (await loadBlockAudio(block.id));
      if (!blob) continue;
      const ext = blob.type.includes("wav")
        ? "wav"
        : blob.type.includes("mpeg")
          ? "mp3"
          : blob.type.includes("webm")
            ? "webm"
            : "audio";
      audioFolder.file(`${block.id}.${ext}`, blob);
    }
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const date = new Date().toISOString().slice(0, 10);
  await saveZipWithPicker(zipBlob, `audiobook-studio-backup-${date}.zip`);
}
