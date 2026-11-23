import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { findBrowser } from "./find-browser.mjs";
import { probeWebm } from "./probe-webm.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "http://127.0.0.1:4173";
const EVIDENCE_DIR = process.env.EVIDENCE_DIR ? resolve(ROOT, process.env.EVIDENCE_DIR) : ROOT;
const SCREENS = resolve(EVIDENCE_DIR, "docs", "screens");
const OUT = resolve(SCREENS, "reveal-mobile.webm");
const displayPath = (path) => relative(ROOT, path).replaceAll("\\", "/");

function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function waitForServer() {
  for (let index = 0; index < 150; index += 1) {
    try {
      const response = await fetch(BASE);
      if (response.ok) return;
    } catch {
      // server not ready
    }
    await wait(200);
  }
  throw new Error("预览服务器未在 30 秒内启动：" + BASE);
}

async function main() {
  if (!existsSync(resolve(ROOT, "dist", "index.html"))) throw new Error("dist/index.html 不存在，请先运行 pnpm build");
  mkdirSync(SCREENS, { recursive: true });
  const server = spawn(
    process.execPath,
    [resolve(ROOT, "node_modules", "vite", "bin", "vite.js"), "preview", "--host", "127.0.0.1", "--port", "4173", "--strictPort"],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, BROWSER: "none" } },
  );
  server.stdout.on("data", (chunk) => process.stdout.write(String(chunk)));
  server.stderr.on("data", (chunk) => process.stderr.write(String(chunk)));

  let browser;
  try {
    await waitForServer();
    browser = await chromium.launch({ executablePath: findBrowser(), headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on("pageerror", (error) => console.error("pageerror:", error.message));
    await page.goto(BASE + "/academy/sessions/sess-2078/roster", { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="stat-registered"] strong');

    await page.locator('[data-testid="row-r020"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: resolve(SCREENS, "reveal-mobile-poster.png") });

    const supported = await page.evaluate(() => {
      const types = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
      return types.filter((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type));
    });
    if (supported.length === 0) throw new Error("当前浏览器不支持 MediaRecorder WebM 录屏");
    const mimeType = supported[0];

    await page.evaluate((type) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 800;
      const ctx = canvas.getContext("2d");
      const stream = canvas.captureStream(1);
      const recorder = new MediaRecorder(stream, { mimeType: type });
      const chunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.start(1000);
      window.__screenRecorder = { canvas, ctx, recorder, chunks };
    }, mimeType);

    async function drawFrame() {
      const buffer = await page.screenshot({ type: "png" });
      const dataUrl = "data:image/png;base64," + buffer.toString("base64");
      await page.evaluate(async (url) => {
        const state = window.__screenRecorder;
        const image = new Image();
        image.src = url;
        await image.decode();
        state.ctx.drawImage(image, 0, 0, state.canvas.width, state.canvas.height);
      }, dataUrl);
    }

    await drawFrame();
    await page.locator('[data-testid="row-r020"] button.link-button').click();
    await page.waitForFunction(
      () => document.querySelector('[data-testid="mobile-value-r020"]')?.textContent?.includes("13800001234"),
    );
    await drawFrame();

    const started = Date.now();
    for (let second = 1; second <= 32; second += 1) {
      await wait(1000);
      await drawFrame();
      if (second % 5 === 0) console.log("recorded " + second + "s");
    }
    const elapsed = Math.round((Date.now() - started) / 1000);
    const masked = await page.locator('[data-testid="mobile-value-r020"]').innerText();
    if (!masked.includes("*******1234")) throw new Error("录屏结束时手机号没有恢复脱敏：" + masked);
    await page.screenshot({ path: resolve(SCREENS, "reveal-mobile-after.png") });

    const base64 = await page.evaluate(async () => {
      const state = window.__screenRecorder;
      const stopped = new Promise((resolveStop) => {
        state.recorder.onstop = resolveStop;
      });
      state.recorder.stop();
      await stopped;
      const blob = new Blob(state.chunks, { type: state.recorder.mimeType });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
      return window.btoa(binary);
    });
    const video = Buffer.from(base64, "base64");
    writeFileSync(OUT, video);
    const header = video.subarray(0, 4).toString("hex");
    if (header !== "1a45dfa3") throw new Error("输出不是 WebM 文件：" + header);
    const probe = probeWebm(video);
    if (probe.frames < 1) throw new Error("录屏没有视频帧：" + JSON.stringify(probe));
    if (probe.durationMs < 30000) throw new Error("录屏未覆盖 30 秒窗口：" + JSON.stringify(probe));
    console.log(JSON.stringify({
      ok: true,
      file: displayPath(OUT),
      mimeType,
      bytes: video.length,
      elapsedSeconds: elapsed,
      video: probe,
      finalMobile: masked,
    }, null, 2));
    await context.close();
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    server.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
