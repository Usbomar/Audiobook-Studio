"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getAudioDurationFromBlob,
  getMicrophoneErrorMessage,
  getSupportedRecordingMimeType,
  MIN_RECORDING_DURATION_SECONDS,
  reduceNoiseWithRnnoise,
  toStoredDurationSeconds,
} from "@/lib/audio";
import {
  deleteBlockAudio,
  loadBlockAudio,
  persistBlockRecording,
} from "@/lib/storage";
import { useStudioStore } from "@/store";

export type RecorderPhase = "loading" | "idle" | "recording" | "playback";

interface UseRecorderOptions {
  blockId: string;
}

interface RecorderSession {
  stream: MediaStream;
  mediaRecorder: MediaRecorder;
  audioContext: AudioContext;
  analyser: AnalyserNode;
  chunks: BlobPart[];
}

export function useRecorder({ blockId }: UseRecorderOptions) {
  const updateBlock = useStudioStore((s) => s.updateBlock);
  const storeBlob = useStudioStore(
    (s) => s.blocks.find((b) => b.id === blockId)?.audioBlob ?? null
  );

  const [phase, setPhase] = useState<RecorderPhase>("loading");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isDenoising, setIsDenoising] = useState(false);
  const [noiseReductionEnabled, setNoiseReductionEnabled] = useState(true);
  const [originalBlob, setOriginalBlob] = useState<Blob | null>(null);
  const [comparisonMode, setComparisonMode] = useState<"after" | "before">(
    "after"
  );

  const sessionRef = useRef<RecorderSession | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  const stopMeterLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cleanupSession = useCallback(() => {
    stopMeterLoop();
    stopTimer();
    const session = sessionRef.current;
    if (session) {
      if (session.mediaRecorder.state !== "inactive") {
        try {
          session.mediaRecorder.stop();
        } catch {
          /* ja aturat */
        }
      }
      session.stream.getTracks().forEach((track) => track.stop());
      void session.audioContext.close();
      sessionRef.current = null;
    }
    setLevel(0);
  }, [stopMeterLoop, stopTimer]);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      setPhase("loading");
      setError(null);

      if (storeBlob) {
        if (!cancelled) {
          setAudioBlob(storeBlob);
          setOriginalBlob(null);
          setPhase("playback");
        }
        return;
      }

      try {
        const stored = await loadBlockAudio(blockId);
        if (cancelled) return;

        if (stored) {
          const duration = await getAudioDurationFromBlob(stored);
          const durationSeconds = toStoredDurationSeconds(duration);
          updateBlock(blockId, {
            audioBlob: stored,
            durationSeconds,
            status: "recorded",
          });
          setAudioBlob(stored);
          setOriginalBlob(null);
          setPhase("playback");
        } else {
          setAudioBlob(null);
          setPhase("idle");
        }
      } catch {
        if (!cancelled) {
          setAudioBlob(null);
          setPhase("idle");
        }
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [blockId, storeBlob, updateBlock]);

  useEffect(() => {
    return () => cleanupSession();
  }, [cleanupSession]);

  const startMeterLoop = useCallback((analyser: AnalyserNode) => {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    dataArrayRef.current = dataArray;

    const tick = () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const avg = sum / dataArray.length / 255;
      setLevel(avg);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("El teu navegador no admet gravació d'àudio.");
      return;
    }

    const mimeType = getSupportedRecordingMimeType();
    if (!mimeType) {
      setError("El teu navegador no admet cap format de gravació compatible.");
      return;
    }

    try {
      cleanupSession();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      mediaRecorder.onerror = () => {
        setError("S'ha produït un error durant la gravació.");
        cleanupSession();
        setPhase(audioBlob ? "playback" : "idle");
      };

      mediaRecorder.onstop = () => {
        stopMeterLoop();
        stopTimer();

        const recordedSeconds = (Date.now() - startedAtRef.current) / 1000;
        const blob = new Blob(chunks, { type: mimeType });
        stream.getTracks().forEach((track) => track.stop());
        void audioContext.close();
        sessionRef.current = null;

        if (blob.size === 0) {
          setPhase(audioBlob ? "playback" : "idle");
          return;
        }

        if (recordedSeconds < MIN_RECORDING_DURATION_SECONDS) {
          setError(
            `La gravació ha de durar almenys ${MIN_RECORDING_DURATION_SECONDS} segon.`
          );
          setPhase(audioBlob ? "playback" : "idle");
          setElapsedMs(0);
          return;
        }

        void (async () => {
          setIsSaving(true);
          try {
            let finalBlob = blob;
            if (noiseReductionEnabled) {
              setIsDenoising(true);
              try {
                finalBlob = await reduceNoiseWithRnnoise(blob);
                setOriginalBlob(blob);
                setComparisonMode("after");
              } catch {
                setOriginalBlob(null);
              } finally {
                setIsDenoising(false);
              }
            } else {
              setOriginalBlob(null);
            }

            const finalDuration = await getAudioDurationFromBlob(
              finalBlob,
              recordedSeconds
            );
            const durationSeconds = toStoredDurationSeconds(finalDuration);
            await persistBlockRecording(blockId, finalBlob, durationSeconds);
            setAudioBlob(finalBlob);
            setPhase("playback");
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "No s'ha pogut desar la gravació."
            );
            setPhase("idle");
          } finally {
            setIsSaving(false);
            setElapsedMs(0);
            setIsDenoising(false);
          }
        })();
      };

      sessionRef.current = {
        stream,
        mediaRecorder,
        audioContext,
        analyser,
        chunks,
      };

      mediaRecorder.start(250);
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setPhase("recording");
      startMeterLoop(analyser);

      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 100);
    } catch (err) {
      cleanupSession();
      setError(getMicrophoneErrorMessage(err));
      setPhase(audioBlob ? "playback" : "idle");
    }
  }, [
    audioBlob,
    blockId,
    cleanupSession,
    noiseReductionEnabled,
    startMeterLoop,
    stopMeterLoop,
    stopTimer,
  ]);

  const stopRecording = useCallback(() => {
    const session = sessionRef.current;
    if (!session || session.mediaRecorder.state === "inactive") return;
    session.mediaRecorder.stop();
  }, []);

  const reRecord = useCallback(async () => {
    setError(null);
    cleanupSession();
    setElapsedMs(0);
    setIsSaving(true);
    try {
      await deleteBlockAudio(blockId);
      updateBlock(blockId, {
        audioBlob: null,
        durationSeconds: 0,
        status: "empty",
      });
      setOriginalBlob(null);
      setAudioBlob(null);
      setPhase("idle");
    } catch {
      setError("No s'ha pogut esborrar la gravació anterior.");
    } finally {
      setIsSaving(false);
    }
  }, [blockId, cleanupSession, updateBlock]);

  return {
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
    startRecording,
    stopRecording,
    reRecord,
    setNoiseReductionEnabled,
    setComparisonMode,
    setError,
  };
}
