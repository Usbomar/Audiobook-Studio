import { createRNNWasmModule } from "@jitsi/rnnoise-wasm";

const RNNOISE_FRAME_SIZE = 480;
const RNNOISE_SCALE = 32768;

type RnnoiseModule = {
  HEAPF32: Float32Array;
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
  _rnnoise_create: () => number;
  _rnnoise_destroy: (ctx: number) => void;
  _rnnoise_process_frame: (ctx: number, input: number, output: number) => number;
};

function encodeWavFromFloat32(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  let offset = 0;
  const writeString = (value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset++, value.charCodeAt(i));
    }
  };

  writeString("RIFF");
  view.setUint32(offset, 36 + dataSize, true);
  offset += 4;
  writeString("WAVE");
  writeString("fmt ");
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, byteRate, true);
  offset += 4;
  view.setUint16(offset, blockAlign, true);
  offset += 2;
  view.setUint16(offset, 16, true);
  offset += 2;
  writeString("data");
  view.setUint32(offset, dataSize, true);
  offset += 4;

  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(
      offset,
      sample < 0 ? sample * 0x8000 : sample * 0x7fff,
      true
    );
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

async function decodeToMono(blob: Blob): Promise<{
  sampleRate: number;
  samples: Float32Array;
}> {
  const ctx = new AudioContext();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const firstChannel = audioBuffer.getChannelData(0);
    return {
      sampleRate: audioBuffer.sampleRate,
      samples: new Float32Array(firstChannel),
    };
  } finally {
    await ctx.close();
  }
}

async function runRnnoise(samples: Float32Array): Promise<Float32Array> {
  const wasm = (await createRNNWasmModule()) as unknown as RnnoiseModule;
  const ctx = wasm._rnnoise_create();
  const ptr = wasm._malloc(RNNOISE_FRAME_SIZE * 4);
  const ptrF32 = ptr >> 2;
  const output = new Float32Array(samples.length);

  try {
    for (let i = 0; i < samples.length; i += RNNOISE_FRAME_SIZE) {
      const frame = output.subarray(i, i + RNNOISE_FRAME_SIZE);
      for (let j = 0; j < RNNOISE_FRAME_SIZE; j++) {
        const sourceIndex = i + j;
        const value = sourceIndex < samples.length ? samples[sourceIndex] : 0;
        wasm.HEAPF32[ptrF32 + j] = value * RNNOISE_SCALE;
      }

      wasm._rnnoise_process_frame(ctx, ptr, ptr);

      for (let j = 0; j < frame.length; j++) {
        frame[j] = wasm.HEAPF32[ptrF32 + j] / RNNOISE_SCALE;
      }
    }

    return output;
  } finally {
    wasm._free(ptr);
    wasm._rnnoise_destroy(ctx);
  }
}

export async function reduceNoiseWithRnnoise(blob: Blob): Promise<Blob> {
  const { sampleRate, samples } = await decodeToMono(blob);
  const denoised = await runRnnoise(samples);
  return encodeWavFromFloat32(denoised, sampleRate);
}

