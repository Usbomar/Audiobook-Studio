"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Loader2, Play, Square } from "lucide-react";
import { AssembleBlockRow, Exporter } from "@/components/exporter";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  AssemblyPreviewPlayer,
  calculateAssemblyDurationSeconds,
  type AssemblyGapSeconds,
} from "@/lib/audio/assembly-preview";
import { loadBlockAudio } from "@/lib/storage";
import { getBlocksForProject, useStudioStore } from "@/store";
import type { Block } from "@/store/types";

function formatTotalDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function isRecordedBlock(block: Block): boolean {
  return block.status !== "empty" && block.durationSeconds > 0;
}

function getSliderValue(value: number | readonly number[]): number {
  return typeof value === "number" ? value : value[0] ?? 0;
}

export default function AssemblePage() {
  const params = useParams<{ projectId: string }>();
  const project = useStudioStore((s) =>
    s.projects.find((p) => p.id === params.projectId)
  );
  const blocks = useStudioStore((s) => s.blocks);
  const updateBlock = useStudioStore((s) => s.updateBlock);
  const reorderBlocks = useStudioStore((s) => s.reorderBlocks);
  const setActiveProject = useStudioStore((s) => s.setActiveProject);

  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [includedIds, setIncludedIds] = useState<Set<string>>(new Set());
  const [gapSeconds, setGapSeconds] = useState<AssemblyGapSeconds>(0.5);
  const [introSeconds, setIntroSeconds] = useState(0);
  const [outroSeconds, setOutroSeconds] = useState(0);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);

  const previewRef = useRef<AssemblyPreviewPlayer | null>(null);

  const recordedBlocks = useMemo(() => {
    if (!project) return [];
    return getBlocksForProject(blocks, project.id).filter(isRecordedBlock);
  }, [blocks, project]);

  useEffect(() => {
    if (project) setActiveProject(project.id);
  }, [project, setActiveProject]);

  useEffect(() => {
    setOrderedIds(recordedBlocks.map((b) => b.id));
    setIncludedIds(new Set(recordedBlocks.map((b) => b.id)));
  }, [recordedBlocks]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateBlobs() {
      setIsHydrating(true);
      for (const block of recordedBlocks) {
        if (cancelled || block.audioBlob) continue;
        const stored = await loadBlockAudio(block.id);
        if (stored) {
          updateBlock(block.id, { audioBlob: stored });
        }
      }
      if (!cancelled) setIsHydrating(false);
    }

    void hydrateBlobs();
    return () => {
      cancelled = true;
    };
  }, [recordedBlocks, updateBlock]);

  useEffect(() => {
    return () => previewRef.current?.stop();
  }, []);

  const orderedBlocks = orderedIds
    .map((id) => recordedBlocks.find((b) => b.id === id))
    .filter((b): b is Block => Boolean(b));

  const selectedBlocks = orderedBlocks.filter((b) => includedIds.has(b.id));

  const totalDuration = calculateAssemblyDurationSeconds(
    selectedBlocks.map((b) => b.durationSeconds),
    gapSeconds,
    introSeconds,
    outroSeconds
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrderedIds((ids) => {
      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return ids;
      const next = arrayMove(ids, oldIndex, newIndex);
      if (project) reorderBlocks(project.id, next);
      return next;
    });
  };

  const toggleIncluded = useCallback((blockId: string, included: boolean) => {
    setIncludedIds((prev) => {
      const next = new Set(prev);
      if (included) next.add(blockId);
      else next.delete(blockId);
      return next;
    });
  }, []);

  const handlePreview = async () => {
    if (isPreviewing) {
      previewRef.current?.stop();
      setIsPreviewing(false);
      return;
    }

    const blobs: Blob[] = [];
    for (const block of selectedBlocks) {
      let blob = block.audioBlob;
      if (!blob) blob = await loadBlockAudio(block.id);
      if (blob) blobs.push(blob);
    }

    if (blobs.length === 0) return;

    if (!previewRef.current) previewRef.current = new AssemblyPreviewPlayer();

    setIsPreviewing(true);
    await previewRef.current.play({
      blobs,
      gapSeconds,
      introSeconds,
      outroSeconds,
      onEnded: () => setIsPreviewing(false),
    });
  };

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-muted-foreground">Projecte no trobat.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-6 md:p-8">
      <header className="mb-6 space-y-2">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Tornar a l&apos;inici
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Muntatge de capítols
        </h1>
        <p className="text-sm text-muted-foreground">
          {project.title} · {selectedBlocks.length} capítols seleccionats · Durada
          total: {formatTotalDuration(totalDuration)}
        </p>
      </header>

      <div className="mb-6 grid gap-4 rounded-xl border border-border/60 bg-white p-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium">Silenci entre capítols</p>
          <div className="flex gap-2">
            {([0, 0.5, 1] as AssemblyGapSeconds[]).map((gap) => (
              <Button
                key={gap}
                type="button"
                size="sm"
                variant={gapSeconds === gap ? "default" : "outline"}
                onClick={() => setGapSeconds(gap)}
              >
                {gap}s
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="mb-1 text-sm font-medium">
              Intro (silenci inicial): {introSeconds}s
            </p>
            <Slider
              min={0}
              max={5}
              step={0.5}
              value={[introSeconds]}
              onValueChange={(v) => setIntroSeconds(getSliderValue(v))}
            />
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">
              Outro (silenci final): {outroSeconds}s
            </p>
            <Slider
              min={0}
              max={5}
              step={0.5}
              value={[outroSeconds]}
              onValueChange={(v) => setOutroSeconds(getSliderValue(v))}
            />
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <Button
          type="button"
          onClick={() => void handlePreview()}
          disabled={selectedBlocks.length === 0 || isHydrating}
          className="gap-2"
        >
          {isPreviewing ? (
            <>
              <Square className="size-4 fill-current" />
              Aturar previsualització
            </>
          ) : (
            <>
              <Play className="size-4 fill-current" />
              Previsualitzar
            </>
          )}
        </Button>
        {isHydrating && (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Carregant àudio…
          </span>
        )}
      </div>

      {orderedBlocks.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Encara no hi ha capítols gravats per muntar. Grava almenys un capítol abans.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={orderedIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {orderedBlocks.map((block) => (
                <AssembleBlockRow
                  key={block.id}
                  block={block}
                  included={includedIds.has(block.id)}
                  onToggle={(included) => toggleIncluded(block.id, included)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Exporter projectId={project.id} />
    </div>
  );
}
