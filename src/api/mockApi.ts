import rawRoster from "../../mock/roster.json";
import type {
  BatchAttendanceInput,
  LearningRecordInput,
  Role,
  RosterPayload,
  RosterRow,
  SessionInfo,
} from "../domain/types";
import {
  applyBatchAttendance,
  applyLearningRecord,
  validateBatch,
  validateLearningRecord,
} from "../domain/stats";
import { canBatchAttendance, canCorrect, canRevealMobile } from "../domain/permissions";

const seed = rawRoster as RosterPayload;
const session: SessionInfo = seed.session;
let rows: RosterRow[] = clone(seed.rows);
const requestCounters: Record<string, number> = {
  listRoster: 0,
  revealMobile: 0,
  batchAttendance: 0,
  updateLearningRecord: 0,
};
const requestLog: Array<{ kind: string; at: string; requestNo: number }> = [];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function record(kind: string): number {
  requestCounters[kind] = (requestCounters[kind] ?? 0) + 1;
  requestLog.push({ kind, at: new Date().toISOString(), requestNo: requestCounters[kind] });
  return requestCounters[kind];
}

export async function loadRoster(sid: string): Promise<{ session: SessionInfo; rows: RosterRow[] }> {
  if (sid !== session.id) throw new Error("课期不存在：" + sid);
  await delay(120);
  record("listRoster");
  return { session: clone(session), rows: clone(rows) };
}

export async function revealMobile(rowId: string, role: Role): Promise<{ mobile: string; expiresInSeconds: 30 }> {
  if (!canRevealMobile(role)) throw new Error("只读审计员无手机号查看权限");
  await delay(90);
  const row = rows.find((item) => item.id === rowId);
  if (!row) throw new Error("名单行不存在：" + rowId);
  record("revealMobile");
  return { mobile: row.mobile, expiresInSeconds: 30 };
}

export async function batchAttendance(
  input: BatchAttendanceInput,
  role: Role,
): Promise<{ updated: number; rows: RosterRow[]; requestNo: number }> {
  if (!canBatchAttendance(role)) throw new Error("只读审计员无补录权限");
  await delay(120);
  const validation = validateBatch(input, rows);
  if (!validation.ok) throw new Error(validation.errors.join("；"));
  const nowIso = new Date().toISOString();
  rows = applyBatchAttendance(rows, input, nowIso);
  const requestNo = record("batchAttendance");
  return { updated: input.selectedIds.length, rows: clone(rows), requestNo };
}

export async function updateLearningRecord(
  rowId: string,
  input: LearningRecordInput,
  role: Role,
): Promise<{ row: RosterRow; requestNo: number }> {
  if (!canCorrect(role, session.endsAt)) throw new Error("当前身份无学习记录更正权限");
  await delay(90);
  if (!rows.some((row) => row.id === rowId)) throw new Error("名单行不存在：" + rowId);
  const validation = validateLearningRecord(input);
  if (!validation.ok) throw new Error(validation.errors.join("；"));
  rows = applyLearningRecord(rows, rowId, input);
  const requestNo = record("updateLearningRecord");
  return { row: clone(rows.find((row) => row.id === rowId)!), requestNo };
}

export function getMockRequestCount(kind?: string): number {
  if (kind) return requestCounters[kind] ?? 0;
  return Object.values(requestCounters).reduce((sum, value) => sum + value, 0);
}

export function getMockRequestLog(): Array<{ kind: string; at: string; requestNo: number }> {
  return clone(requestLog);
}

export function currentRows(): RosterRow[] {
  return clone(rows);
}
