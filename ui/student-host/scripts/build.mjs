import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const dist = resolve(root, "dist");
const staticDir = resolve(root, "static");
const localTsc = resolve(root, "..", "..", "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(staticDir, dist, { recursive: true });

if (!existsSync(localTsc)) {
  console.warn("[host-ui] TypeScript compiler not installed; kept checked-in dist assets.");
  process.exit(0);
}

const result = spawnSync(localTsc, ["-p", resolve(root, "tsconfig.json")], {
  cwd: resolve(root, "..", ".."),
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.status !== 0) {
  if (result.error) {
    console.error(result.error.message);
  }
  process.exit(result.status ?? 1);
}
