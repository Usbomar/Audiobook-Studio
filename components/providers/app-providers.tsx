"use client";

import { useEffect } from "react";
import { handleGlobalKeyDown } from "@/lib/shortcuts";
import {
  loadClipAudio,
  loadProjectSnapshot,
  saveClipAudio,
  saveProjectSnapshot,
} from "@/lib/storage";
import { migrateLegacyBlockAudioToClips } from "@/lib/storage/migrate-legacy-clips";
import { useStudioStore } from "@/store";
import type { ChapterClip } from "@/store/types";

const AUTOSAVE_MS = 30_000;

export function AppProviders({ children }: { children: React.ReactNode }) {
  const projects = useStudioStore((s) => s.projects);
  const blocks = useStudioStore((s) => s.blocks);
  const clips = useStudioStore((s) => s.clips);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const snapshot = await loadProjectSnapshot();
      if (cancelled || !snapshot) return;
      if (useStudioStore.getState().projects.length > 0) return;

      let blocks = snapshot.blocks.map((block) => ({
        ...block,
        audioBlob: null,
        activeClipId: block.activeClipId ?? null,
        scriptText: block.scriptText ?? "",
      }));

      let clips: ChapterClip[] = snapshot.clips.map((clip) => ({
        ...clip,
        audioBlob: null,
      }));

      const migrated = await migrateLegacyBlockAudioToClips(blocks, clips);
      clips = migrated.clips;
      blocks = blocks.map((block) => ({
        ...block,
        activeClipId:
          migrated.activeClipByBlock[block.id] ?? block.activeClipId,
      }));

      useStudioStore.setState({
        projects: snapshot.projects,
        blocks,
        clips,
      });

      for (const clip of clips) {
        const blob = await loadClipAudio(clip.id);
        if (blob) {
          useStudioStore.getState().updateClip(clip.id, { audioBlob: blob });
        }
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => handleGlobalKeyDown(event);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const runAutosave = async () => {
      const state = useStudioStore.getState();
      if (state.projects.length === 0 && state.blocks.length === 0) return;

      await saveProjectSnapshot(state.projects, state.blocks, state.clips);
      for (const clip of state.clips) {
        if (clip.audioBlob) {
          await saveClipAudio(clip.id, clip.blockId, clip.audioBlob);
        }
      }
    };

    const timer = window.setInterval(() => {
      void runAutosave();
    }, AUTOSAVE_MS);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (projects.length === 0 && blocks.length === 0 && clips.length === 0) {
      return;
    }
    void saveProjectSnapshot(projects, blocks, clips);
  }, [projects, blocks, clips]);

  return children;
}
