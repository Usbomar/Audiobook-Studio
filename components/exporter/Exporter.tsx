"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { registerShortcutHandlers } from "@/lib/shortcuts";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  defaultFilename,
  exportMergedBlobs,
  exportSingleBlob,
  type ExportFormat,
  type ExportProgress,
} from "@/lib/audio/ffmpeg-export";
import { loadBlockAudio } from "@/lib/storage";
import { saveBlobWithPicker } from "@/lib/storage/file-save";
import { getBlocksForProject, useStudioStore } from "@/store";
import type { Block } from "@/store/types";

type ExportMode = "single" | "merge" | "zip";

function isExportable(block: Block): boolean {
  return block.status !== "empty" && block.durationSeconds > 0;
}

async function resolveBlob(block: Block): Promise<Blob | null> {
  return block.audioBlob ?? (await loadBlockAudio(block.id));
}

export function Exporter({
  projectId,
  defaultBlockId,
}: {
  projectId: string;
  defaultBlockId?: string;
}) {
  const project = useStudioStore((s) =>
    s.projects.find((p) => p.id === projectId)
  );
  const blocks = useStudioStore((s) => s.blocks);
  const updateBlock = useStudioStore((s) => s.updateBlock);

  const exportableBlocks = useMemo(
    () => getBlocksForProject(blocks, projectId).filter(isExportable),
    [blocks, projectId]
  );

  const [mode, setMode] = useState<ExportMode>("single");
  const [format, setFormat] = useState<ExportFormat>("mp3-128");
  const [selectedBlockId, setSelectedBlockId] = useState<string>(
    defaultBlockId ?? ""
  );
  const [mergeIds, setMergeIds] = useState<Set<string>>(
    () => new Set(exportableBlocks.map((b) => b.id))
  );
  const [gapSeconds, setGapSeconds] = useState<0 | 0.5 | 1>(0.5);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeBlockId = selectedBlockId || exportableBlocks[0]?.id || "";

  const handleProgress = (value: ExportProgress) => setProgress(value);

  const markExported = useCallback(
    (blockIds: string[]) => {
      for (const id of blockIds) {
        updateBlock(id, { status: "exported" });
      }
    },
    [updateBlock]
  );

  const runExport = useCallback(async () => {
    if (!project) return;
    setError(null);
    setIsExporting(true);
    setProgress({ ratio: 0, message: "Iniciant exportació…" });

    try {
      if (mode === "single") {
        const block = exportableBlocks.find((b) => b.id === activeBlockId);
        if (!block) throw new Error("Selecciona un bloc per exportar.");
        const blob = await resolveBlob(block);
        if (!blob) throw new Error("No s'ha trobat l'àudio del bloc.");

        const output = await exportSingleBlob(
          blob,
          format,
          {
            album: project.title,
            title: block.title,
            track: block.order + 1,
          },
          handleProgress
        );

        await saveBlobWithPicker(
          output,
          defaultFilename(block.title, format),
          output.type
        );
        markExported([block.id]);
        return;
      }

      if (mode === "merge") {
        const selected = exportableBlocks.filter((b) => mergeIds.has(b.id));
        const blobs: Blob[] = [];
        for (const block of selected) {
          const blob = await resolveBlob(block);
          if (blob) blobs.push(blob);
        }
        if (blobs.length === 0) throw new Error("Cap bloc amb àudio seleccionat.");

        const output = await exportMergedBlobs(
          blobs,
          format,
          {
            album: project.title,
            title: `${project.title} (muntatge)`,
            track: 1,
          },
          gapSeconds,
          handleProgress
        );

        await saveBlobWithPicker(
          output,
          defaultFilename(project.title, format, "-complet"),
          output.type
        );
        markExported(selected.map((b) => b.id));
        return;
      }

      const zip = new JSZip();
      let index = 0;
      const exportedIds: string[] = [];

      for (const block of exportableBlocks) {
        const blob = await resolveBlob(block);
        if (!blob) continue;
        index += 1;
        setProgress({
          ratio: index / exportableBlocks.length,
          message: `Exportant ${block.title}…`,
        });

        const encoded = await exportSingleBlob(blob, format, {
          album: project.title,
          title: block.title,
          track: block.order + 1,
        });

        zip.file(
          defaultFilename(`${String(block.order + 1).padStart(2, "0")}-${block.title}`, format),
          encoded
        );
        exportedIds.push(block.id);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" }, (meta) => {
        setProgress({
          ratio: meta.percent / 100,
          message: "Comprimint ZIP…",
        });
      });

      await saveBlobWithPicker(
        zipBlob,
        defaultFilename(project.title, format, "-blocs").replace(
          /\.[^.]+$/,
          ".zip"
        ),
        "application/zip"
      );
      markExported(exportedIds);
      setProgress({ ratio: 1, message: "ZIP exportat" });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(
          err instanceof Error ? err.message : "Error desconegut en exportar."
        );
      }
    } finally {
      setIsExporting(false);
    }
  }, [
    activeBlockId,
    exportableBlocks,
    format,
    gapSeconds,
    markExported,
    mergeIds,
    mode,
    project,
  ]);

  const runExportRef = useRef(runExport);
  runExportRef.current = runExport;

  useEffect(() => {
    if (defaultBlockId) setSelectedBlockId(defaultBlockId);
  }, [defaultBlockId]);

  useEffect(() => {
    return registerShortcutHandlers({
      onExport: () => {
        if (!isExporting) void runExportRef.current();
      },
    });
  }, [isExporting]);

  if (!project) return null;

  return (
    <section className="mt-8 space-y-4 rounded-xl border border-border/70 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Exportació</h2>
        <Badge variant="secondary">ffmpeg.wasm · -16 LUFS</Badge>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["single", "Bloc individual"],
            ["merge", "Fusionar seleccionats"],
            ["zip", "ZIP (1 fitxer/bloc)"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={mode === value ? "default" : "outline"}
            onClick={() => setMode(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["mp3-128", "MP3 128k"],
            ["mp3-320", "MP3 320k"],
            ["aac", "AAC"],
            ["flac", "FLAC"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={format === value ? "default" : "outline"}
            onClick={() => setFormat(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {mode === "single" && (
        <select
          className="h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
          value={activeBlockId}
          onChange={(e) => setSelectedBlockId(e.target.value)}
        >
          {exportableBlocks.map((block) => (
            <option key={block.id} value={block.id}>
              {block.title}
            </option>
          ))}
        </select>
      )}

      {mode === "merge" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            {([0, 0.5, 1] as const).map((gap) => (
              <Button
                key={gap}
                type="button"
                size="sm"
                variant={gapSeconds === gap ? "default" : "outline"}
                onClick={() => setGapSeconds(gap)}
              >
                Silenci {gap}s
              </Button>
            ))}
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2">
            {exportableBlocks.map((block) => (
              <label
                key={block.id}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={mergeIds.has(block.id)}
                  onChange={(e) => {
                    setMergeIds((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(block.id);
                      else next.delete(block.id);
                      return next;
                    });
                  }}
                />
                {block.title}
              </label>
            ))}
          </div>
        </div>
      )}

      {progress && (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-sky-600 transition-all"
              style={{ width: `${Math.round(progress.ratio * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{progress.message}</p>
        </div>
      )}

      <Button
        type="button"
        disabled={isExporting || exportableBlocks.length === 0}
        onClick={() => void runExport()}
        className="w-full sm:w-auto"
      >
        {isExporting ? "Exportant…" : "Exportar"}
      </Button>
    </section>
  );
}
