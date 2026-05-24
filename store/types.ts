import type { EditorSettings } from "@/lib/audio/editor-settings";

export type BlockStatus = "empty" | "recorded" | "edited" | "exported";

export interface ChapterClip {
  id: string;
  blockId: string;
  title: string;
  order: number;
  durationSeconds: number;
  createdAt: string;
  editorSettings: EditorSettings;
  /** Només en memòria; el blob viu a IndexedDB */
  audioBlob: Blob | null;
}

export interface Project {
  id: string;
  title: string;
  createdAt: string;
  folderHandle: FileSystemDirectoryHandle | null;
}

export interface Block {
  id: string;
  projectId: string;
  title: string;
  order: number;
  status: BlockStatus;
  durationSeconds: number;
  audioBlob: Blob | null;
  activeClipId: string | null;
  /** Text del capítol per llegir mentre es grava */
  scriptText: string;
}

export interface StudioState {
  projects: Project[];
  blocks: Block[];
  clips: ChapterClip[];
  activeProjectId: string | null;
  activeBlockId: string | null;
}

export type ChapterClipUpdate = Partial<
  Omit<ChapterClip, "id" | "blockId">
>;

export type BlockUpdate = Partial<
  Omit<Block, "id" | "projectId">
>;
