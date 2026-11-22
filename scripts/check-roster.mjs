import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const path = resolve("mock/roster.json");
const payload = JSON.parse(readFileSync(path, "utf8"));
const rows = payload.rows;
const errors = [];

function assert(condition, message) {
  if (!condition) errors.push(message);
}

const registered = rows.length;
const waitlist = rows.filter((row) => row.status === "waitlist").length;
const pending = rows.filter((row) => row.status === "pending").length;
const checkedIn = rows.filter((row) => row.checked_in_at !== null).length;
const nonMember = rows.filter((row) => !row.is_member).length;
const confirmed = rows.filter((row) => row.status === "confirmed").length;
const confirmedNotChecked = rows.filter((row) => row.status === "confirmed" && row.checked_in_at === null).length;
const rate = (checkedIn / registered) * 100;

assert(registered === 128, "报名数必须是 128");
assert(waitlist === 12, "候补数必须是 12");
assert(pending === 7, "待审核数必须是 7");
assert(checkedIn === 96, "签到数必须是 96");
assert(nonMember === 23, "非会员数必须是 23");
assert(confirmed === 109, "已通过数必须是 109");
assert(confirmedNotChecked === 13, "已通过未签到必须是 13");
assert(rate.toFixed(1) === "75.0", "出勤率必须是 75.0%");
assert(registered === checkedIn + confirmedNotChecked + waitlist + pending, "128 的分项必须闭合");

const ids = new Set();
const mobiles = new Set();
for (const row of rows) {
  assert(typeof row.id === "string" && row.id.length > 0, "每行必须有 id");
  assert(!ids.has(row.id), "id 重复：" + row.id);
  ids.add(row.id);
  assert(typeof row.mobile === "string" && /^1\d{10}$/.test(row.mobile), "手机号格式错误：" + row.id);
  assert(!mobiles.has(row.mobile), "手机号重复：" + row.id);
  mobiles.add(row.mobile);
  assert(typeof row.name === "string" && row.name.length > 0, "姓名不能为空：" + row.id);
  assert(typeof row.company === "string" && row.company.length > 0, "企业简称不能为空：" + row.id);
  assert(["pending", "waitlist", "confirmed"].includes(row.status), "报名状态非法：" + row.id);
  assert(["mini", "workbench", "campaign"].includes(row.source), "报名来源非法：" + row.id);
  assert(["not_started", "in_progress", "completed"].includes(row.learning_status), "学习状态非法：" + row.id);
  assert(row.status === "confirmed" || row.checked_in_at === null, "非已通过行不应有签到时间：" + row.id);
  assert(row.checked_in_at === null || !Number.isNaN(Date.parse(row.checked_in_at)), "签到时间非法：" + row.id);
  assert(row.checked_in_at === null || row.benefit_deducted === true, "已签到应扣权益：" + row.id);
  assert(row.checked_in_at !== null || row.benefit_deducted === false, "未签到不应扣权益：" + row.id);
  assert(row.is_member === (row.member_level.length > 0), "会员等级与是否会员不一致：" + row.id);
  assert(Number.isFinite(row.learning_hours) && row.learning_hours >= 0, "学时非法：" + row.id);
  assert(typeof row.manager === "string" && row.manager.length > 0, "负责会员经理不能为空：" + row.id);
}

const revealRow = rows.find((row) => row.id === "r020");
assert(revealRow, "缺少用于 AC2 的 r020");
assert(revealRow?.mobile === "13800001234", "r020 手机号必须是 13800001234");
assert(revealRow?.checked_in_at !== null, "r020 必须已签到");
assert(revealRow?.status === "confirmed", "r020 必须是已通过");

const table = [
  ["报名数", "rows.length", String(registered), "128"],
  ["候补数", "status=waitlist", String(waitlist), "12"],
  ["待审核数", "status=pending", String(pending), "7"],
  ["签到数", "checked_in_at != null", String(checkedIn), "96"],
  ["出勤率", "checkedIn / registered", rate.toFixed(1) + "%", "75.0%"],
  ["非会员数", "is_member=false", String(nonMember), "23"],
];

console.log("指标 | 公式 | 重算 | 期望 | 结果");
console.log("---|---|---|---|---");
for (const [name, formula, actual, expected] of table) {
  const ok = actual === expected;
  console.log(name + " | " + formula + " | " + actual + " | " + expected + " | " + (ok ? "PASS" : "FAIL"));
  assert(ok, name + " 期望 " + expected + "，实际 " + actual);
}
console.log("");
console.log("分项闭合：签到 " + checkedIn + " + 已通过未签到 " + confirmedNotChecked + " + 候补 " + waitlist + " + 待审核 " + pending + " = " + (checkedIn + confirmedNotChecked + waitlist + pending));
console.log("r020 脱敏：" + "*******" + revealRow.mobile.slice(-4));

if (errors.length > 0) {
  console.error("");
  console.error("FAIL: " + errors.length + " 项不通过");
  for (const error of errors) console.error("- " + error);
  process.exit(1);
}

console.log("");
console.log(JSON.stringify({
  ok: true,
  stats: { registered, waitlist, pending, checkedIn, attendanceRate: rate.toFixed(1), nonMember },
  confirmed,
  confirmedNotChecked,
  revealRow: revealRow.id,
}, null, 2));
