"use client";

import { useEffect, useRef, useState } from "react";
import {
  Circle,
  Loader2,
  Mic,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Square,
} from "lucide-react";
import { registerShortcutHandlers } from "@/lib/shortcuts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useRecorder } from "./use-recorder";
import { VuMeter } from "./vu-meter";
import { ImportAudioButton } from "@/components/chapters/import-audio-button";
import { ScriptPanel } from "./script-panel";
import { ClipList } from "./clip-list";
import { WaveformView } from "./waveform-view";

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centis = Math.floor((ms % 1000) / 10);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${centis.toString().padStart(2, "0")}`;
}

interface RecorderProps {
  blockId: string;
  className?: string;
}

export function Recorder({ blockId, className }: RecorderProps) {
  const [scriptOpen, setScriptOpen] = useState(true);
  const {
    phase,
    audioBlob,
    originalBlob,
    error,
    elapsedMs,
    level,
    isSaving,
    isDenoising,
    noiseReductionEnabled,
    comparisonMode,
    hasActiveClip,
    startRecording,
    stopRecording,
    reRecord,
    setNoiseReductionEnabled,
    setComparisonMode,
  } = useRecorder({ blockId });

  const audioRef = useRef<HTMLAudioElement>(null);

  const isRecording = phase === "recording";
  const hasRecording = phase === "playback" && audioBlob !== null;
  const isLoading = phase === "loading" || isSaving;
  const displayBlob =
    comparisonMode === "before" && originalBlob ? originalBlob : audioBlob;

  useEffect(() => {
    return registerShortcutHandlers({
      onPlayPause: () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (audio.paused) void audio.play();
        else audio.pause();
      },
      onRecord: () => {
        if (isSaving || isDenoising || phase === "loading") return;
        if (isRecording) stopRecording();
        else if (phase === "idle" || (phase === "playback" && hasActiveClip)) {
          startRecording();
        }
      },
    });
  }, [
    hasActiveClip,
    isRecording,
    isSaving,
    isDenoising,
    phase,
    startRecording,
    stopRecording,
  ]);

  return (
    <section className={cn("space-y-6", className)}>
      <div
        className={cn(
          "grid gap-6 transition-[grid-template-columns] duration-300 ease-out",
          scriptOpen ? "lg:grid-cols-[1fr_minmax(280px,360px)]" : "lg:grid-cols-1"
        )}
      >
        <div className="min-w-0 space-y-6">
          <ClipList blockId={blockId} />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setScriptOpen((open) => !open)}
            >
              {scriptOpen ? (
                <>
                  <PanelRightClose className="size-4" />
                  Amagar guió
                </>
              ) : (
                <>
                  <PanelRightOpen className="size-4" />
                  Mostrar guió
                </>
              )}
            </Button>
            <Button
              type="button"
              variant={noiseReductionEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setNoiseReductionEnabled(!noiseReductionEnabled)}
            >
              Reducció de soroll (IA)
            </Button>
            {isDenoising && (
              <Badge variant="secondary">Millorant qualitat de so…</Badge>
            )}
            {originalBlob && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setComparisonMode(
                    comparisonMode === "after" ? "before" : "after"
                  )
                }
              >
                Escoltar {comparisonMode === "after" ? "abans" : "després"}
              </Button>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          {isLoading && phase === "loading" ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              <span className="text-sm">Carregant àudio…</span>
            </div>
          ) : (
            <>
              {isRecording && (
                <div className="rounded-xl border border-border/60 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground">
                      NIVELL D&apos;ÀUDIO
                    </p>
                    <p
                      className="font-mono text-2xl font-semibold tabular-nums text-foreground"
                      aria-live="polite"
                    >
                      {formatElapsed(elapsedMs)}
                    </p>
                  </div>
                  <VuMeter level={level} className="mb-2" />
                  <p className="text-center text-xs text-muted-foreground">
                    Gravant…
                  </p>
                </div>
              )}

              {hasRecording && displayBlob && !isRecording && (
                <WaveformView
                  blob={displayBlob}
                  audioRef={audioRef}
                  label={
                    comparisonMode === "before"
                      ? "FORMA D'ONA · ABANS"
                      : "FORMA D'ONA · DESPRÉS"
                  }
                />
              )}

              {phase === "idle" && !isRecording && (
                <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/80 bg-white/60 px-6 py-16 text-center">
                  <Mic className="size-10 text-muted-foreground/60" />
                  <p className="text-sm text-muted-foreground">
                    {hasActiveClip
                      ? "Prem el botó vermell per gravar en la pista seleccionada, o importa un fitxer."
                      : "Crea una pista nova o importa un fitxer per començar."}
                  </p>
                  <ImportAudioButton blockId={blockId} />
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-4">
                {(!hasRecording || isRecording) && (
                  <Button
                    type="button"
                    size="lg"
                    disabled={isLoading}
                    onClick={isRecording ? stopRecording : startRecording}
                    className={cn(
                      "h-14 min-w-[180px] gap-2 rounded-full text-base font-semibold shadow-md",
                      isRecording
                        ? "bg-neutral-800 text-white hover:bg-neutral-700"
                        : "bg-red-600 text-white hover:bg-red-700"
                    )}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="size-5 animate-spin" />
                        Desant…
                      </>
                    ) : isRecording ? (
                      <>
                        <Square className="size-5 fill-current" />
                        Aturar
                      </>
                    ) : (
                      <>
                        <Circle className="size-5 fill-current" />
                        Gravar
                      </>
                    )}
                  </Button>
                )}

                {hasRecording && !isRecording && (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    disabled={isLoading}
                    onClick={() => void reRecord()}
                    className="h-12 gap-2 rounded-full px-6"
                  >
                    <RotateCcw className="size-4" />
                    Regravar pista
                  </Button>
                )}
              </div>
            </>
          )}
        </div>

        <div
          className={cn(
            "overflow-hidden transition-all duration-300 ease-out",
            scriptOpen
              ? "max-h-[2000px] opacity-100"
              : "pointer-events-none max-h-0 opacity-0 lg:max-h-0"
          )}
          aria-hidden={!scriptOpen}
        >
          <ScriptPanel blockId={blockId} className="lg:sticky lg:top-4" />
        </div>
      </div>
    </section>
  );
}
