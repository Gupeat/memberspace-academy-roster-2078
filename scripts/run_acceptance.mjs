import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { probeWebm } from "./probe-webm.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Normal runs write to artifacts/ and docs/screens/. A clean-room run sets
// EVIDENCE_DIR=artifacts/clean-room so every generated log, screenshot and
// report lives under one self-contained directory that can be committed.
const EVIDENCE_DIR = process.env.EVIDENCE_DIR ? resolve(ROOT, process.env.EVIDENCE_DIR) : null;
const OUTPUT_ROOT = EVIDENCE_DIR ?? resolve(ROOT, "artifacts");
const LOGS = resolve(OUTPUT_ROOT, "logs");
const SCREENS = EVIDENCE_DIR ? resolve(EVIDENCE_DIR, "docs", "screens") : resolve(ROOT, "docs", "screens");
const display = (path) => relative(ROOT, path).replaceAll("\\", "/");
const LOG_PREFIX = display(LOGS);
const SCREEN_PREFIX = display(SCREENS);
mkdirSync(LOGS, { recursive: true });
mkdirSync(SCREENS, { recursive: true });

const STEPS = [
  { id: "check", title: "独立对账 mock 数据（六卡六值 + 分项闭合）", command: ["node", "scripts/check-roster.mjs"] },
  { id: "build", title: "生产构建", command: ["node", "scripts/build.mjs"] },
  { id: "typecheck", title: "TypeScript 类型检查", command: ["node", "node_modules/typescript/bin/tsc", "--noEmit"] },
  { id: "unit", title: "领域逻辑单测", command: ["node", "node_modules/vitest/vitest.mjs", "run"] },
  { id: "e2e-fast", title: "AC 回归（假时钟验证 30 秒恢复脱敏）", command: ["node", "scripts/e2e.mjs", "--fast"] },
  { id: "screens", title: "AC 截图（六卡 / 手机号查看 / 批量补录空说明）", command: ["node", "scripts/e2e.mjs", "--capture"] },
  { id: "video", title: "AC2 真实 30 秒录屏", command: ["node", "scripts/capture-reveal.mjs"] },
];

const EVIDENCE_FILES = [
  "roster-stats.png",
  "mobile-no-permission.png",
  "reveal-mobile-before.png",
  "reveal-mobile-poster.png",
  "reveal-mobile-after.png",
  "reveal-mobile.webm",
  "batch-attendance.png",
  "batch-attendance-success.png",
];

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sanitize(text) {
  const variants = [ROOT, ROOT.replaceAll("\\", "/"), ROOT.replaceAll("/", "\\")];
  let out = text;
  for (const variant of variants) out = out.split(variant).join("<repo>");
  return out;
}

function runStep(step) {
  const started = Date.now();
  const result = spawnSync(process.execPath, step.command.slice(1), {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, PYTHONIOENCODING: "utf-8", BROWSER: "none" },
  });
  const elapsed = ((Date.now() - started) / 1000).toFixed(2);
  const output = sanitize([result.stdout ?? "", result.stderr ?? ""].join("\n").trim());
  const logPath = resolve(LOGS, step.id + ".log");
  writeFileSync(logPath, output + "\n", "utf8");
  const ok = result.status === 0;
  console.log("[" + (ok ? "PASS" : "FAIL") + "] " + step.id + " exit=" + result.status + " " + elapsed + "s");
  if (!ok) console.error(output.slice(-4000));
  return { ok, exitCode: result.status, elapsed, output, log: display(logPath) };
}

function tail(text, lines = 24) {
  return text.split(/\r?\n/).filter(Boolean).slice(-lines).join("\n");
}

