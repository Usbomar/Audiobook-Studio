import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;
let lastLog = "";

const CORE_BASE = "/ffmpeg";

export function getLastFfmpegLog(): string {
  return lastLog;
}

export function isFfmpegEnvironmentReady(): boolean {
  return typeof window !== "undefined" && window.crossOriginIsolated === true;
}

export async function getFFmpeg(
  onLog?: (message: string) => void
): Promise<FFmpeg> {
  if (!isFfmpegEnvironmentReady()) {
    throw new Error(
      "El navegador no té activat crossOriginIsolated. Recarrega l'app (calen els headers COOP/COEP). Prova en http://localhost:3000."
    );
  }

  if (ffmpegInstance) return ffmpegInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    ffmpeg.on("log", ({ message }) => {
      lastLog = message;
      onLog?.(message);
    });

    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(
          `${CORE_BASE}/ffmpeg-core.js`,
          "text/javascript"
        ),
        wasmURL: await toBlobURL(
          `${CORE_BASE}/ffmpeg-core.wasm`,
          "application/wasm"
        ),
      });
    } catch (error) {
      loadPromise = null;
      const detail =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `No s'ha pogut carregar ffmpeg.wasm: ${detail}. ${lastLog}`.trim()
      );
    }

    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return loadPromise;
}

export function resetFFmpegForTests(): void {
  ffmpegInstance = null;
  loadPromise = null;
  lastLog = "";
}
