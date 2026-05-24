"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type PitchShifterPlayback = {
  ready: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  play: () => Promise<void>;
  pause: () => void;
  seekPercent: (percent: number) => void;
  setVolume: (gain: number) => void;
  setEq: (eq: {
    bass: number;
    mid: number;
    treble: number;
    intensity: number;
  }) => void;
};

export function usePitchShifterPlayback(
  blob: Blob | null,
  tempo: number,
  pitchSemitones: number
): PitchShifterPlayback {
  const ctxRef = useRef<AudioContext | null>(null);
  const shifterRef = useRef<{
    tempo: number;
    pitchSemitones: number;
    duration: number;
    connect: (node: AudioNode) => void;
    disconnect: () => void;
    on: (event: string, cb: (detail: { timePlayed: number }) => void) => void;
    off: (event?: string | null) => void;
    percentagePlayed: number;
  } | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const lowRef = useRef<BiquadFilterNode | null>(null);
  const midRef = useRef<BiquadFilterNode | null>(null);
  const highRef = useRef<BiquadFilterNode | null>(null);
  const compRef = useRef<DynamicsCompressorNode | null>(null);

  const [ready, setReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const ctx = new AudioContext();
    ctxRef.current = ctx;

    const gain = ctx.createGain();
    const low = ctx.createBiquadFilter();
    low.type = "lowshelf";
    low.frequency.value = 200;
    const mid = ctx.createBiquadFilter();
    mid.type = "peaking";
    mid.frequency.value = 1000;
    mid.Q.value = 1;
    const high = ctx.createBiquadFilter();
    high.type = "highshelf";
    high.frequency.value = 3500;
    const comp = ctx.createDynamicsCompressor();

    gain.connect(low).connect(mid).connect(high).connect(comp).connect(ctx.destination);

    gainRef.current = gain;
    lowRef.current = low;
    midRef.current = mid;
    highRef.current = high;
    compRef.current = comp;

    return () => {
      shifterRef.current?.off("play");
      shifterRef.current?.disconnect();
      void ctx.close();
      ctxRef.current = null;
      shifterRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!blob || !ctxRef.current) {
      setReady(false);
      return;
    }

    let cancelled = false;
    setReady(false);
    setIsPlaying(false);
    setCurrentTime(0);

    void (async () => {
      try {
        const { PitchShifter } = await import("soundtouchjs");
        if (cancelled || !ctxRef.current) return;

        shifterRef.current?.off("play");
        shifterRef.current?.disconnect();

        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await ctxRef.current.decodeAudioData(
          arrayBuffer.slice(0)
        );
        if (cancelled) return;

        const shifter = new PitchShifter(
          ctxRef.current,
          audioBuffer,
          16384,
          () => setIsPlaying(false)
        );
        shifter.tempo = tempo;
        shifter.pitchSemitones = pitchSemitones;
        shifter.on("play", (detail) => {
          setCurrentTime(detail.timePlayed);
        });

        shifterRef.current = shifter;
        setDuration(shifter.duration);
        setReady(true);
      } catch {
        if (!cancelled) setReady(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // tempo/pitch s'apliquen en un efecte separat sense recrear el shifter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blob]);

  useEffect(() => {
    if (!shifterRef.current) return;
    shifterRef.current.tempo = tempo;
    shifterRef.current.pitchSemitones = pitchSemitones;
  }, [tempo, pitchSemitones]);

  const play = useCallback(async () => {
    if (!shifterRef.current || !gainRef.current) return;
    await ctxRef.current?.resume();
    shifterRef.current.connect(gainRef.current);
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    shifterRef.current?.disconnect();
    setIsPlaying(false);
  }, []);

  const seekPercent = useCallback((percent: number) => {
    if (!shifterRef.current) return;
    shifterRef.current.percentagePlayed = Math.max(0, Math.min(100, percent));
    setCurrentTime(
      (shifterRef.current.percentagePlayed / 100) * shifterRef.current.duration
    );
  }, []);

  const setVolume = useCallback((gain: number) => {
    if (gainRef.current) gainRef.current.gain.value = gain;
  }, []);

  const setEq = useCallback(
    (eq: { bass: number; mid: number; treble: number; intensity: number }) => {
      if (lowRef.current) lowRef.current.gain.value = eq.bass;
      if (midRef.current) midRef.current.gain.value = eq.mid;
      if (highRef.current) highRef.current.gain.value = eq.treble;
      if (compRef.current) {
        const ratio = 1 + eq.intensity / 12;
        compRef.current.ratio.value = ratio;
        compRef.current.threshold.value = -24 - eq.intensity;
      }
    },
    []
  );

  return {
    ready,
    isPlaying,
    currentTime,
    duration,
    play,
    pause,
    seekPercent,
    setVolume,
    setEq,
  };
}