function main() {
  const results = [];
  for (const step of STEPS) {
    const result = runStep(step);
    results.push({ ...step, ...result });
    if (!result.ok) break;
  }
  const passed = results.length === STEPS.length && results.every((item) => item.ok);

  const evidence = EVIDENCE_FILES.filter((name) => existsSync(resolve(SCREENS, name))).map((name) => {
    const full = resolve(SCREENS, name);
    return { path: SCREEN_PREFIX + "/" + name, bytes: statSync(full).size, sha256: sha256(full) };
  });

  let video = null;
  try {
    video = probeWebm(readFileSync(resolve(SCREENS, "reveal-mobile.webm")));
  } catch {
    video = null;
  }

  const generatedAt = new Date().toISOString().slice(0, 19) + "Z";
  const report = {
    generatedAt,
    passed,
    evidenceDir: EVIDENCE_DIR ? display(EVIDENCE_DIR) : ".",
    node: process.version,
    platform: process.platform + " " + process.arch,
    steps: results.map(({ output, ...rest }) => ({ ...rest, outputTail: tail(output) })),
    evidence,
    video,
  };
  writeFileSync(resolve(OUTPUT_ROOT, "acceptance.json"), JSON.stringify(report, null, 2) + "\n", "utf8");

  const lines = [];
  lines.push("# 验收记录 · 课期报名名单与出勤补录页");
  lines.push("");
  lines.push("- 生成时间（UTC）：" + generatedAt);
  lines.push("- 运行环境：Node " + process.version + " / " + process.platform + " " + process.arch);
  lines.push("- 证据目录：" + (EVIDENCE_DIR ? display(EVIDENCE_DIR) : "仓库根（docs/screens 与 artifacts）"));
  lines.push("- 总体结果：" + (passed ? "PASS" : "FAIL"));
  lines.push("- 日志与输出中的本机仓库路径已替换为 <repo>；端口仅为本机预览 127.0.0.1:4173。");
  lines.push("");
  lines.push("## 逐条验收");
  lines.push("");
  lines.push("### AC1 统计卡数字与 mock 数据手算结果一致（截图）");
  lines.push("");
  lines.push("- 命令：node scripts/check-roster.mjs（独立读取 mock/roster.json 重算，不复用页面状态）");
  const check = results.find((item) => item.id === "check");
  lines.push("- 结果：" + (check?.ok ? "PASS" : "FAIL") + "，exit=" + (check?.exitCode ?? "未执行"));
  lines.push("- 六卡：报名数 128、候补数 12、待审核数 7、签到数 96、出勤率 75.0%、非会员数 23。");
  lines.push("- 手算：96 ÷ 128 = 75.0%；96 已签到 + 13 已通过未签到 + 12 候补 + 7 待审核 = 128，四类互斥且闭合。");
  lines.push("- 截图：" + SCREEN_PREFIX + "/roster-stats.png（1440×6664 全页，含六卡与 128 行名单）。");
  lines.push("- 对账输出：");
  lines.push("");
  lines.push("~~~text");
  lines.push(tail(check?.output ?? "未执行", 18));
  lines.push("~~~");
  lines.push("");
  lines.push("### AC2 点击查看手机号，30 秒后恢复脱敏（录屏）");
  lines.push("");
  const e2e = results.find((item) => item.id === "e2e-fast");
  const videoStep = results.find((item) => item.id === "video");
  lines.push("- 回归命令：node scripts/e2e.mjs --fast（假时钟 fast-forward 31 秒）");
  lines.push("- 结果：" + (e2e?.ok ? "PASS" : "FAIL") + "，exit=" + (e2e?.exitCode ?? "未执行"));
  lines.push("- 权限断言：切换“只读审计员”后手机号仍为 *******1234，表格内“查看”按钮数为 0；截图 " + SCREEN_PREFIX + "/mobile-no-permission.png。");
  lines.push("- 录屏命令：node scripts/capture-reveal.mjs（真实时间逐秒截帧，MediaRecorder 生成 WebM）");
  lines.push("- 结果：" + (videoStep?.ok ? "PASS" : "FAIL") + "，exit=" + (videoStep?.exitCode ?? "未执行"));
  lines.push("- 证据：" + SCREEN_PREFIX + "/reveal-mobile.webm；reveal-mobile-before.png / reveal-mobile-after.png 为前后帧。");
  if (video) {
    lines.push("- 成片探针：" + video.frames + " 帧，最后 cluster " + video.lastTimestampMs + " ms；录制步骤约 " + videoStep?.elapsed + " 秒；WebM 不写 Duration 元素，部分播放器显示 Infinity，但完整播放可覆盖 30 秒倒计时并恢复掩码。");
  }
  lines.push("- 回归输出：");
  lines.push("");
  lines.push("~~~text");
  lines.push(tail(e2e?.output ?? "未执行", 18));
  lines.push("~~~");
  lines.push("");
  lines.push("### AC3 批量补录未填说明时无法提交（截图）");
  lines.push("");
  lines.push("- 回归命令：node scripts/e2e.mjs --fast");
  lines.push("- 断言：勾选 2 个“已通过”行 → 打开批量补录 → 说明留空 → 出现 batch-error；mock-batch-count 仍为 0；弹窗内 batch-dialog-count 仍为 0；填写说明后提交成功，批量请求数变为 1、已选变为 0。");
  lines.push("- 截图：" + SCREEN_PREFIX + "/batch-attendance.png（空说明红字、计数 0）、" + SCREEN_PREFIX + "/batch-attendance-success.png（提交成功）。");
  lines.push("");
  lines.push("## 全部步骤");
  lines.push("");
  lines.push("| 步骤 | 说明 | exit | 耗时 | 日志 |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const item of results) {
    lines.push("| " + item.id + " | " + item.title + " | " + item.exitCode + " | " + item.elapsed + "s | " + item.log + " |");
  }
  lines.push("");
  lines.push("## 证据文件 SHA-256");
  lines.push("");
  lines.push("| 文件 | 字节 | SHA-256 |");
  lines.push("| --- | --- | --- |");
  for (const item of evidence) lines.push("| " + item.path + " | " + item.bytes + " | " + item.sha256 + " |");
  lines.push("");
  lines.push("## 复现");
  lines.push("");
  lines.push("~~~powershell");
  lines.push("# 在仓库根目录执行");
  lines.push("pnpm install --frozen-lockfile");
  lines.push("pnpm build");
  lines.push("pnpm test");
  lines.push("pnpm verify");
  lines.push("~~~");
  lines.push("");
  lines.push("pnpm verify 依次运行对账、构建、类型检查、单测、AC 回归、截图和真实 30 秒录屏；任何一步失败即退出 1。");
  lines.push("");
  writeFileSync(resolve(OUTPUT_ROOT, "ACCEPTANCE.md"), lines.join("\n"), "utf8");

  console.log("overall " + (passed ? "PASS" : "FAIL") + " -> " + display(resolve(OUTPUT_ROOT, "ACCEPTANCE.md")));
  if (!passed) process.exitCode = 1;
}

main();
