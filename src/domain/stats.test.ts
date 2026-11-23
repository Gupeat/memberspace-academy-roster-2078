import { describe, expect, it } from "vitest";
import roster from "../../mock/roster.json";
import type { RosterPayload, RosterRow } from "./types";
import {
  applyBatchAttendance,
  applyLearningRecord,
  attendanceRateText,
  computeRosterStats,
  confirmedNotCheckedIn,
  filterRows,
  isRevealed,
  maskMobile,
  remainingSeconds,
  validateBatch,
  validateLearningRecord,
} from "./stats";

const payload = roster as RosterPayload;
const rows = payload.rows as RosterRow[];

function checkedInConfirmed(count: number): string[] {
  return rows
    .filter((row) => row.status === "confirmed" && row.checked_in_at !== null)
    .slice(0, count)
    .map((row) => row.id);
}

function uncheckedConfirmed(count: number): string[] {
  return rows
    .filter((row) => row.status === "confirmed" && row.checked_in_at === null)
    .slice(0, count)
    .map((row) => row.id);
}

describe("roster stats", () => {
  it("matches the hand-calculated six values", () => {
    expect(computeRosterStats(rows)).toEqual({
      registered: 128,
      waitlist: 12,
      pending: 7,
      checkedIn: 96,
      attendanceRate: 75,
      nonMember: 23,
    });
    expect(attendanceRateText(75)).toBe("75.0%");
  });

  it("closes the 128-row breakdown", () => {
    expect(rows.length).toBe(128);
    expect(rows.filter((row) => row.status === "confirmed").length).toBe(109);
    expect(confirmedNotCheckedIn(rows)).toBe(13);
    expect(rows.filter((row) => row.status === "waitlist").length).toBe(12);
    expect(rows.filter((row) => row.status === "pending").length).toBe(7);
    expect(13 + 12 + 7 + 96).toBe(128);
  });

  it("keeps the stats over the whole session, independent of filters", () => {
    const filtered = filterRows(rows, { status: "pending", member: "all", checkin: "all" });
    expect(filtered).toHaveLength(7);
    expect(computeRosterStats(rows).registered).toBe(128);
  });
});

describe("filters", () => {
  it("filters by status, membership and check-in independently", () => {
    expect(filterRows(rows, { status: "waitlist", member: "all", checkin: "all" })).toHaveLength(12);
    expect(filterRows(rows, { status: "all", member: "non_member", checkin: "all" })).toHaveLength(23);
    expect(filterRows(rows, { status: "all", member: "all", checkin: "checked" })).toHaveLength(96);
    expect(filterRows(rows, { status: "all", member: "all", checkin: "unchecked" })).toHaveLength(32);
    expect(
      filterRows(rows, { status: "confirmed", member: "member", checkin: "checked" }).every(
        (row) => row.status === "confirmed" && row.is_member && row.checked_in_at !== null,
      ),
    ).toBe(true);
  });
});

describe("mobile masking and reveal window", () => {
  it("always masks to seven stars plus the last four digits", () => {
    expect(maskMobile("13800001234")).toBe("*******1234");
    expect(maskMobile("138-0000-5678")).toBe("*******5678");
  });

  it("counts down from 30 and expires at zero", () => {
    const now = 1_000_000;
    expect(remainingSeconds(now + 30_000, now)).toBe(30);
    expect(remainingSeconds(now + 29_001, now)).toBe(30);
    expect(remainingSeconds(now + 1, now)).toBe(1);
    expect(remainingSeconds(now, now)).toBe(0);
    expect(isRevealed(now + 1, now)).toBe(true);
    expect(isRevealed(now, now)).toBe(false);
    expect(isRevealed(null, now)).toBe(false);
  });
});

describe("batch attendance", () => {
  it("requires selected rows, a non-empty note and a valid hour range", () => {
    expect(
      validateBatch({ selectedIds: [], outcome: "checked", hours: 2, note: "" }, rows).ok,
    ).toBe(false);
    expect(
      validateBatch({ selectedIds: [rows[0].id], outcome: "checked", hours: 2, note: "  " }, rows).ok,
    ).toBe(false);
    expect(
      validateBatch({ selectedIds: [rows[0].id], outcome: "checked", hours: 2, note: "x".repeat(201) }, rows).ok,
    ).toBe(false);
    expect(
      validateBatch({ selectedIds: uncheckedConfirmed(2), outcome: "checked", hours: 3, note: "现场补录" }, rows).ok,
    ).toBe(true);
  });

  it("updates check-in, benefit and stats for selected confirmed rows", () => {
    const selected = uncheckedConfirmed(2);
    const next = applyBatchAttendance(
      rows,
      { selectedIds: selected, outcome: "checked", hours: 3, note: "现场补录" },
      "2026-11-22T10:00:00+08:00",
    );
    expect(next.filter((row) => row.id === selected[0])[0].checked_in_at).toBe("2026-11-22T10:00:00+08:00");
    expect(next.filter((row) => row.id === selected[0])[0].benefit_deducted).toBe(true);
    expect(computeRosterStats(next).checkedIn).toBe(98);
    expect(computeRosterStats(next).attendanceRate).toBe(76.6);
  });

  it("rejects already checked-in rows and never overwrites their history", () => {
    const selected = checkedInConfirmed(2);
    const target = rows.find((row) => row.id === selected[0])!;
    const validation = validateBatch(
      { selectedIds: selected, outcome: "leave", hours: 0, note: "覆盖历史" },
      rows,
    );
    expect(validation.ok).toBe(false);
    expect(validation.errors.join("；")).toContain("已签到");
    const next = applyBatchAttendance(
      rows,
      { selectedIds: selected, outcome: "leave", hours: 0, note: "覆盖历史" },
      "2026-11-22T10:00:00+08:00",
    );
    const unchanged = next.find((row) => row.id === target.id)!;
    expect(unchanged.checked_in_at).toBe(target.checked_in_at);
    expect(unchanged.learning_hours).toBe(target.learning_hours);
    expect(unchanged.benefit_deducted).toBe(target.benefit_deducted);
  });

  it("does not mutate pending or waitlist rows", () => {
    const pending = rows.find((row) => row.status === "pending");
    expect(pending).toBeDefined();
    const next = applyBatchAttendance(
      rows,
      { selectedIds: [pending!.id], outcome: "checked", hours: 3, note: "非法" },
      "2026-11-22T10:00:00+08:00",
    );
    expect(next.find((row) => row.id === pending!.id)!.checked_in_at).toBe(null);
  });
});

describe("learning record correction", () => {
  it("requires a note and a valid hour range", () => {
    expect(validateLearningRecord({ status: "completed", hours: 4, note: "" }).ok).toBe(false);
    expect(validateLearningRecord({ status: "completed", hours: 25, note: "补录" }).ok).toBe(false);
    expect(validateLearningRecord({ status: "completed", hours: 4, note: "补录" }).ok).toBe(true);
  });

  it("updates only the selected row", () => {
    const target = checkedInConfirmed(1)[0];
    const next = applyLearningRecord(rows, target, {
      status: "completed",
      hours: 6,
      note: "补录学时",
    });
    const changed = next.find((row) => row.id === target)!;
    expect(changed.learning_status).toBe("completed");
    expect(changed.learning_hours).toBe(6);
    expect(changed.learning_note).toBe("补录学时");
    expect(next.find((row) => row.id !== target)!.learning_status).toBe(
      rows.find((row) => row.id !== target)!.learning_status,
    );
  });
});
