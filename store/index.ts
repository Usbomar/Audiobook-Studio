import { create } from "zustand";
import type { Block, Project, StudioState, BlockUpdate } from "./types";

export type { Block, BlockStatus, BlockUpdate, Project, StudioState } from "./types";

function createId(): string {
  return crypto.randomUUID();
}

interface StudioActions {
  addProject: (
    title: string,
    folderHandle?: FileSystemDirectoryHandle | null
  ) => string;
  deleteProject: (projectId: string) => void;
  addBlock: (projectId: string, title: string) => string;
  deleteBlock: (blockId: string) => void;
  updateBlock: (blockId: string, updates: BlockUpdate) => void;
  reorderBlocks: (projectId: string, orderedBlockIds: string[]) => void;
  reorderProjects: (orderedProjectIds: string[]) => void;
  setActiveProject: (projectId: string | null) => void;
  setActiveBlock: (blockId: string | null) => void;
}

export type StudioStore = StudioState & StudioActions;

export const useStudioStore = create<StudioStore>((set, get) => ({
  projects: [],
  blocks: [],
  activeProjectId: null,
  activeBlockId: null,

  addProject: (title, folderHandle = null) => {
    const id = createId();
    const project: Project = {
      id,
      title,
      createdAt: new Date().toISOString(),
      folderHandle,
    };
    set((state) => ({
      projects: [...state.projects, project],
      activeProjectId: id,
    }));
    return id;
  },

  deleteProject: (projectId) => {
    set((state) => {
      const activeBlock = state.blocks.find((b) => b.id === state.activeBlockId);
      const clearActiveBlock = activeBlock?.projectId === projectId;

      return {
        projects: state.projects.filter((p) => p.id !== projectId),
        blocks: state.blocks.filter((b) => b.projectId !== projectId),
        activeProjectId:
          state.activeProjectId === projectId ? null : state.activeProjectId,
        activeBlockId: clearActiveBlock ? null : state.activeBlockId,
      };
    });
  },

  addBlock: (projectId, title) => {
    const projectBlocks = get().blocks.filter((b) => b.projectId === projectId);
    const maxOrder = projectBlocks.reduce(
      (max, block) => Math.max(max, block.order),
      -1
    );
    const id = createId();
    const block: Block = {
      id,
      projectId,
      title,
      order: maxOrder + 1,
      status: "empty",
      durationSeconds: 0,
      audioBlob: null,
      scriptText: "",
    };
    set((state) => ({
      blocks: [...state.blocks, block],
      activeProjectId: projectId,
      activeBlockId: id,
    }));
    return id;
  },

  deleteBlock: (blockId) => {
    set((state) => {
      const target = state.blocks.find((b) => b.id === blockId);
      if (!target) return state;

      const remaining = state.blocks.filter((b) => b.id !== blockId);
      const reordered = getBlocksForProject(remaining, target.projectId).map(
        (block, index) => ({ ...block, order: index })
      );
      const other = remaining.filter((b) => b.projectId !== target.projectId);
      const blocks = [...other, ...reordered];

      return {
        blocks,
        activeBlockId:
          state.activeBlockId === blockId ? null : state.activeBlockId,
      };
    });
  },

  updateBlock: (blockId, updates) => {
    set((state) => ({
      blocks: state.blocks.map((block) =>
        block.id === blockId ? { ...block, ...updates } : block
      ),
    }));
  },

  reorderBlocks: (projectId, orderedBlockIds) => {
    const orderMap = new Map(
      orderedBlockIds.map((id, index) => [id, index] as const)
    );
    set((state) => ({
      blocks: state.blocks.map((block) =>
        block.projectId === projectId && orderMap.has(block.id)
          ? { ...block, order: orderMap.get(block.id)! }
          : block
      ),
    }));
  },

  reorderProjects: (orderedProjectIds) => {
    const orderMap = new Map(
      orderedProjectIds.map((id, index) => [id, index] as const)
    );
    set((state) => ({
      projects: [...state.projects].sort(
        (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0)
      ),
    }));
  },

  setActiveProject: (projectId) => set({ activeProjectId: projectId }),

  setActiveBlock: (blockId) => {
    if (!blockId) {
      set({ activeBlockId: null });
      return;
    }
    const block = get().blocks.find((b) => b.id === blockId);
    set({
      activeBlockId: blockId,
      activeProjectId: block?.projectId ?? get().activeProjectId,
    });
  },
}));

export function getBlocksForProject(
  blocks: Block[],
  projectId: string
): Block[] {
  return blocks
    .filter((block) => block.projectId === projectId)
    .sort((a, b) => a.order - b.order);
}

export function getProjectSummary(
  blocks: Block[],
  projectId: string
): { total: number; exported: number } {
  const projectBlocks = blocks.filter((b) => b.projectId === projectId);
  return {
    total: projectBlocks.length,
    exported: projectBlocks.filter((b) => b.status === "exported").length,
  };
}

/** @deprecated Usa useStudioStore */
export const useAppStore = useStudioStore;
