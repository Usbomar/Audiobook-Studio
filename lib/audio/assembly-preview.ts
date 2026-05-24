export type AssemblyGapSeconds = 0 | 0.5 | 1;

export interface AssemblyPreviewOptions {
  blobs: Blob[];
  gapSeconds: AssemblyGapSeconds;
  introSeconds: number;
  outroSeconds: number;
  onEnded?: () => void;
}

export class AssemblyPreviewPlayer {
  private context: AudioContext | null = null;
  private sources: AudioBufferSourceNode[] = [];
  private endTimer: ReturnType<typeof setTimeout> | null = null;

  async play(options: AssemblyPreviewOptions): Promise<void> {
    this.stop();

    if (options.blobs.length === 0) return;

    const ctx = new AudioContext();
    this.context = ctx;

    const buffers = await Promise.all(
      options.blobs.map(async (blob) => {
        const arrayBuffer = await blob.arrayBuffer();
        return ctx.decodeAudioData(arrayBuffer.slice(0));
      })
    );

    let cursor = options.introSeconds;

    for (let i = 0; i < buffers.length; i++) {
      const source = ctx.createBufferSource();
      source.buffer = buffers[i];
      source.connect(ctx.destination);
      source.start(cursor);
      this.sources.push(source);
      cursor += buffers[i].duration;
      if (i < buffers.length - 1) {
        cursor += options.gapSeconds;
      }
    }

    const totalSeconds = cursor + options.outroSeconds;
    this.endTimer = setTimeout(() => {
      this.stop();
      options.onEnded?.();
    }, totalSeconds * 1000);
  }

  stop(): void {
    if (this.endTimer) {
      clearTimeout(this.endTimer);
      this.endTimer = null;
    }

    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        /* ja aturat */
      }
    }
    this.sources = [];

    if (this.context) {
      void this.context.close();
      this.context = null;
    }
  }
}

export function calculateAssemblyDurationSeconds(
  blockDurations: number[],
  gapSeconds: number,
  introSeconds: number,
  outroSeconds: number
): number {
  if (blockDurations.length === 0) return introSeconds + outroSeconds;
  const gaps = Math.max(0, blockDurations.length - 1) * gapSeconds;
  const content = blockDurations.reduce((sum, value) => sum + value, 0);
  return introSeconds + content + gaps + outroSeconds;
}
