import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SEED = 2078;
const ROW_COUNT = 128;
const TARGET = { pending: 7, waitlist: 12, checkedIn: 96, nonMember: 23, revealRow: 19 };

const SURNAMES = ["林", "周", "沈", "陈", "许", "顾", "苏", "叶", "唐", "宋", "何", "罗", "郑", "谢", "韩", "白"];
const GIVEN = ["一舟", "予安", "知夏", "明川", "若岚", "嘉树", "清和", "语桐"];
const MEMBER_COMPANIES = [
  "青岚科技", "澄川智造", "栖梧咨询", "星野数据", "澜图设计", "云帆物流",
  "木棉教育", "恒益法务", "启明人力", "苍梧资本", "远山传媒", "辰光医疗",
  "拾光文旅", "简一软件", "海桐能源", "知微研究", "白鹭会展", "麦田品牌",
  "经纬咨询", "南山培训", "瀚海贸易", "景行建筑", "圆融财务", "新桥出海",
];
const NON_MEMBER_COMPANIES = [
  "野渡工作室", "零度实验室", "小满合作社", "飞鸟创意",
  "初见花艺", "山谷咖啡", "木星手作", "晴窗摄影",
];
const MANAGERS = ["顾清", "陆遥", "沈禾", "唐宁", "许棠", "林越", "周屿", "苏晚"];
const SOURCES = ["mini", "workbench", "campaign"];
const LEVELS = ["普通会员", "银卡会员", "金卡会员", "钻石会员"];
const LEARNING = ["not_started", "in_progress", "completed"];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(SEED);
const shuffle = (items) => {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
const pick = (items) => items[Math.floor(random() * items.length)];

function statuses() {
  const rest = [];
  for (let i = 0; i < TARGET.pending; i += 1) rest.push("pending");
  for (let i = 0; i < TARGET.waitlist; i += 1) rest.push("waitlist");
  while (rest.length < ROW_COUNT - 1) rest.push("confirmed");
  const shuffled = shuffle(rest);
  shuffled.splice(TARGET.revealRow, 0, "confirmed");
  return shuffled;
}

function nonMemberIndexes() {
  const candidates = Array.from({ length: ROW_COUNT }, (_, i) => i).filter((i) => i !== TARGET.revealRow);
  return new Set(shuffle(candidates).slice(0, TARGET.nonMember));
}

function checkinIndexes(statusList) {
  const confirmed = statusList
    .map((status, index) => (status === "confirmed" ? index : -1))
    .filter((index) => index >= 0 && index !== TARGET.revealRow);
  const picked = new Set(shuffle(confirmed).slice(0, TARGET.checkedIn - 1));
  picked.add(TARGET.revealRow);
  return picked;
}

function checkinAt() {
  const baseMinutes = 8 * 60 + 35;
  const minutes = baseMinutes + Math.floor(random() * 56);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `2026-10-18T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`;
}

function learningStatus(checkedIn) {
  if (!checkedIn) return "not_started";
  const n = random();
  if (n < 0.72) return "completed";
  if (n < 0.94) return "in_progress";
  return "not_started";
}

const statusList = statuses();
const nonMembers = nonMemberIndexes();
const checked = checkinIndexes(statusList);
const rows = statusList.map((status, index) => {
  const sequence = index + 1;
  const isMember = !nonMembers.has(index);
  const checkedIn = status === "confirmed" && checked.has(index);
  const isReveal = index === TARGET.revealRow;
  const mobile = isReveal
    ? "13800001234"
    : "138" + String(10000000 + sequence * 97).slice(0, 8);
  return {
    id: `r${String(sequence).padStart(3, "0")}`,
    name: SURNAMES[index % SURNAMES.length] + GIVEN[Math.floor(index / SURNAMES.length)],
    mobile,
    is_member: isMember,
    company: isMember
      ? MEMBER_COMPANIES[index % MEMBER_COMPANIES.length]
      : NON_MEMBER_COMPANIES[index % NON_MEMBER_COMPANIES.length],
    member_level: isMember ? pick(LEVELS) : "",
    source: pick(SOURCES),
    status,
    checked_in_at: checkedIn ? checkinAt() : null,
    learning_status: learningStatus(checkedIn),
    benefit_deducted: checkedIn,
    manager: MANAGERS[index % MANAGERS.length],
    learning_hours: checkedIn ? 2 + Math.floor(random() * 5) : 0,
  };
});

const payload = {
  generated_by: "scripts/generate_roster.mjs",
  seed: SEED,
  session: {
    id: "sess-2078",
    courseTitle: "产业资源连接实战营（虚构）",
    title: "第 12 期 · 名单对账场",
    startsAt: "2026-10-18T09:00:00+08:00",
    endsAt: "2026-10-18T17:30:00+08:00",
    venue: "A 座 3F 多功能厅（虚构）",
    capacity: 140,
    supervisor: "顾清",
  },
  rows,
};

mkdirSync(resolve("mock"), { recursive: true });
writeFileSync(resolve("mock/roster.json"), JSON.stringify(payload, null, 2) + "\n", "utf8");
const stats = {
  rows: rows.length,
  pending: rows.filter((row) => row.status === "pending").length,
  waitlist: rows.filter((row) => row.status === "waitlist").length,
  confirmed: rows.filter((row) => row.status === "confirmed").length,
  checkedIn: rows.filter((row) => row.checked_in_at).length,
  nonMember: rows.filter((row) => !row.is_member).length,
  attendanceRate: (rows.filter((row) => row.checked_in_at).length / rows.length * 100).toFixed(1),
};
console.log(JSON.stringify(stats, null, 2));
