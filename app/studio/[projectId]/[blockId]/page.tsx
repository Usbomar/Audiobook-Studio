"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Recorder } from "@/components/recorder";
import { AudioEditor } from "@/components/editor";
import { Exporter } from "@/components/exporter";
import { Badge } from "@/components/ui/badge";
import { useStudioStore } from "@/store";
import { getBlocksForProject } from "@/store";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default function StudioPage() {
  const params = useParams<{ projectId: string; blockId: string }>();
  const setActiveProject = useStudioStore((s) => s.setActiveProject);
  const setActiveBlock = useStudioStore((s) => s.setActiveBlock);
  const project = useStudioStore((s) =>
    s.projects.find((p) => p.id === params.projectId)
  );
  const block = useStudioStore((s) =>
    s.blocks.find((b) => b.id === params.blockId)
  );
  const blocks = useStudioStore((s) => s.blocks);

  useEffect(() => {
    if (params.projectId) setActiveProject(params.projectId);
    if (params.blockId) setActiveBlock(params.blockId);
  }, [
    params.projectId,
    params.blockId,
    setActiveProject,
    setActiveBlock,
  ]);

  if (!project || !block || block.projectId !== project.id) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-muted-foreground">Bloc no trobat.</p>
      </div>
    );
  }

  const projectBlocks = getBlocksForProject(blocks, project.id);
  const blockIndex = projectBlocks.findIndex((b) => b.id === block.id) + 1;

  const statusLabel = {
    empty: "Pendent",
    recorded: "Gravat",
    edited: "Editat",
    exported: "Exportat",
  }[block.status];

  return (
    <div className="flex h-full flex-col p-6 md:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link
            href={`/studio/${project.id}/assemble`}
            className="inline-block text-sm text-sky-700 hover:underline"
          >
            Muntatge de blocs →
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {block.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {project.title} · Bloc {blockIndex} de {projectBlocks.length}
            {block.durationSeconds > 0 &&
              ` · ${formatDuration(block.durationSeconds)} gravats`}
          </p>
          <Badge variant="secondary">{statusLabel}</Badge>
        </div>
      </header>

      <Recorder blockId={block.id} className="max-w-3xl" />
      <AudioEditor blockId={block.id} />
      <Exporter projectId={project.id} defaultBlockId={block.id} />
    </div>
  );
}
