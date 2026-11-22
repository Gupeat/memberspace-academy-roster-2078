export type RosterStatus = "pending" | "waitlist" | "confirmed";
export type LearningStatus = "not_started" | "in_progress" | "completed";
export type RosterSource = "mini" | "workbench" | "campaign";
export type Role = "supervisor" | "manager";
export type AttendanceOutcome = "checked" | "leave" | "absent";

export interface RosterRow {
  id: string;
  name: string;
  mobile: string;
  is_member: boolean;
  company: string;
  member_level: string;
  source: RosterSource;
  status: RosterStatus;
  checked_in_at: string | null;
  learning_status: LearningStatus;
  benefit_deducted: boolean;
  manager: string;
  learning_hours: number;
  learning_note?: string;
}

export interface SessionInfo {
  id: string;
  courseTitle: string;
  title: string;
  startsAt: string;
  endsAt: string;
  venue: string;
  capacity: number;
  supervisor: string;
}

export interface RosterPayload {
  generated_by: string;
  seed: number;
  session: SessionInfo;
  rows: RosterRow[];
}

export interface RosterStats {
  registered: number;
  waitlist: number;
  pending: number;
  checkedIn: number;
  attendanceRate: number;
  nonMember: number;
}

export interface Filters {
  status: "all" | RosterStatus;
  member: "all" | "member" | "non_member";
  checkin: "all" | "checked" | "unchecked";
}

export interface BatchAttendanceInput {
  selectedIds: string[];
  outcome: AttendanceOutcome;
  hours: number;
  note: string;
}

export interface LearningRecordInput {
  status: LearningStatus;
  hours: number;
  note: string;
}

export const STATUS_LABEL: Record<RosterStatus, string> = {
  pending: "待审核",
  waitlist: "候补",
  confirmed: "已通过",
};

export const LEARNING_LABEL: Record<LearningStatus, string> = {
  not_started: "未开始",
  in_progress: "学习中",
  completed: "已完成",
};

export const SOURCE_LABEL: Record<RosterSource, string> = {
  mini: "小程序",
  workbench: "工作台",
  campaign: "活动页",
};

export const OUTCOME_LABEL: Record<AttendanceOutcome, string> = {
  checked: "已签到",
  leave: "请假",
  absent: "未到场",
};
