import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { findBrowser } from "./find-browser.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "http://127.0.0.1:4173";
const args = new Set(process.argv.slice(2));
const FAST = args.has("--fast") || !args.has("--capture");
const CAPTURE = args.has("--capture");
const EVIDENCE_DIR = process.env.EVIDENCE_DIR ? resolve(ROOT, process.env.EVIDENCE_DIR) : ROOT;
const SCREENS = resolve(EVIDENCE_DIR, "docs", "screens");

function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function ensurePortFree(port) {
  await new Promise((resolveProbe, rejectProbe) => {
    const probe = createServer();
    probe.once("error", (error) => rejectProbe(new Error("预览端口 " + port + " 已被占用：" + error.code)));
    probe.once("listening", () => probe.close(() => resolveProbe()));
    probe.listen(port, "127.0.0.1");
  });
}

async function waitForServer() {
  for (let index = 0; index < 150; index += 1) {
    try {
      const response = await fetch(BASE);
      if (response.ok) return;
    } catch {
      // server not up yet
    }
    await wait(200);
  }
  throw new Error("预览服务器未在 30 秒内启动：" + BASE);
}

async function textOf(page, selector) {
  return (await page.locator(selector).first().innerText()).trim();
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(label + "：期望 " + JSON.stringify(expected) + "，实际 " + JSON.stringify(actual));
  }
}

