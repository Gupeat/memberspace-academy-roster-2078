import type {
  AttendanceOutcome,
  BatchAttendanceInput,
  Filters,
  LearningRecordInput,
  RosterRow,
  RosterStats,
} from "./types";

export function computeRosterStats(rows: RosterRow[]): RosterStats {
  const registered = rows.length;
  const waitlist = rows.filter((row) => row.status === "waitlist").length;
  const pending = rows.filter((row) => row.status === "pending").length;
  const checkedIn = rows.filter((row) => row.checked_in_at !== null).length;
  const nonMember = rows.filter((row) => !row.is_member).length;
  return {
    registered,
    waitlist,
    pending,
    checkedIn,
    attendanceRate: registered === 0 ? 0 : Number(((checkedIn / registered) * 100).toFixed(1)),
    nonMember,
  };
}

export function filterRows(rows: RosterRow[], filters: Filters): RosterRow[] {
  return rows.filter((row) => {
    if (filters.status !== "all" && row.status !== filters.status) return false;
    if (filters.member === "member" && !row.is_member) return false;
    if (filters.member === "non_member" && row.is_member) return false;
    if (filters.checkin === "checked" && row.checked_in_at === null) return false;
    if (filters.checkin === "unchecked" && row.checked_in_at !== null) return false;
    return true;
  });
}

export function maskMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  const tail = digits.slice(-4) || "----";
  return "*******" + tail;
}

export function remainingSeconds(expiresAt: number | null, now: number): number {
  if (expiresAt === null) return 0;
  return Math.max(0, Math.min(30, Math.ceil((expiresAt - now) / 1000)));
}

export function isRevealed(expiresAt: number | null, now: number): boolean {
  return expiresAt !== null && expiresAt > now;
}

export function validateBatch(
  input: BatchAttendanceInput,
  rows: RosterRow[],
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const selected = new Set(input.selectedIds);
  const selectedRows = rows.filter((row) => selected.has(row.id));
  if (selectedRows.length === 0) errors.push("请先勾选至少一行名单");
  if (selectedRows.some((row) => row.status !== "confirmed")) {
    errors.push("待审核或候补名单不能批量补录，请先完成审核");
  }
  if (selectedRows.some((row) => row.checked_in_at !== null)) {
    errors.push("已签到行不能批量补录，历史签到时间与学时不会被覆盖");
  }
  if (input.note.trim().length === 0) errors.push("补录说明必填");
  if (input.note.trim().length > 200) errors.push("补录说明不能超过 200 字");
  if (!Number.isFinite(input.hours) || input.hours < 0 || input.hours > 24) {
    errors.push("学时需在 0–24 之间");
  }
  return { ok: errors.length === 0, errors };
}

export function applyBatchAttendance(
  rows: RosterRow[],
  input: BatchAttendanceInput,
  nowIso: string,
): RosterRow[] {
  const selected = new Set(input.selectedIds);
  return rows.map((row) => {
    if (!selected.has(row.id) || row.status !== "confirmed" || row.checked_in_at !== null) return row;
    const checked = input.outcome === "checked";
    return {
      ...row,
      checked_in_at: checked ? nowIso : null,
      benefit_deducted: checked,
      learning_hours: input.hours,
    };
  });
}

export function validateLearningRecord(input: LearningRecordInput): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (input.note.trim().length === 0) errors.push("更正说明必填");
  if (input.note.trim().length > 200) errors.push("更正说明不能超过 200 字");
  if (!Number.isFinite(input.hours) || input.hours < 0 || input.hours > 24) {
    errors.push("学时需在 0–24 之间");
  }
  return { ok: errors.length === 0, errors };
}

export function applyLearningRecord(
  rows: RosterRow[],
  rowId: string,
  input: LearningRecordInput,
): RosterRow[] {
  return rows.map((row) =>
    row.id === rowId
      ? {
          ...row,
          learning_status: input.status,
          learning_hours: input.hours,
          learning_note: input.note.trim(),
        }
      : row,
  );
}

export function confirmedNotCheckedIn(rows: RosterRow[]): number {
  return rows.filter((row) => row.status === "confirmed" && row.checked_in_at === null).length;
}

export function attendanceRateText(rate: number): string {
  return rate.toFixed(1) + "%";
}
