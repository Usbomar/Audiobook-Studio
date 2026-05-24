const PREFERRED_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

export function getSupportedRecordingMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const type of PREFERRED_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}
