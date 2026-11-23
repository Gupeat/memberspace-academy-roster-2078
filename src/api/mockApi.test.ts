import { describe, expect, it, vi } from "vitest";
import type { BatchAttendanceInput } from "../domain/types";

async function freshApi() {
  vi.resetModules();
  return import("./mockApi");
}

function batchInput(selectedIds: string[]): BatchAttendanceInput {
  return { selectedIds, outcome: "checked", hours: 2, note: "现场签到，助教补录" };
}

describe("mock API permission guards", () => {
  it("rejects auditor mobile reveal without recording a request", async () => {
    const api = await freshApi();
    const before = api.getMockRequestCount("revealMobile");
    await expect(api.revealMobile("r020", "auditor")).rejects.toThrow("只读审计员");
    expect(api.getMockRequestCount("revealMobile")).toBe(before);
  });

  it("rejects auditor batch attendance without recording a request", async () => {
    const api = await freshApi();
    const before = api.getMockRequestCount("batchAttendance");
    await expect(api.batchAttendance(batchInput(["r007", "r025"]), "auditor")).rejects.toThrow("只读审计员");
    expect(api.getMockRequestCount("batchAttendance")).toBe(before);
  });

  it("rejects auditor learning correction without recording a request", async () => {
    const api = await freshApi();
    const before = api.getMockRequestCount("updateLearningRecord");
    await expect(
      api.updateLearningRecord("r020", { status: "completed", hours: 4, note: "越权更正" }, "auditor"),
    ).rejects.toThrow();
    expect(api.getMockRequestCount("updateLearningRecord")).toBe(before);
  });

  it("rejects a batch that includes an already checked-in row and keeps its values", async () => {
    const api = await freshApi();
    const target = api.currentRows().find((row) => row.id === "r001")!;
    const before = api.getMockRequestCount("batchAttendance");
    await expect(api.batchAttendance(batchInput(["r001"]), "manager")).rejects.toThrow("已签到");
    expect(api.getMockRequestCount("batchAttendance")).toBe(before);
    const after = api.currentRows().find((row) => row.id === "r001")!;
    expect(after.checked_in_at).toBe(target.checked_in_at);
    expect(after.learning_hours).toBe(target.learning_hours);
    expect(after.benefit_deducted).toBe(target.benefit_deducted);
  });

  it("updates only unchecked confirmed rows for a manager", async () => {
    const api = await freshApi();
    const selected = api
      .currentRows()
      .filter((row) => row.status === "confirmed" && row.checked_in_at === null)
      .slice(0, 2)
      .map((row) => row.id);
    const result = await api.batchAttendance(batchInput(selected), "manager");
    expect(result.updated).toBe(2);
    expect(result.rows.filter((row) => row.checked_in_at !== null)).toHaveLength(98);
    for (const id of selected) {
      const row = result.rows.find((item) => item.id === id)!;
      expect(row.checked_in_at).not.toBeNull();
      expect(row.learning_hours).toBe(2);
    }
  });
});
