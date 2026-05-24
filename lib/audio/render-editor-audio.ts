import type { EditorSettings } from "./editor-settings";
import { getFFmpeg, getLastFfmpegLog } from "./ffmpeg-client";
import { prepareFfmpegInputBlob } from "./prepare-ffmpeg-input";
import { fetchFile } from "@ffmpeg/util";

function buildAtempoChain(factor: number): string[] {
  const filters: string[] = [];
  let remaining = factor;
  while (remaining > 2.0) {
    filters.push("atempo=2.0");
    remaining /= 2.0;
  }
  while (remaining < 0.5) {
    filters.push("atempo=0.5");
    remaining /= 0.5;
  }
  if (Math.abs(remaining - 1) > 0.001) {
    filters.push(`atempo=${remaining.toFixed(4)}`);
  }
  return filters;
}

export function buildEditorAudioFilter(settings: EditorSettings): string | null {
  const parts: string[] = [];
  const tempo = settings.speed / 100;

  if (tempo !== 1) {
    parts.push(...buildAtempoChain(tempo));
  }

  if (settings.pitch !== 0) {
    const factor = Math.pow(2, settings.pitch / 12);
    parts.push(
      `asetrate=48000*${factor.toFixed(6)}`,
      "aresample=48000",
      `atempo=${(1 / factor).toFixed(6)}`
    );
  }

  if (settings.volume !== 100) {
    parts.push(`volume=${(settings.volume / 100).toFixed(3)}`);
  }

  if (parts.length === 0) return null;
  return parts.join(",");
}

/** Aplica retalls (ja al blob), velocitat, pitch i volum per exportar. */
export async function applyEditorSettingsToBlob(
  sourceBlob: Blob,
  settings: EditorSettings,
  onProgress?: (message: string) => void
): Promise<Blob> {
  const filter = buildEditorAudioFilter(settings);
  const wavBlob = await prepareFfmpegInputBlob(sourceBlob);

  if (!filter) return wavBlob;

  onProgress?.("Aplicant edició (velocitat, to, volum)…");
  const ffmpeg = await getFFmpeg();
  const inputName = "edit-in.wav";
  const outputName = "edit-out.wav";

  await ffmpeg.writeFile(inputName, await fetchFile(wavBlob));

  try {
    await ffmpeg.exec(["-i", inputName, "-af", filter, outputName]);
  } catch (error) {
    const log = getLastFfmpegLog();
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      log
        ? `No s'ha pogut aplicar l'edició: ${detail}\n${log}`
        : `No s'ha pogut aplicar l'edició: ${detail}`
    );
  }

  const data = await ffmpeg.readFile(outputName);
  const bytes =
    data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
  return new Blob([Uint8Array.from(bytes)], { type: "audio/wav" });
}
