import type { Role } from "./types";

export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function canCorrect(role: Role, endsAt: string, now: number = Date.now()): boolean {
  if (role === "supervisor") return true;
  return now <= new Date(endsAt).getTime() + THIRTY_DAYS_MS;
}

const MOBILE_REVEAL_ROLES: ReadonlySet<Role> = new Set<Role>(["manager", "supervisor"]);

export function canRevealMobile(role: Role): boolean {
  return MOBILE_REVEAL_ROLES.has(role);
}

export function permissionReason(role: Role, endsAt: string, now: number = Date.now()): string {
  if (canCorrect(role, endsAt, now)) return "";
  return "课期结束超过 30 天，需主管权限";
}
