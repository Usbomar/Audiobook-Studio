import { getStorageDb } from "./db";

const STORE_NAME = "chapter-clips";

export interface ClipAudioRecord {
  clipId: string;
  blockId: string;
  blob: Blob;
  mimeType: string;
  updatedAt: string;
}

export async function saveClipAudio(clipId: string, blockId: string, blob: Blob): Promise<void> {
  const db = await getStorageDb();
  await db.put(STORE_NAME, {
    clipId,
    blockId,
    blob,
    mimeType: blob.type,
    updatedAt: new Date().toISOString(),
  });
}

export async function loadClipAudio(clipId: string): Promise<Blob | null> {
  const db = await getStorageDb();
  const record = await db.get(STORE_NAME, clipId);
  return record?.blob ?? null;
}

export async function deleteClipAudio(clipId: string): Promise<void> {
  const db = await getStorageDb();
  await db.delete(STORE_NAME, clipId);
}

export async function deleteAllClipsForBlock(blockId: string): Promise<void> {
  const db = await getStorageDb();
  const all = await db.getAll(STORE_NAME);
  await Promise.all(
    all.filter((r) => r.blockId === blockId).map((r) => db.delete(STORE_NAME, r.clipId))
  );
}
