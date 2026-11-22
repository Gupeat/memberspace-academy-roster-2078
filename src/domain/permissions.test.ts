import { describe, expect, it } from "vitest";
import { canCorrect, canRevealMobile, permissionReason, THIRTY_DAYS_MS } from "./permissions";

const endsAt = "2026-10-18T17:30:00+08:00";
const endMs = new Date(endsAt).getTime();

describe("30-day correction permission", () => {
  it("lets a supervisor correct at any time", () => {
    expect(canCorrect("supervisor", endsAt, endMs + THIRTY_DAYS_MS * 10)).toBe(true);
    expect(canRevealMobile("supervisor")).toBe(true);
  });

  it("lets a manager correct through the 30-day boundary", () => {
    expect(canCorrect("manager", endsAt, endMs + 29 * 24 * 60 * 60 * 1000)).toBe(true);
    expect(canCorrect("manager", endsAt, endMs + THIRTY_DAYS_MS)).toBe(true);
    expect(permissionReason("manager", endsAt, endMs + THIRTY_DAYS_MS)).toBe("");
  });

  it("blocks a manager one millisecond after the boundary", () => {
    const after = endMs + THIRTY_DAYS_MS + 1;
    expect(canCorrect("manager", endsAt, after)).toBe(false);
    expect(permissionReason("manager", endsAt, after)).toBe("课期结束超过 30 天，需主管权限");
    expect(canRevealMobile("manager")).toBe(true);
  });
});
