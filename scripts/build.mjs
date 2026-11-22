import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

// Windows sandboxes occasionally deny deleting esbuild's temp files in %TEMP%.
// Keeping esbuild's scratch files inside the project makes the build reproducible.
const tempDir = resolve(".esbuild-tmp");
mkdirSync(tempDir, { recursive: true });
process.env.TEMP = tempDir;
process.env.TMP = tempDir;

const tsc = spawnSync(process.execPath, [resolve("node_modules/typescript/bin/tsc"), "--noEmit"], {
  stdio: "inherit",
});
if (tsc.status !== 0) process.exit(tsc.status ?? 1);

const { build } = await import("vite");
await build();
