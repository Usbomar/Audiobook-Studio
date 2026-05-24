"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { registerShortcutHandlers } from "@/lib/shortcuts";
import { usePitchShifterPlayback } from "@/lib/audio/use-pitch-shifter-playback";
import { persistEditedBlockAudio } from "@/lib/storage";
import { getAudioDurationFromBlob } from "@/lib/audio";
import { useStudioStore } from "@/store";

const MAX_HISTORY = 20;

type EditorSettings = {
  volume: number;
  speed: number;
  pitch: number;
  bass: number;
  mid: number;
  treble: number;
  intensity: number;
};

const initialSettings: EditorSettings = {
  volume: 100,
  speed: 100,
  pitch: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  intensity: 0,
};

function getSliderValue(value: number | readonly number[]): number {
  return typeof value === "number" ? value : value[0] ?? 0;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  let offset = 0;
  const write = (text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset++, text.charCodeAt(i));
  };

  write("RIFF");
  view.setUint32(offset, 36 + dataSize, true);
  offset += 4;
  write("WAVEfmt ");
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * bytesPerSample, true);
  offset += 4;
  view.setUint16(offset, bytesPerSample, true);
  offset += 2;
  view.setUint16(offset, 16, true);
  offset += 2;
  write("data");
  view.setUint32(offset, dataSize, true);
  offset += 4;

  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export function AudioEditor({ blockId }: { blockId: string }) {
  const block = useStudioStore((s) => s.blocks.find((b) => b.id === blockId));
  const updateBlock = useStudioStore((s) => s.updateBlock);
  const [settings, setSettings] = useState<EditorSettings>(initialSettings);
  const [advanced, setAdvanced] = useState(false);
  const [history, setHistory] = useState<Blob[]>([]);
  const [future, setFuture] = useState<Blob[]>([]);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [zoom, setZoom] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionPluginRef = useRef<ReturnType<typeof RegionsPlugin.create> | null>(null);

  const blob = block?.audioBlob ?? null;
  const blobUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);

  const tempo = settings.speed / 100;
  const playback = usePitchShifterPlayback(blob, tempo, settings.pitch);

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
      dragToSeek: true,
      plugins: [regions],
    });
    regionPluginRef.current = regions;
    wsRef.current = ws;

    ws.on("decode", () => ws.zoom(zoom * 20));
    regions.on("region-updated", (region) =>
      setSelection({ start: region.start, end: region.end })
    );
    regions.on("region-removed", () => setSelection(null));

    return () => {
      ws.destroy();
      wsRef.current = null;
      regionPluginRef.current = null;
    };
  }, [blobUrl, zoom]);

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

  const cutSelection = async () => {
    if (!blob || !selection || selection.end <= selection.start) return;
    const ctx = new AudioContext();
    try {
      const decoded = await ctx.decodeAudioData((await blob.arrayBuffer()).slice(0));
      const samples = decoded.getChannelData(0);
      const start = Math.floor(selection.start * decoded.sampleRate);
      const end = Math.floor(selection.end * decoded.sampleRate);

      const result = new Float32Array(samples.length - (end - start));
      result.set(samples.subarray(0, start), 0);
      result.set(samples.subarray(end), start);

      const cutBlob = encodeWav(result, decoded.sampleRate);
      setHistory((prev) => [...prev.slice(-MAX_HISTORY + 1), blob]);
      setFuture([]);

      const duration = await getAudioDurationFromBlob(cutBlob);
      await persistEditedBlockAudio(blockId, cutBlob, Math.max(1, Math.round(duration)));
      updateBlock(blockId, { status: "edited" });
      setSelection(null);
      regionPluginRef.current?.clearRegions();
    } finally {
      await ctx.close();
    }
  };

  const undo = async () => {
    if (!blob || history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setFuture((prev) => [blob, ...prev].slice(0, MAX_HISTORY));
    const duration = await getAudioDurationFromBlob(previous);
    await persistEditedBlockAudio(blockId, previous, Math.max(1, Math.round(duration)));
  };

  const redo = async () => {
    if (future.length === 0 || !blob) return;
    const next = future[0];
    setFuture((prev) => prev.slice(1));
    setHistory((prev) => [...prev.slice(-MAX_HISTORY + 1), blob]);
    const duration = await getAudioDurationFromBlob(next);
    await persistEditedBlockAudio(blockId, next, Math.max(1, Math.round(duration)));
  };

  const undoRef = useRef(undo);
  undoRef.current = undo;

  useEffect(() => {
    return registerShortcutHandlers({
      onUndo: () => void undoRef.current(),
      onPlayPause: () => togglePlayPauseRef.current(),
    });
  }, []);

  if (!blob) return null;

  const progressPercent =
    playback.duration > 0 ? (playback.currentTime / playback.duration) * 100 : 0;

  return (
    <section className="mt-8 space-y-4 rounded-xl border border-border/70 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Editor d&apos;àudio</h2>
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={cutSelection} disabled={!selection}>
            Retallar selecció
          </Button>
          {selection && (
            <p className="text-sm text-muted-foreground">
              {selection.start.toFixed(2)}s - {selection.end.toFixed(2)}s
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
          hint="Canvia el ritme sense alterar el to de la veu"
          min={60}
          max={140}
          value={settings.speed}
          onChange={(value) => updateSetting("speed", value)}
        />
        <SliderControl
          label={`To de veu (${settings.pitch > 0 ? "+" : ""}${settings.pitch} semitons)`}
          hint="Aguts i greus sense canviar la durada"
          min={-12}
          max={12}
          step={1}
          value={settings.pitch}
          onChange={(value) => updateSetting("pitch", value)}
        />
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
