import type { Block, ChapterClip, Project } from "@/store/types";
import { getStorageDb, type ProjectSnapshot } from "./db";

export type { ProjectSnapshot } from "./db";

const STATE_STORE = "project-state";
const SNAPSHOT_KEY = "latest";

export async function saveProjectSnapshot(
  projects: Project[],
  blocks: Block[],
  clips: ChapterClip[]
): Promise<void> {
  const db = await getStorageDb();
  const snapshot: ProjectSnapshot = {
    version: 2,
    savedAt: new Date().toISOString(),
    projects,
    blocks: blocks.map((block) => ({ ...block, audioBlob: null })),
    clips: clips.map((clip) => ({ ...clip, audioBlob: null })),
  };
  await db.put(STATE_STORE, snapshot, SNAPSHOT_KEY);
}

export async function loadProjectSnapshot(): Promise<ProjectSnapshot | null> {
  const db = await getStorageDb();
  const raw = await db.get(STATE_STORE, SNAPSHOT_KEY);
  if (!raw) return null;

  if (raw.version === 2 && "clips" in raw) {
    return raw as ProjectSnapshot;
  }

  const legacy = raw as unknown as {
    version: 1;
    savedAt: string;
    projects: Project[];
    blocks: ProjectSnapshot["blocks"];
  };

  return {
    version: 2,
    savedAt: legacy.savedAt,
    projects: legacy.projects,
    blocks: legacy.blocks.map((block) => ({
      ...block,
      activeClipId: block.activeClipId ?? null,
      scriptText: block.scriptText ?? "",
    })),
    clips: [],
  };
}
