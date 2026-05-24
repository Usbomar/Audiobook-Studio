"use client";

import { useEffect } from "react";
import { handleGlobalKeyDown } from "@/lib/shortcuts";
import { loadBlockAudio, saveBlockAudio, saveProjectSnapshot } from "@/lib/storage";
import { loadProjectSnapshot } from "@/lib/storage/project-db";
import { useStudioStore } from "@/store";

const AUTOSAVE_MS = 30_000;

export function AppProviders({ children }: { children: React.ReactNode }) {
  const projects = useStudioStore((s) => s.projects);
  const blocks = useStudioStore((s) => s.blocks);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const snapshot = await loadProjectSnapshot();
      if (cancelled || !snapshot) return;
      if (useStudioStore.getState().projects.length > 0) return;

      useStudioStore.setState({
        projects: snapshot.projects,
        blocks: snapshot.blocks.map((block) => ({
          ...block,
          audioBlob: null,
          scriptText: block.scriptText ?? "",
        })),
      });

      for (const block of snapshot.blocks) {
        if (block.status === "empty") continue;
        const blob = await loadBlockAudio(block.id);
        if (blob) {
          useStudioStore.getState().updateBlock(block.id, { audioBlob: blob });
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

      await saveProjectSnapshot(state.projects, state.blocks);
      for (const block of state.blocks) {
        if (block.audioBlob) {
          await saveBlockAudio(block.id, block.audioBlob);
        }
      }
    };

    const timer = window.setInterval(() => {
      void runAutosave();
    }, AUTOSAVE_MS);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (projects.length === 0 && blocks.length === 0) return;
    void saveProjectSnapshot(projects, blocks);
  }, [projects, blocks]);

  return children;
}
