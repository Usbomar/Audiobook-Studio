declare module "soundtouchjs" {
  export class PitchShifter {
    constructor(
      context: AudioContext,
      buffer: AudioBuffer,
      bufferSize: number,
      onEnd?: () => void
    );
    tempo: number;
    pitch: number;
    pitchSemitones: number;
    rate: number;
    duration: number;
    sampleRate: number;
    timePlayed: number;
    percentagePlayed: number;
    connect(toNode: AudioNode): void;
    disconnect(): void;
    on(
      eventName: string,
      cb: (detail: {
        timePlayed: number;
        formattedTimePlayed: string;
        percentagePlayed: number;
      }) => void
    ): void;
    off(eventName?: string | null): void;
  }
}
