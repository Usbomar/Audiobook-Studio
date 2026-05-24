"use client";

import { useStudioStore } from "@/store";

interface ScriptPanelProps {
  blockId: string;
  className?: string;
}

export function ScriptPanel({ blockId, className }: ScriptPanelProps) {
  const block = useStudioStore((s) => s.blocks.find((b) => b.id === blockId));
  const updateBlock = useStudioStore((s) => s.updateBlock);

  if (!block) return null;

  return (
    <div
      className={className}
    >
      <label
        htmlFor={`script-${blockId}`}
        className="mb-2 block text-xs font-semibold tracking-wider text-muted-foreground"
      >
        GUIÓ DEL CAPÍTOL
      </label>
      <textarea
        id={`script-${blockId}`}
        value={block.scriptText ?? ""}
        onChange={(e) => updateBlock(blockId, { scriptText: e.target.value })}
        placeholder="Enganxa aquí el text que llegiràs mentre graves. El guió es desa amb el projecte."
        className="min-h-[220px] w-full resize-y rounded-xl border border-border/60 bg-white px-3 py-3 text-sm leading-relaxed shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-sky-500/40"
        spellCheck
      />
      <p className="mt-2 text-xs text-muted-foreground">
        {(block.scriptText ?? "").length > 0
          ? `${(block.scriptText ?? "").split(/\s+/).filter(Boolean).length} paraules aprox.`
          : "Sense text encara"}
      </p>
    </div>
  );
}
