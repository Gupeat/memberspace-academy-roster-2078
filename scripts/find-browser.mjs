import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

function existing(paths) {
  for (const candidate of paths) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return "";
}

function fromPath(names) {
  const locator = process.platform === "win32" ? "where.exe" : "which";
  for (const name of names) {
    try {
      const output = execFileSync(locator, [name], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const hit = output.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
      if (hit && existsSync(hit)) return hit;
    } catch {
      // not on PATH
    }
  }
  return "";
}

function installPaths() {
  if (process.platform !== "win32") return [];
  const roots = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"], process.env.ProgramW6432, process.env.LOCALAPPDATA]
    .filter(Boolean);
  const paths = [];
  for (const root of roots) {
    paths.push(join(root, "Microsoft", "Edge", "Application", "msedge.exe"));
    paths.push(join(root, "Google", "Chrome", "Application", "chrome.exe"));
  }
  return paths;
}

export function findBrowser() {
  const found = existing([
    process.env.EDGE_PATH,
    process.env.CHROME_PATH,
    ...installPaths(),
  ]) || fromPath(
    process.platform === "win32"
      ? ["msedge", "chrome"]
      : ["msedge", "google-chrome", "chromium", "chromium-browser"],
  );
  if (found) return found;
  throw new Error("找不到 Edge/Chrome。请设置 EDGE_PATH 或 CHROME_PATH，或把浏览器加入 PATH。");
}
