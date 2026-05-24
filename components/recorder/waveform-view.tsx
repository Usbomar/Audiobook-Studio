"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import WaveSurfer from "wavesurfer.js";
import { cn } from "@/lib/utils";

interface WaveformViewProps {
  blob: Blob;
  label?: string;
  className?: string;
  audioRef?: RefObject<HTMLAudioElement>;
}

export function WaveformView({
  blob,
  label = "FORMA D'ONA",
  className,
  audioRef,
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

  useEffect(() => {
    const audio = audioRef?.current;
    if (!audio) return;

    let lastLoggedSecond = -1;

    const resetIfEnded = () => {
      const willReset =
        Number.isFinite(audio.duration) &&
        audio.currentTime >= audio.duration - 0.05;
      // #region agent log
      if (willReset) {
        fetch("http://127.0.0.1:7696/ingest/413f817f-149f-48a6-901c-86e9787dbcfb", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "c2f93a",
          },
          body: JSON.stringify({
            sessionId: "c2f93a",
            runId: "pre-fix",
            hypothesisId: "F",
            location: "waveform-view.tsx:resetIfEnded",
            message: "HTML audio reset on play (near end)",
            data: {
              currentTime: audio.currentTime,
              duration: audio.duration,
              blobSize: blob.size,
              blobType: blob.type,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      }
      // #endregion
      if (willReset) {
        audio.currentTime = 0;
      }
    };

    const onPlay = () => resetIfEnded();

    const onLoadedMetadata = () => {
      // #region agent log
      fetch("http://127.0.0.1:7696/ingest/413f817f-149f-48a6-901c-86e9787dbcfb", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "c2f93a",
        },
        body: JSON.stringify({
          sessionId: "c2f93a",
          runId: "pre-fix",
          hypothesisId: "C",
          location: "waveform-view.tsx:loadedmetadata",
          message: "HTML audio metadata",
          data: {
            duration: audio.duration,
            seekableEnd: audio.seekable?.length
              ? audio.seekable.end(audio.seekable.length - 1)
              : null,
            blobSize: blob.size,
            blobType: blob.type,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    };

    const onTimeUpdate = () => {
      const sec = Math.floor(audio.currentTime);
      if (sec === lastLoggedSecond) return;
      lastLoggedSecond = sec;
      if (sec % 3 !== 0 && sec > 2) return;
      // #region agent log
      fetch("http://127.0.0.1:7696/ingest/413f817f-149f-48a6-901c-86e9787dbcfb", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "c2f93a",
        },
        body: JSON.stringify({
          sessionId: "c2f93a",
          runId: "pre-fix",
          hypothesisId: "C",
          location: "waveform-view.tsx:timeupdate",
          message: "HTML audio progress",
          data: {
            currentTime: audio.currentTime,
            duration: audio.duration,
            paused: audio.paused,
            ended: audio.ended,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    };

    const onEnded = () => {
      // #region agent log
      fetch("http://127.0.0.1:7696/ingest/413f817f-149f-48a6-901c-86e9787dbcfb", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "c2f93a",
        },
        body: JSON.stringify({
          sessionId: "c2f93a",
          runId: "pre-fix",
          hypothesisId: "C",
          location: "waveform-view.tsx:ended",
          message: "HTML audio ended event",
          data: {
            currentTime: audio.currentTime,
            duration: audio.duration,
            blobSize: blob.size,
            blobType: blob.type,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      audio.pause();
      audio.currentTime = 0;
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [audioUrl, audioRef, blob.size, blob.type]);

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
      <audio ref={audioRef} controls src={audioUrl} className="mt-4 w-full" />
    </div>
  );
}
