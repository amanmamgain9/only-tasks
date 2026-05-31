import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "../..");
const framesPattern = path.join(scriptDir, "frames", "frame_%05d.jpg");
const outputPath = process.argv[2]
  ? path.resolve(projectRoot, process.argv[2])
  : path.join(projectRoot, "public", "media", "plan-my-workday", "demo.mp4");
const posterPath = path.join(path.dirname(outputPath), "demo-poster.jpg");

await mkdir(path.dirname(outputPath), { recursive: true });

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code ?? 1}`));
    });
  });
}

await run("ffmpeg", [
  "-y",
  "-framerate",
  "15",
  "-i",
  framesPattern,
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  "-crf",
  "21",
  outputPath,
]);

await run("ffmpeg", [
  "-y",
  "-i",
  outputPath,
  "-ss",
  "00:00:03",
  "-frames:v",
  "1",
  posterPath,
]);

console.log(`Wrote ${path.relative(projectRoot, outputPath)}`);
console.log(`Wrote ${path.relative(projectRoot, posterPath)}`);
