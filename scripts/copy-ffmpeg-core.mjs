import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "node_modules", "@ffmpeg", "core", "dist", "umd");
const destDir = join(root, "public", "ffmpeg");

await mkdir(destDir, { recursive: true });
await copyFile(join(srcDir, "ffmpeg-core.js"), join(destDir, "ffmpeg-core.js"));
await copyFile(
  join(srcDir, "ffmpeg-core.wasm"),
  join(destDir, "ffmpeg-core.wasm")
);
console.log("ffmpeg-core copiat a public/ffmpeg");
