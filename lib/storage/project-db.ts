import type { Block, Project } from "@/store/types";
import { getStorageDb, type ProjectSnapshot } from "./db";

export type { ProjectSnapshot } from "./db";

const STATE_STORE = "project-state";
const SNAPSHOT_KEY = "latest";

export async function saveProjectSnapshot(
  projects: Project[],
  blocks: Block[]
): Promise<void> {
  const db = await getStorageDb();
  const snapshot: ProjectSnapshot = {
    version: 1,
    savedAt: new Date().toISOString(),
    projects,
    blocks: blocks.map((block) => ({ ...block, audioBlob: null })),
  };
  await db.put(STATE_STORE, snapshot, SNAPSHOT_KEY);
}

export async function loadProjectSnapshot(): Promise<ProjectSnapshot | null> {
  const db = await getStorageDb();
  return (await db.get(STATE_STORE, SNAPSHOT_KEY)) ?? null;
}
