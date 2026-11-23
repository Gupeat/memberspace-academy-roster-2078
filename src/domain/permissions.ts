import type { Role } from "./types";

export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function canCorrect(role: Role, endsAt: string, now: number = Date.now()): boolean {
  if (role === "supervisor") return true;
  if (role === "manager") return now <= new Date(endsAt).getTime() + THIRTY_DAYS_MS;
  return false;
}

const MOBILE_REVEAL_ROLES: ReadonlySet<Role> = new Set<Role>(["manager", "supervisor"]);
const BATCH_ATTENDANCE_ROLES: ReadonlySet<Role> = new Set<Role>(["manager", "supervisor"]);

export function canRevealMobile(role: Role): boolean {
  return MOBILE_REVEAL_ROLES.has(role);
}

export function canBatchAttendance(role: Role): boolean {
  return BATCH_ATTENDANCE_ROLES.has(role);
}

export function permissionReason(role: Role, endsAt: string, now: number = Date.now()): string {
  if (canCorrect(role, endsAt, now)) return "";
  if (role === "auditor") return "只读审计员无更正权限";
  return "课期结束超过 30 天，需主管权限";
}
