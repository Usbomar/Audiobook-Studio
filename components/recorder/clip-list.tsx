"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteClipAudio } from "@/lib/storage";
import { getClipsForBlock, useStudioStore } from "@/store";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface ClipListProps {
  blockId: string;
  className?: string;
}

export function ClipList({ blockId, className }: ClipListProps) {
  const clips = useStudioStore((s) => s.clips);
  const block = useStudioStore((s) => s.blocks.find((b) => b.id === blockId));
  const addClip = useStudioStore((s) => s.addClip);
  const setActiveClip = useStudioStore((s) => s.setActiveClip);
  const deleteClip = useStudioStore((s) => s.deleteClip);

  if (!block) return null;

  const blockClips = getClipsForBlock(clips, blockId);
  const activeId = block.activeClipId;

  const handleDelete = async (clipId: string) => {
    await deleteClipAudio(clipId);
    deleteClip(clipId);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-wider text-muted-foreground">
          PISTES D&apos;ÀUDIO
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => addClip(blockId)}
        >
          <Plus className="size-3.5" />
          Nova pista
        </Button>
      </div>

      {blockClips.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">
          Encara no hi ha pistes. Grava o importa àudio per crear la primera.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {blockClips.map((clip) => {
            const isActive = clip.id === activeId;
            return (
              <li key={clip.id}>
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors",
                    isActive
                      ? "border-sky-500/50 bg-sky-50/80"
                      : "border-border/60 bg-white hover:bg-muted/30"
                  )}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-sm"
                    onClick={() => setActiveClip(clip.id)}
                  >
                    <span className={cn("font-medium", isActive && "text-sky-900")}>
                      {clip.title}
                    </span>
                    {clip.durationSeconds > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {formatDuration(clip.durationSeconds)}
                      </span>
                    )}
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Esborrar ${clip.title}`}
                    onClick={() => void handleDelete(clip.id)}
                  >
                    <Trash2 className="size-4 stroke-[2.25]" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
