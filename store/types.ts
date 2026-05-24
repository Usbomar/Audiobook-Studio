export type BlockStatus = "empty" | "recorded" | "edited" | "exported";

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
}

export interface StudioState {
  projects: Project[];
  blocks: Block[];
  activeProjectId: string | null;
  activeBlockId: string | null;
}

export type BlockUpdate = Partial<
  Omit<Block, "id" | "projectId">
>;
