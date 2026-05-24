import { DEFAULT_EDITOR_SETTINGS } from "@/lib/audio/editor-settings";
import { create } from "zustand";
import type {
  Block,
  ChapterClip,
  ChapterClipUpdate,
  Project,
  StudioState,
  BlockUpdate,
} from "./types";

export type {
  Block,
  BlockStatus,
  BlockUpdate,
  ChapterClip,
  ChapterClipUpdate,
  Project,
  StudioState,
} from "./types";

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
  addClip: (blockId: string, title?: string) => string;
  deleteClip: (clipId: string) => void;
  updateClip: (clipId: string, updates: ChapterClipUpdate) => void;
  setActiveClip: (clipId: string | null) => void;
  reorderBlocks: (projectId: string, orderedBlockIds: string[]) => void;
  reorderProjects: (orderedProjectIds: string[]) => void;
  setActiveProject: (projectId: string | null) => void;
  setActiveBlock: (blockId: string | null) => void;
}

export type StudioStore = StudioState & StudioActions;

function getClipsForBlock(clips: ChapterClip[], blockId: string): ChapterClip[] {
  return clips
    .filter((c) => c.blockId === blockId)
    .sort((a, b) => a.order - b.order);
}

function deriveBlockStatus(
  blockClips: ChapterClip[],
  previous: Block["status"]
): Block["status"] {
  if (blockClips.length === 0 || !blockClips.some((c) => c.durationSeconds > 0)) {
    return "empty";
  }
  if (previous === "exported") return "exported";
  if (previous === "edited") return "edited";
  return "recorded";
}

function withBlockSync(state: StudioState, blockId: string): StudioState {
  const blockClips = getClipsForBlock(state.clips, blockId);
  const blockIndex = state.blocks.findIndex((b) => b.id === blockId);
  if (blockIndex < 0) return state;

  const block = state.blocks[blockIndex];
  let activeClipId = block.activeClipId;
  if (activeClipId && !blockClips.some((c) => c.id === activeClipId)) {
    activeClipId = blockClips[blockClips.length - 1]?.id ?? null;
  }
  if (!activeClipId && blockClips.length > 0) {
    activeClipId = blockClips[0].id;
  }

  const activeClip = blockClips.find((c) => c.id === activeClipId);
  const totalDuration = blockClips.reduce((s, c) => s + c.durationSeconds, 0);
  const nextStatus = deriveBlockStatus(blockClips, block.status);

  const blocks = [...state.blocks];
  blocks[blockIndex] = {
    ...block,
    activeClipId,
    audioBlob: activeClip?.audioBlob ?? null,
    durationSeconds: totalDuration,
    status: nextStatus,
  };

  return { ...state, blocks };
}

export const useStudioStore = create<StudioStore>((set, get) => ({
  projects: [],
  blocks: [],
  clips: [],
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
        clips: state.clips.filter((c) => {
          const block = state.blocks.find((b) => b.id === c.blockId);
          return block?.projectId !== projectId;
        }),
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
      activeClipId: null,
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
        clips: state.clips.filter((c) => c.blockId !== blockId),
        activeBlockId:
          state.activeBlockId === blockId ? null : state.activeBlockId,
      };
    });
  },

  updateBlock: (blockId, updates) => {
    set((state) => {
      const next = {
        ...state,
        blocks: state.blocks.map((block) =>
          block.id === blockId ? { ...block, ...updates } : block
        ),
      };
      return withBlockSync(next, blockId);
    });
  },

  addClip: (blockId, title) => {
    const id = createId();
    const blockClips = getClipsForBlock(get().clips, blockId);
    const clip: ChapterClip = {
      id,
      blockId,
      title: title ?? `Pista ${blockClips.length + 1}`,
      order: blockClips.length,
      durationSeconds: 0,
      createdAt: new Date().toISOString(),
      editorSettings: { ...DEFAULT_EDITOR_SETTINGS },
      audioBlob: null,
    };
    set((state) => {
      const next = {
        ...state,
        clips: [...state.clips, clip],
        blocks: state.blocks.map((b) =>
          b.id === blockId ? { ...b, activeClipId: id } : b
        ),
      };
      return withBlockSync(next, blockId);
    });
    return id;
  },

  deleteClip: (clipId) => {
    const clip = get().clips.find((c) => c.id === clipId);
    if (!clip) return;
    set((state) => {
      const blockClips = getClipsForBlock(state.clips, clip.blockId)
        .filter((c) => c.id !== clipId)
        .map((c, index) => ({ ...c, order: index }));
      const other = state.clips.filter((c) => c.blockId !== clip.blockId);
      const clips = [...other, ...blockClips];
      const next = { ...state, clips };
      return withBlockSync(next, clip.blockId);
    });
  },

  updateClip: (clipId, updates) => {
    const clip = get().clips.find((c) => c.id === clipId);
    if (!clip) return;
    set((state) => {
      const next = {
        ...state,
        clips: state.clips.map((c) =>
          c.id === clipId ? { ...c, ...updates } : c
        ),
      };
      return withBlockSync(next, clip.blockId);
    });
  },

  setActiveClip: (clipId) => {
    if (!clipId) return;
    const clip = get().clips.find((c) => c.id === clipId);
    if (!clip) return;
    set((state) => {
      const next = {
        ...state,
        blocks: state.blocks.map((b) =>
          b.id === clip.blockId ? { ...b, activeClipId: clipId } : b
        ),
      };
      return withBlockSync(next, clip.blockId);
    });
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

export { getClipsForBlock };

export function getActiveClip(
  clips: ChapterClip[],
  block: Block
): ChapterClip | undefined {
  if (!block.activeClipId) return undefined;
  return clips.find((c) => c.id === block.activeClipId);
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
