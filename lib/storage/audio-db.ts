import { openDB, type DBSchema, type IDBPDatabase } from "idb";

const DB_NAME = "audiobook-studio";
const DB_VERSION = 1;
const STORE_NAME = "block-audio";

interface BlockAudioRecord {
  blockId: string;
  blob: Blob;
  mimeType: string;
  updatedAt: string;
}

interface AudiobookStudioDB extends DBSchema {
  "block-audio": {
    key: string;
    value: BlockAudioRecord;
  };
}

let dbPromise: Promise<IDBPDatabase<AudiobookStudioDB>> | null = null;

function getDb(): Promise<IDBPDatabase<AudiobookStudioDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AudiobookStudioDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "blockId" });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveBlockAudio(blockId: string, blob: Blob): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAME, {
    blockId,
    blob,
    mimeType: blob.type,
    updatedAt: new Date().toISOString(),
  });
}

export async function loadBlockAudio(blockId: string): Promise<Blob | null> {
  const db = await getDb();
  const record = await db.get(STORE_NAME, blockId);
  return record?.blob ?? null;
}

export async function deleteBlockAudio(blockId: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, blockId);
}
