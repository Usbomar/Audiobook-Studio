"use client";

import { useEffect, useMemo, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import { cn } from "@/lib/utils";

interface WaveformViewProps {
  blob: Blob;
  label?: string;
  className?: string;
}

export function WaveformView({
  blob,
  label = "FORMA D'ONA",
  className,
}: WaveformViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const audioUrl = useMemo(() => URL.createObjectURL(blob), [blob]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ws = WaveSurfer.create({
      container,
      height: 128,
      waveColor: "#93c5fd",
      progressColor: "#2563eb",
      cursorColor: "#ef4444",
      cursorWidth: 2,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      normalize: true,
      url: audioUrl,
    });

    wavesurferRef.current = ws;

    return () => {
      ws.destroy();
      wavesurferRef.current = null;
    };
  }, [audioUrl]);

  useEffect(() => {
    return () => URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-white p-4 shadow-sm",
        className
      )}
    >
      <p className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground">
        {label}
      </p>
      <div ref={containerRef} className="w-full" />
      <audio controls src={audioUrl} className="mt-4 w-full" />
    </div>
  );
}
