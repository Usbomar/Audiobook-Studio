"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type PlaybackRange = {
  start: number;
  end: number;
};

export type PlayOptions = {
  range?: PlaybackRange;
};

export type PitchShifterPlayback = {
  ready: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  play: (options?: PlayOptions) => Promise<void>;
  pause: () => void;
  seekPercent: (percent: number) => void;
  seekTime: (time: number) => void;
  setVolume: (gain: number) => void;
  setEq: (eq: {
    bass: number;
    mid: number;
    treble: number;
    intensity: number;
  }) => void;
};

type ShifterInstance = {
  tempo: number;
  pitchSemitones: number;
  duration: number;
  percentagePlayed: number;
  connect: (node: AudioNode) => void;
  disconnect: () => void;
  on: (
    event: string,
    cb: (detail: { timePlayed: number }) => void
  ) => void;
  off: (event?: string | null) => void;
};

/** SoundTouch usa fracció 0–1 al setter; el getter retorna 0–100. */
function percentToFraction(percent: number): number {
  return Math.max(0, Math.min(1, percent / 100));
}

export function usePitchShifterPlayback(
  blob: Blob | null,
  tempo: number,
  pitchSemitones: number
): PitchShifterPlayback {
  const ctxRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const shifterRef = useRef<ShifterInstance | null>(null);
  /** Posició en percentatge 0–100 (UI) */
  const savedPercentRef = useRef(0);
  const playRangeRef = useRef<PlaybackRange | null>(null);
  const tempoRef = useRef(tempo);
  const pitchRef = useRef(pitchSemitones);

  const gainRef = useRef<GainNode | null>(null);
  const lowRef = useRef<BiquadFilterNode | null>(null);
  const midRef = useRef<BiquadFilterNode | null>(null);
  const highRef = useRef<BiquadFilterNode | null>(null);
  const compRef = useRef<DynamicsCompressorNode | null>(null);

  const [ready, setReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  tempoRef.current = tempo;
  pitchRef.current = pitchSemitones;

  const applySavedPositionToShifter = useCallback((shifter: ShifterInstance) => {
    shifter.percentagePlayed = percentToFraction(savedPercentRef.current);
  }, []);

  const stopPlayback = useCallback((resetToStart = false) => {
    if (shifterRef.current) {
      savedPercentRef.current = shifterRef.current.percentagePlayed;
    }
    shifterRef.current?.off("play");
    shifterRef.current?.disconnect();
    shifterRef.current = null;
    setIsPlaying(false);

    if (resetToStart) {
      savedPercentRef.current = 0;
      setCurrentTime(0);
      playRangeRef.current = null;
    }
  }, []);

  const destroyShifter = useCallback(() => {
    shifterRef.current?.off("play");
    shifterRef.current?.disconnect();
    shifterRef.current = null;
  }, []);

  const finishAtRangeEnd = useCallback(() => {
    const range = playRangeRef.current;
    const d = bufferRef.current?.duration ?? duration;
    if (range && d > 0) {
      savedPercentRef.current = (range.end / d) * 100;
      setCurrentTime(range.end);
    }
    destroyShifter();
    setIsPlaying(false);
  }, [destroyShifter, duration]);

  const createAndConnectShifter = useCallback(async () => {
    if (!ctxRef.current || !bufferRef.current || !gainRef.current) return null;

    const { PitchShifter } = await import("soundtouchjs");
    destroyShifter();

    const shifter = new PitchShifter(
      ctxRef.current,
      bufferRef.current,
      16384,
      () => {
        const range = playRangeRef.current;
        if (range) {
          finishAtRangeEnd();
          return;
        }
        stopPlayback(true);
      }
    ) as ShifterInstance;

    shifter.tempo = tempoRef.current;
    shifter.pitchSemitones = pitchRef.current;
    applySavedPositionToShifter(shifter);

    shifter.on("play", (detail) => {
      const range = playRangeRef.current;
      if (range && detail.timePlayed >= range.end - 0.03) {
        finishAtRangeEnd();
        return;
      }
      setCurrentTime(detail.timePlayed);
      savedPercentRef.current = shifter.percentagePlayed;
    });

    shifter.connect(gainRef.current);
    shifterRef.current = shifter;
    return shifter;
  }, [
    applySavedPositionToShifter,
    destroyShifter,
    finishAtRangeEnd,
    stopPlayback,
  ]);

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
      destroyShifter();
      void ctx.close();
      ctxRef.current = null;
      bufferRef.current = null;
    };
  }, [destroyShifter]);

  useEffect(() => {
    if (!blob || !ctxRef.current) {
      setReady(false);
      bufferRef.current = null;
      return;
    }

    let cancelled = false;
    setReady(false);
    stopPlayback(true);
    playRangeRef.current = null;
    destroyShifter();

    void (async () => {
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await ctxRef.current!.decodeAudioData(
          arrayBuffer.slice(0)
        );
        if (cancelled) return;

        bufferRef.current = audioBuffer;
        setDuration(audioBuffer.duration);
        setReady(true);
      } catch {
        if (!cancelled) setReady(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blob, destroyShifter, stopPlayback]);

  const play = useCallback(
    async (options?: PlayOptions) => {
      if (!bufferRef.current) return;
      const d = bufferRef.current.duration;

      if (options?.range) {
        const start = Math.max(0, Math.min(options.range.start, d));
        const end = Math.max(start, Math.min(options.range.end, d));
        playRangeRef.current = { start, end };

        const currentTime = (savedPercentRef.current / 100) * d;
        if (currentTime < start || currentTime >= end - 0.02) {
          savedPercentRef.current = (start / d) * 100;
          setCurrentTime(start);
        }
      } else {
        playRangeRef.current = null;
      }

      await ctxRef.current?.resume();
      await createAndConnectShifter();
      setIsPlaying(true);
    },
    [createAndConnectShifter]
  );

  const pause = useCallback(() => {
    if (shifterRef.current) {
      savedPercentRef.current = shifterRef.current.percentagePlayed;
      setCurrentTime(
        (savedPercentRef.current / 100) * shifterRef.current.duration
      );
    }
    destroyShifter();
    setIsPlaying(false);
  }, [destroyShifter]);

  const seekPercent = useCallback(
    (percent: number) => {
      const clamped = Math.max(0, Math.min(100, percent));
      savedPercentRef.current = clamped;
      const d = bufferRef.current?.duration ?? duration;
      if (d > 0) {
        setCurrentTime((clamped / 100) * d);
      }
      if (shifterRef.current) {
        shifterRef.current.percentagePlayed = percentToFraction(clamped);
      }
    },
    [duration]
  );

  const seekTime = useCallback(
    (time: number) => {
      const d = bufferRef.current?.duration ?? duration;
      if (d <= 0) return;
      const clamped = Math.max(0, Math.min(d, time));
      seekPercent((clamped / d) * 100);
    },
    [duration, seekPercent]
  );

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
    seekTime,
    setVolume,
    setEq,
  };
}
