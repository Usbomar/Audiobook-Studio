"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { ClipboardPaste, Copy, Pause, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { registerShortcutHandlers } from "@/lib/shortcuts";
import {
  DEFAULT_EDITOR_SETTINGS,
  PITCH_OPTIONS,
  type EditorSettings,
} from "@/lib/audio/editor-settings";
import { usePitchShifterPlayback } from "@/lib/audio/use-pitch-shifter-playback";
import {
  decodeBlobToMonoSamples,
  deleteSampleRange,
  encodeWav,
  extractSampleRange,
  insertSamplesAt,
  timeRangeToSampleRange,
} from "@/lib/audio/wav-utils";
import { persistEditedClipAudio } from "@/lib/storage";
import { getAudioDurationFromBlob } from "@/lib/audio";
import { getActiveClip, useStudioStore } from "@/store";

const MAX_HISTORY = 20;

type AudioClipboard = {
  samples: Float32Array;
  sampleRate: number;
};

function getSliderValue(value: number | readonly number[]): number {
  return typeof value === "number" ? value : value[0] ?? 0;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatPitchLabel(semitones: number): string {
  if (semitones === 0) return "0 (original)";
  return semitones > 0 ? `+${semitones}` : String(semitones);
}

export function AudioEditor({ blockId }: { blockId: string }) {
  const block = useStudioStore((s) => s.blocks.find((b) => b.id === blockId));
  const clips = useStudioStore((s) => s.clips);
  const updateClip = useStudioStore((s) => s.updateClip);
  const activeClip = block ? getActiveClip(clips, block) : undefined;
  const clipId = activeClip?.id;

  const [settings, setSettings] = useState<EditorSettings>(DEFAULT_EDITOR_SETTINGS);
  const [advanced, setAdvanced] = useState(false);
  const [history, setHistory] = useState<Blob[]>([]);
  const [future, setFuture] = useState<Blob[]>([]);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(
    null
  );
  const [clipboard, setClipboard] = useState<AudioClipboard | null>(null);
  const [zoom, setZoom] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionPluginRef = useRef<ReturnType<typeof RegionsPlugin.create> | null>(null);
  const disableDragSelectionRef = useRef<(() => void) | null>(null);
  const clipboardRef = useRef(clipboard);
  clipboardRef.current = clipboard;

  const blob = activeClip?.audioBlob ?? null;
  const blobUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);

  useEffect(() => {
    if (!activeClip) return;
    setSettings(activeClip.editorSettings);
    setHistory([]);
    setFuture([]);
    setSelection(null);
  }, [activeClip]);

  useEffect(() => {
    if (!clipId) return;
    const timer = window.setTimeout(() => {
      updateClip(clipId, { editorSettings: settings });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [clipId, settings, updateClip]);

  const tempo = settings.speed / 100;
  const playback = usePitchShifterPlayback(blob, tempo, settings.pitch);
  const playbackRef = useRef(playback);
  playbackRef.current = playback;

  const applySamples = useCallback(
    async (samples: Float32Array, sampleRate: number) => {
      if (!blob || !clipId) return;
      const newBlob = encodeWav(samples, sampleRate);
      setHistory((prev) => [...prev.slice(-MAX_HISTORY + 1), blob]);
      setFuture([]);
      const duration = await getAudioDurationFromBlob(newBlob);
      await persistEditedClipAudio(
        clipId,
        blockId,
        newBlob,
        Math.max(1, Math.round(duration))
      );
      setSelection(null);
      regionPluginRef.current?.clearRegions();
      playback.pause();
      playback.seekPercent(0);
    },
    [blob, blockId, clipId, playback]
  );

  const setupDragSelection = useCallback(() => {
    const regions = regionPluginRef.current;
    if (!regions) return;
    disableDragSelectionRef.current?.();
    disableDragSelectionRef.current = regions.enableDragSelection({
      color: "rgba(37, 99, 235, 0.35)",
      drag: true,
      resize: true,
    });
  }, []);

  const syncRegionToSelection = useCallback((start: number, end: number) => {
    if (end > start + 0.02) setSelection({ start, end });
  }, []);

  const createRegionAtPlayhead = useCallback((durationSec = 3) => {
    const regions = regionPluginRef.current;
    if (!regions || playbackRef.current.duration <= 0) return;

    const start = Math.max(0, playbackRef.current.currentTime);
    const end = Math.min(playbackRef.current.duration, start + durationSec);
    regions.clearRegions();
    const region = regions.addRegion({
      start,
      end,
      color: "rgba(37, 99, 235, 0.35)",
      drag: true,
      resize: true,
    });
    syncRegionToSelection(region.start, region.end);
  }, [syncRegionToSelection]);

  useEffect(() => {
    if (!blobUrl || !containerRef.current) return;
    const regions = RegionsPlugin.create();
    const ws = WaveSurfer.create({
      container: containerRef.current,
      url: blobUrl,
      height: 120,
      waveColor: "#94a3b8",
      progressColor: "#1d4ed8",
      normalize: true,
      dragToSeek: false,
      plugins: [regions],
    });
    regionPluginRef.current = regions;
    wsRef.current = ws;

    const onReady = () => {
      ws.zoom(zoom * 20);
      setupDragSelection();
    };

    ws.on("ready", onReady);
    ws.on("decode", onReady);

    regions.on("region-created", (region) => {
      regions.getRegions().forEach((r) => {
        if (r !== region) r.remove();
      });
      syncRegionToSelection(region.start, region.end);
    });
    regions.on("region-updated", (region) =>
      syncRegionToSelection(region.start, region.end)
    );
    regions.on("region-removed", () => setSelection(null));

    ws.on("click", (relativeX) => {
      const duration = ws.getDuration();
      if (duration > 0 && typeof relativeX === "number") {
        const time = relativeX * duration;
        playbackRef.current.seekPercent((time / duration) * 100);
      }
    });

    return () => {
      disableDragSelectionRef.current?.();
      disableDragSelectionRef.current = null;
      ws.destroy();
      wsRef.current = null;
      regionPluginRef.current = null;
    };
  }, [blobUrl, zoom, setupDragSelection, syncRegionToSelection]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  useEffect(() => {
    playback.setVolume(settings.volume / 100);
    playback.setEq({
      bass: settings.bass,
      mid: settings.mid,
      treble: settings.treble,
      intensity: settings.intensity,
    });
  }, [settings, playback]);

  const updateSetting = (key: keyof EditorSettings, value: number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const togglePlayPause = () => {
    if (playback.isPlaying) playback.pause();
    else void playback.play();
  };

  const togglePlayPauseRef = useRef(togglePlayPause);
  togglePlayPauseRef.current = togglePlayPause;

  const copySelection = async () => {
    if (!blob || !selection || selection.end <= selection.start) return;
    const { samples, sampleRate } = await decodeBlobToMonoSamples(blob);
    const { start, end } = timeRangeToSampleRange(
      selection.start,
      selection.end,
      sampleRate
    );
    setClipboard({
      samples: extractSampleRange(samples, start, end),
      sampleRate,
    });
  };

  const deleteSelection = async () => {
    if (!blob || !selection || selection.end <= selection.start) return;
    const { samples, sampleRate } = await decodeBlobToMonoSamples(blob);
    const { start, end } = timeRangeToSampleRange(
      selection.start,
      selection.end,
      sampleRate
    );
    await applySamples(deleteSampleRange(samples, start, end), sampleRate);
  };

  const pasteAtPlayhead = async () => {
    const clip = clipboardRef.current;
    if (!blob || !clip) return;
    const { samples, sampleRate } = await decodeBlobToMonoSamples(blob);
    if (clip.sampleRate !== sampleRate) {
      return;
    }
    const index = Math.floor(playback.currentTime * sampleRate);
    await applySamples(
      insertSamplesAt(samples, index, clip.samples),
      sampleRate
    );
  };

  const undo = async () => {
    if (!blob || !clipId || history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setFuture((prev) => [blob, ...prev].slice(0, MAX_HISTORY));
    const duration = await getAudioDurationFromBlob(previous);
    await persistEditedClipAudio(
      clipId,
      blockId,
      previous,
      Math.max(1, Math.round(duration))
    );
  };

  const redo = async () => {
    if (!clipId || future.length === 0 || !blob) return;
    const next = future[0];
    setFuture((prev) => prev.slice(1));
    setHistory((prev) => [...prev.slice(-MAX_HISTORY + 1), blob]);
    const duration = await getAudioDurationFromBlob(next);
    await persistEditedClipAudio(
      clipId,
      blockId,
      next,
      Math.max(1, Math.round(duration))
    );
  };

  const undoRef = useRef(undo);
  undoRef.current = undo;

  useEffect(() => {
    return registerShortcutHandlers({
      onUndo: () => void undoRef.current(),
      onPlayPause: () => togglePlayPauseRef.current(),
    });
  }, []);

  if (!blob || !activeClip) return null;

  const progressPercent =
    playback.duration > 0 ? (playback.currentTime / playback.duration) * 100 : 0;

  return (
    <section className="mt-8 space-y-4 rounded-xl border border-border/70 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Editor d&apos;àudio</h2>
          <p className="text-sm text-muted-foreground">{activeClip.title}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setAdvanced(!advanced)}>
            {advanced ? "Mode simple" : "Mode avançat"}
          </Button>
          <Button variant="outline" onClick={undo} disabled={history.length === 0}>
            Undo
          </Button>
          <Button variant="outline" onClick={redo} disabled={future.length === 0}>
            Redo
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border/60 p-4">
        <p className="text-xs text-muted-foreground">
          Arrossega sobre la forma d&apos;ona per marcar un tram (zona blava), o
          fes servir «Selecció al cursor». Clica on vulguis enganxar i prem
          «Enganxar».
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!playback.ready}
          onClick={() => createRegionAtPlayhead(3)}
        >
          Selecció al cursor (3s)
        </Button>
        <div ref={containerRef} />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!playback.ready}
            onClick={togglePlayPause}
          >
            {playback.isPlaying ? (
              <>
                <Pause className="size-4" />
                Pausa
              </>
            ) : (
              <>
                <Play className="size-4 fill-current" />
                Reproduir
              </>
            )}
          </Button>
          <span className="font-mono text-sm tabular-nums text-muted-foreground">
            {formatTime(playback.currentTime)} / {formatTime(playback.duration)}
          </span>
        </div>
        <Slider
          min={0}
          max={100}
          step={0.5}
          value={[progressPercent]}
          disabled={!playback.ready || playback.duration === 0}
          onValueChange={(v) => playback.seekPercent(getSliderValue(v))}
        />
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Zoom</p>
          <Slider
            min={1}
            max={20}
            step={1}
            value={[zoom]}
            onValueChange={(v) => setZoom(getSliderValue(v) || 1)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!selection}
            onClick={() => void copySelection()}
          >
            <Copy className="size-3.5" />
            Copiar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!clipboard}
            onClick={() => void pasteAtPlayhead()}
          >
            <ClipboardPaste className="size-3.5" />
            Enganxar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!selection}
            onClick={() => void deleteSelection()}
          >
            <Trash2 className="size-3.5" />
            Esborrar tram
          </Button>
          {selection && (
            <p className="self-center text-sm text-muted-foreground">
              {selection.start.toFixed(2)}s – {selection.end.toFixed(2)}s
            </p>
          )}
          {clipboard && (
            <p className="self-center text-xs text-muted-foreground">
              Portaretalls: {(clipboard.samples.length / clipboard.sampleRate).toFixed(1)}s
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SliderControl
          label={`Volum (${settings.volume}%)`}
          min={50}
          max={200}
          value={settings.volume}
          onChange={(value) => updateSetting("volume", value)}
        />
        <SliderControl
          label={`Velocitat (${settings.speed}%)`}
          hint="Canvia el ritme sense alterar el to de la veu (previsualització)"
          min={50}
          max={200}
          value={settings.speed}
          onChange={(value) => updateSetting("speed", value)}
        />
        <div className="space-y-1">
          <label htmlFor="pitch-select" className="text-sm font-medium">
            To de veu (semitons)
          </label>
          <p className="text-xs text-muted-foreground">
            Aguts i greus; s&apos;aplica a l&apos;exportació
          </p>
          <select
            id="pitch-select"
            className="h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
            value={settings.pitch}
            onChange={(e) => updateSetting("pitch", Number(e.target.value))}
          >
            {PITCH_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {formatPitchLabel(n)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {advanced && (
        <div className="grid gap-4 md:grid-cols-4">
          <SliderControl
            label={`Bass (${settings.bass})`}
            min={-12}
            max={12}
            step={1}
            value={settings.bass}
            onChange={(value) => updateSetting("bass", value)}
          />
          <SliderControl
            label={`Mid (${settings.mid})`}
            min={-12}
            max={12}
            step={1}
            value={settings.mid}
            onChange={(value) => updateSetting("mid", value)}
          />
          <SliderControl
            label={`Treble (${settings.treble})`}
            min={-12}
            max={12}
            step={1}
            value={settings.treble}
            onChange={(value) => updateSetting("treble", value)}
          />
          <SliderControl
            label={`Intensitat (${settings.intensity})`}
            min={0}
            max={10}
            step={1}
            value={settings.intensity}
            onChange={(value) => updateSetting("intensity", value)}
          />
        </div>
      )}
    </section>
  );
}

function SliderControl({
  label,
  hint,
  min,
  max,
  step = 1,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{label}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(values) => onChange(getSliderValue(values) || value)}
      />
    </div>
  );
}
