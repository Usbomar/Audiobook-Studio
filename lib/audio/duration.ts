export const MIN_RECORDING_DURATION_SECONDS = 1;

function isValidDuration(seconds: number): boolean {
  return Number.isFinite(seconds) && seconds > 0 && seconds !== Infinity;
}

async function getDurationViaAudioContext(blob: Blob): Promise<number> {
  const arrayBuffer = await blob.arrayBuffer();
  const context = new AudioContext();
  try {
    const audioBuffer = await context.decodeAudioData(arrayBuffer.slice(0));
    return audioBuffer.duration;
  } finally {
    await context.close();
  }
}

function getDurationViaAudioElement(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.preload = "auto";

    let settled = false;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      audio.src = "";
    };

    const finish = (duration: number) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(duration);
    };

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };

    const tryResolve = () => {
      if (isValidDuration(audio.duration)) {
        finish(audio.duration);
      }
    };

    audio.addEventListener("loadedmetadata", tryResolve);
    audio.addEventListener("durationchange", tryResolve);
    audio.addEventListener("canplaythrough", tryResolve);

    audio.addEventListener("error", () => {
      fail("No s'ha pogut llegir l'àudio gravat");
    });

    audio.addEventListener("ended", tryResolve);

    audio.src = url;
    audio.load();

    // Força el càlcul de durada en WebM/Opus sense metadades completes
    audio.addEventListener(
      "loadedmetadata",
      () => {
        if (!isValidDuration(audio.duration)) {
          try {
            audio.currentTime = Number.MAX_SAFE_INTEGER;
          } catch {
            /* alguns navegadors limiten el seek */
          }
        }
      },
      { once: true }
    );

    window.setTimeout(() => {
      if (!settled) fail("Temps d'espera esgotat en llegir la durada");
    }, 8000);
  });
}

/**
 * Obté la durada en segons d'un blob d'àudio.
 * `fallbackSeconds` s'utilitza quan les metadades del fitxer no són fiables (p. ex. WebM).
 */
export async function getAudioDurationFromBlob(
  blob: Blob,
  fallbackSeconds?: number
): Promise<number> {
  const attempts: Array<() => Promise<number>> = [
    () => getDurationViaAudioContext(blob),
    () => getDurationViaAudioElement(blob),
  ];

  for (const attempt of attempts) {
    try {
      const duration = await attempt();
      if (isValidDuration(duration)) return duration;
    } catch {
      /* següent mètode */
    }
  }

  if (
    fallbackSeconds !== undefined &&
    isValidDuration(fallbackSeconds)
  ) {
    return fallbackSeconds;
  }

  throw new Error("No s'ha pogut determinar la durada de l'àudio.");
}

/** Converteix segons reals a enter per emmagatzemar (mínim 1 s). */
export function toStoredDurationSeconds(seconds: number): number {
  if (!isValidDuration(seconds)) {
    throw new Error("Durada d'àudio no vàlida");
  }
  if (seconds < MIN_RECORDING_DURATION_SECONDS) {
    throw new Error(
      `La gravació ha de durar almenys ${MIN_RECORDING_DURATION_SECONDS} segon.`
    );
  }
  return Math.max(MIN_RECORDING_DURATION_SECONDS, Math.round(seconds));
}
