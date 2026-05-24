import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Block, ChapterClip, Project } from "@/store/types";
import type { ClipAudioRecord } from "./clips-db";

const DB_NAME = "audiobook-studio";
const DB_VERSION = 3;

interface BlockAudioRecord {
  blockId: string;
  blob: Blob;
  mimeType: string;
  updatedAt: string;
}

export interface ProjectSnapshot {
  version: 2;
  savedAt: string;
  projects: Project[];
  blocks: Array<Omit<Block, "audioBlob"> & { audioBlob: null }>;
  clips: Array<Omit<ChapterClip, "audioBlob"> & { audioBlob: null }>;
}

export interface AudiobookStudioDB extends DBSchema {
  "block-audio": {
    key: string;
    value: BlockAudioRecord;
  };
  "chapter-clips": {
    key: string;
    value: ClipAudioRecord;
  };
  "project-state": {
    key: string;
    value: ProjectSnapshot;
  };
}

let dbPromise: Promise<IDBPDatabase<AudiobookStudioDB>> | null = null;

export function getStorageDb(): Promise<IDBPDatabase<AudiobookStudioDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AudiobookStudioDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains("block-audio")) {
          db.createObjectStore("block-audio", { keyPath: "blockId" });
        }
        if (oldVersion < 2 && !db.objectStoreNames.contains("project-state")) {
          db.createObjectStore("project-state");
        }
        if (oldVersion < 3 && !db.objectStoreNames.contains("chapter-clips")) {
          db.createObjectStore("chapter-clips", { keyPath: "clipId" });
        }
      },
    });
  }
  return dbPromise;
}
