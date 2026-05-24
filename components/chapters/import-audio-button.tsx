"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importAudioIntoChapter } from "@/lib/storage/import-chapter-audio";

interface ImportAudioButtonProps {
  blockId: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
  onImported?: () => void;
}

export function ImportAudioButton({
  blockId,
  variant = "outline",
  size = "sm",
  className,
  onImported,
}: ImportAudioButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setIsImporting(true);
    try {
      await importAudioIntoChapter(blockId, file);
      onImported?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error en importar l'àudio.");
    } finally {
      setIsImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.webm,.ogg,.m4a,.aac,.flac"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <Button
        type="button"
        variant={variant}
        size={size}
        className="gap-2"
        disabled={isImporting}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-4" />
        {isImporting ? "Important…" : "Importar àudio"}
      </Button>
      {error && (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
