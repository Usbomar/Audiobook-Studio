import { getStorageDb } from "./db";

const STORE_NAME = "block-audio";

export async function saveBlockAudio(blockId: string, blob: Blob): Promise<void> {
  const db = await getStorageDb();
  await db.put(STORE_NAME, {
    blockId,
    blob,
    mimeType: blob.type,
    updatedAt: new Date().toISOString(),
  });
}

export async function loadBlockAudio(blockId: string): Promise<Blob | null> {
  const db = await getStorageDb();
  const record = await db.get(STORE_NAME, blockId);
  return record?.blob ?? null;
}

export async function deleteBlockAudio(blockId: string): Promise<void> {
  const db = await getStorageDb();
  await db.delete(STORE_NAME, blockId);
}
