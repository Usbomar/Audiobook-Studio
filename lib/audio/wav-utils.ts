export async function decodeBlobToMonoSamples(
  blob: Blob
): Promise<{ samples: Float32Array; sampleRate: number }> {
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData((await blob.arrayBuffer()).slice(0));
    return {
      samples: decoded.getChannelData(0),
      sampleRate: decoded.sampleRate,
    };
  } finally {
    await ctx.close();
  }
}

export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
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

export function timeRangeToSampleRange(
  startSec: number,
  endSec: number,
  sampleRate: number
): { start: number; end: number } {
  const start = Math.max(0, Math.floor(startSec * sampleRate));
  const end = Math.max(start, Math.floor(endSec * sampleRate));
  return { start, end };
}

export function extractSampleRange(
  samples: Float32Array,
  start: number,
  end: number
): Float32Array {
  return samples.slice(start, end);
}

export function deleteSampleRange(
  samples: Float32Array,
  start: number,
  end: number
): Float32Array {
  const result = new Float32Array(samples.length - (end - start));
  result.set(samples.subarray(0, start), 0);
  result.set(samples.subarray(end), start);
  return result;
}

export function insertSamplesAt(
  samples: Float32Array,
  index: number,
  insert: Float32Array
): Float32Array {
  const i = Math.max(0, Math.min(index, samples.length));
  const result = new Float32Array(samples.length + insert.length);
  result.set(samples.subarray(0, i), 0);
  result.set(insert, i);
  result.set(samples.subarray(i), i + insert.length);
  return result;
}