async function main() {
  if (!existsSync(resolve(ROOT, "dist", "index.html"))) {
    throw new Error("dist/index.html 不存在，请先运行 pnpm build");
  }
  if (CAPTURE) mkdirSync(SCREENS, { recursive: true });
  await ensurePortFree(4173);

  const server = spawn(
    process.execPath,
    [resolve(ROOT, "node_modules", "vite", "bin", "vite.js"), "preview", "--host", "127.0.0.1", "--port", "4173", "--strictPort"],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, BROWSER: "none" } },
  );
  let serverError = "";
  server.stdout.on("data", (chunk) => process.stdout.write(String(chunk)));
  server.stderr.on("data", (chunk) => {
    const text = String(chunk);
    process.stderr.write(text);
    if (/EADDRINUSE|already in use/i.test(text)) serverError = text.trim();
  });

  let browser;
  try {
    await waitForServer();
    await wait(500);
    if (serverError) {
      throw new Error("预览服务器启动失败：" + serverError);
    }
    if (server.exitCode !== null) {
      throw new Error("预览服务器启动失败，退出码 " + server.exitCode + "（常见原因：4173 端口被占用）");
    }
    browser = await chromium.launch({ executablePath: findBrowser(), headless: true });

    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    if (FAST) await page.clock.install({ time: new Date("2026-11-22T14:00:00+08:00") });
    await page.goto(BASE + "/academy/sessions/sess-2078/roster", { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="stat-registered"] strong');

    // AC1: every stat card equals the independent hand calculation.
    assertEqual(await textOf(page, '[data-testid="stat-registered"] strong'), "128", "报名数");
    assertEqual(await textOf(page, '[data-testid="stat-waitlist"] strong'), "12", "候补数");
    assertEqual(await textOf(page, '[data-testid="stat-pending"] strong'), "7", "待审核数");
    assertEqual(await textOf(page, '[data-testid="stat-checked-in"] strong'), "96", "签到数");
    assertEqual(await textOf(page, '[data-testid="stat-attendance"] strong'), "75.0%", "出勤率");
    assertEqual(await textOf(page, '[data-testid="stat-non-member"] strong'), "23", "非会员数");
    assertEqual(String(await page.locator('tbody tr[data-testid^="row-"]').count()), "128", "表格行数");
    assertEqual(await textOf(page, '[data-testid="mobile-value-r020"]'), "*******1234", "默认手机号脱敏");

    if (CAPTURE) {
      await page.screenshot({ path: resolve(SCREENS, "roster-stats.png"), fullPage: true });
    }

    // AC2 permission split: the read-only auditor has no reveal, batch or correction power.
    await page.locator('select[aria-label="演示身份"]').selectOption("supervisor");
    await page.locator('[data-testid="learning-open-r020"] button').click();
    await page.waitForSelector('[data-testid="learning-drawer"]');
    await page.locator('select[aria-label="演示身份"]').selectOption("auditor");
    assertEqual(String(await page.locator('[data-testid="learning-drawer"]').count()), "0", "切换只读审计员后更正抽屉应关闭");
    assertEqual(
      String(await page.locator('tbody button[data-testid^="mobile-reveal-"]').count()),
      "0",
      "只读审计员的查看按钮数",
    );
    assertEqual(
      String(await page.locator('tbody input[type="checkbox"]:not([disabled])').count()),
      "0",
      "只读审计员可勾选的行数",
    );
    assertEqual(
      String(((await page.locator('[data-testid="batch-open-wrap"] .t-button').getAttribute("class")) ?? "").includes("t-is-disabled")),
      "true",
      "只读审计员批量补录按钮禁用",
    );
    assertEqual(await textOf(page, '[data-testid="mobile-value-r020"]'), "*******1234", "只读审计员手机号仍脱敏");
    if (CAPTURE) {
      await page.screenshot({ path: resolve(SCREENS, "mobile-no-permission.png"), fullPage: true });
    }
    await page.locator('select[aria-label="演示身份"]').selectOption("manager");

    // AC2: reveal shows the full number, then the 30-second window expires and masks again.
    await page.locator('[data-testid="mobile-reveal-r020"]').click();
    await page.waitForFunction(
      () => document.querySelector('[data-testid="mobile-value-r020"]')?.textContent?.includes("13800001234"),
    );
    assertEqual(await textOf(page, '[data-testid="mobile-value-r020"]'), "13800001234", "查看后手机号");
    if (CAPTURE) {
      await page.screenshot({ path: resolve(SCREENS, "reveal-mobile-before.png") });
      await page.waitForTimeout(3500);
    }
    if (FAST) {
      await page.clock.fastForward(31_000);
      await page.waitForTimeout(800);
      assertEqual(await textOf(page, '[data-testid="mobile-value-r020"]'), "*******1234", "30 秒后手机号");
      if (CAPTURE) {
        await page.screenshot({ path: resolve(SCREENS, "reveal-mobile-after.png") });
      }
    }

    // AC3: empty note cannot submit; the mock batch endpoint is not called.
    const r001TimeBefore = await textOf(page, '[data-testid="row-r001"] td:nth-child(8)');
    const r001HoursBefore = await textOf(page, '[data-testid="row-r001"] td:nth-child(9)');
    const selectable = page.locator('tbody input[type="checkbox"]:not([disabled])');
    const selectedIds = await selectable.evaluateAll((nodes) =>
      nodes.slice(0, 2).map((node) => (node.closest("tr")?.getAttribute("data-testid") ?? "").replace("row-", "")),
    );
    assertEqual(String(selectedIds.length), "2", "可补录行数");
    await selectable.nth(0).check();
    await selectable.nth(1).check();
    assertEqual(await textOf(page, '[data-testid="selected-count"]'), "已选 2 人", "勾选人数");
    await page.locator('[data-testid="batch-open-wrap"] .t-button').click();
    await page.waitForSelector('[data-testid="batch-submit"]');
    await page.locator('[data-testid="batch-submit"]').click();
    await page.waitForSelector('[data-testid="batch-error"]');
    const batchError = await textOf(page, '[data-testid="batch-error"]');
    if (!batchError.includes("说明")) throw new Error("空说明错误提示不明确：" + batchError);
    assertEqual(await textOf(page, '[data-testid="mock-batch-count"]'), "0", "空说明时 mock 批量请求数");
    assertEqual(await textOf(page, '[data-testid="batch-dialog-count"]'), "mock 批量补录请求：0", "弹窗内 mock 批量请求数");
    if (CAPTURE) {
      await page.screenshot({ path: resolve(SCREENS, "batch-attendance.png") });
    }

    // The valid path submits once and clears the selection.
    await page.locator('[data-testid="batch-note"]').fill("现场签到，助教补录");
    await page.locator('[data-testid="batch-submit"]').click();
    await page.waitForSelector('[data-testid="batch-submit"]', { state: "hidden" });
    assertEqual(await textOf(page, '[data-testid="mock-batch-count"]'), "1", "有效提交后 mock 批量请求数");
    assertEqual(await textOf(page, '[data-testid="selected-count"]'), "已选 0 人", "提交后勾选人数");
    assertEqual(await textOf(page, '[data-testid="stat-checked-in"] strong'), "98", "补录后签到数");
    assertEqual(await textOf(page, '[data-testid="stat-attendance"] strong'), "76.6%", "补录后出勤率");
    assertEqual(
      await textOf(page, '[data-testid="row-r001"] td:nth-child(8)'),
      r001TimeBefore,
      "已签到 r001 的签到时间保持不变",
    );
    assertEqual(
      await textOf(page, '[data-testid="row-r001"] td:nth-child(9)'),
      r001HoursBefore,
      "已签到 r001 的学时保持不变",
    );
    for (const id of selectedIds) {
      assertEqual(
        String((await textOf(page, '[data-testid="row-' + id + '"] td:nth-child(8)')).includes("—")),
        "false",
        "补录行 " + id + " 的签到时间已写入",
      );
      assertEqual(
        String((await textOf(page, '[data-testid="row-' + id + '"] td:nth-child(9)')).includes("2 学时")),
        "true",
        "补录行 " + id + " 的学时已写入",
      );
    }
    if (CAPTURE) {
      await page.screenshot({ path: resolve(SCREENS, "batch-attendance-success.png") });
    }

    if (errors.length > 0) throw new Error("浏览器控制台错误：\n" + errors.join("\n"));
    console.log(JSON.stringify({
      ok: true,
      mode: FAST ? "fast-clock" : "real-time",
      checks: [
        "AC1 六卡与 128 行一致",
        "AC2 只读审计员不渲染查看按钮、不可勾选/批量补录、切换后更正抽屉关闭且手机号保持脱敏",
        "AC2 查看后显示完整手机号",
        FAST ? "AC2 30 秒窗口到期后恢复脱敏（假时钟）" : "AC2 查看手机号（点击后完整号码；30 秒恢复由 --fast 与 capture 验证）",
        "AC3 空说明被拒绝且 mock 请求数为 0",
        "有效补录请求数为 1，签到数 96→98，已签到 r001 时间/学时不变",
      ],
      screenshots: CAPTURE ? ["docs/screens/roster-stats.png", "docs/screens/mobile-no-permission.png", "docs/screens/batch-attendance.png"] : [],
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
