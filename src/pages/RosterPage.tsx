import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, Dialog, Drawer, MessagePlugin, Tag } from "tdesign-react";
import {
  batchAttendance,
  getMockRequestCount,
  loadRoster,
  revealMobile,
  updateLearningRecord,
} from "../api/mockApi";
import {
  attendanceRateText,
  computeRosterStats,
  filterRows,
  isRevealed,
  maskMobile,
  remainingSeconds,
  validateBatch,
  validateLearningRecord,
} from "../domain/stats";
import { canCorrect, canRevealMobile, permissionReason } from "../domain/permissions";
import type {
  AttendanceOutcome,
  Filters,
  LearningRecordInput,
  LearningStatus,
  Role,
  RosterRow,
  SessionInfo,
} from "../domain/types";
import {
  LEARNING_LABEL,
  OUTCOME_LABEL,
  ROLE_LABEL,
  SOURCE_LABEL,
  STATUS_LABEL,
} from "../domain/types";

const EMPTY_COUNTS = { list: 0, reveal: 0, batch: 0, learning: 0 };

function mockCounts() {
  return {
    list: getMockRequestCount("listRoster"),
    reveal: getMockRequestCount("revealMobile"),
    batch: getMockRequestCount("batchAttendance"),
    learning: getMockRequestCount("updateLearningRecord"),
  };
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function statusTheme(status: RosterRow["status"]) {
  if (status === "confirmed") return "success";
  if (status === "waitlist") return "warning";
  return "default";
}

function learningTheme(status: LearningStatus) {
  if (status === "completed") return "success";
  if (status === "in_progress") return "primary";
  return "default";
}

export function RosterPage() {
  const { sid } = useParams<{ sid: string }>();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [role, setRole] = useState<Role>("manager");
  const [filters, setFilters] = useState<Filters>({ status: "all", member: "all", checkin: "all" });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [revealedUntil, setRevealedUntil] = useState<Record<string, number>>({});
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [counts, setCounts] = useState(EMPTY_COUNTS);

  const [batchOpen, setBatchOpen] = useState(false);
  const [batchOutcome, setBatchOutcome] = useState<AttendanceOutcome>("checked");
  const [batchHours, setBatchHours] = useState(2);
  const [batchNote, setBatchNote] = useState("");
  const [batchError, setBatchError] = useState("");
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  const [learningRow, setLearningRow] = useState<RosterRow | null>(null);
  const [learningStatus, setLearningStatus] = useState<LearningStatus>("not_started");
  const [learningHours, setLearningHours] = useState(0);
  const [learningNote, setLearningNote] = useState("");
  const [learningError, setLearningError] = useState("");
  const [learningSubmitting, setLearningSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError("");
    loadRoster(sid ?? "")
      .then((payload) => {
        if (!alive) return;
        setSession(payload.session);
        setRows(payload.rows);
        setCounts(mockCounts());
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setLoadError(error instanceof Error ? error.message : "名单加载失败");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [sid, reloadToken]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [filters.status, filters.member, filters.checkin]);

  const stats = useMemo(() => computeRosterStats(rows), [rows]);
  const filtered = useMemo(() => filterRows(rows, filters), [rows, filters]);
  const selectableFiltered = useMemo(
    () => filtered.filter((row) => row.status === "confirmed"),
    [filtered],
  );
  const selectedRows = useMemo(() => rows.filter((row) => selectedIds.has(row.id)), [rows, selectedIds]);
  const selectedCount = selectedRows.length;
  const allVisibleSelected =
    selectableFiltered.length > 0 && selectableFiltered.every((row) => selectedIds.has(row.id));
  const revealActive = Object.values(revealedUntil).some((until) => until > nowMs);
  const canCorrectNow = session ? canCorrect(role, session.endsAt, nowMs) : false;
  const canRevealNow = canRevealMobile(role);
  const correctionReason = session ? permissionReason(role, session.endsAt, nowMs) : "";
  const endedDays = session
    ? Math.floor((nowMs - Date.parse(session.endsAt)) / (24 * 60 * 60 * 1000))
    : 0;

  useEffect(() => {
    if (!revealActive) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [revealActive]);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((previous) => ({ ...previous, [key]: value }));
  }

  function toggleSelectAll() {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (allVisibleSelected) {
        selectableFiltered.forEach((row) => next.delete(row.id));
      } else {
        selectableFiltered.forEach((row) => next.add(row.id));
      }
      return next;
    });
  }

  function toggleSelected(row: RosterRow) {
    if (row.status !== "confirmed") return;
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(row.id)) next.delete(row.id);
      else next.add(row.id);
      return next;
    });
  }

  async function handleReveal(row: RosterRow) {
    if (!canRevealMobile(role)) return;
    try {
      const response = await revealMobile(row.id);
      setRevealedUntil((previous) => ({
        ...previous,
        [row.id]: Date.now() + response.expiresInSeconds * 1000,
      }));
      setNowMs(Date.now());
      setCounts(mockCounts());
      MessagePlugin.success("手机号已显示，30 秒后自动恢复脱敏");
    } catch (error: unknown) {
      MessagePlugin.error(error instanceof Error ? error.message : "手机号查看失败");
    }
  }

  function openBatch() {
    setBatchError("");
    setBatchOutcome("checked");
    setBatchHours(2);
    setBatchNote("");
    setBatchOpen(true);
  }

  function closeBatch() {
    if (batchSubmitting) return;
    setBatchOpen(false);
  }

  async function submitBatch() {
    const input = {
      selectedIds: Array.from(selectedIds),
      outcome: batchOutcome,
      hours: batchOutcome === "checked" ? batchHours : 0,
      note: batchNote.trim(),
    };
    const validation = validateBatch(input, rows);
    if (!validation.ok) {
      setBatchError(validation.errors.join("；"));
      return;
    }
    setBatchSubmitting(true);
    setBatchError("");
    try {
      const result = await batchAttendance(input);
      setRows(result.rows);
      setSelectedIds(new Set());
      setCounts(mockCounts());
      setBatchOpen(false);
      MessagePlugin.success("已补录 " + result.updated + " 人出勤");
    } catch (error: unknown) {
      setBatchError(error instanceof Error ? error.message : "批量补录失败");
    } finally {
      setBatchSubmitting(false);
    }
  }

  function openLearning(row: RosterRow) {
    setLearningRow(row);
    setLearningStatus(row.learning_status);
    setLearningHours(row.learning_hours);
    setLearningNote(row.learning_note ?? "");
    setLearningError("");
  }

  function closeLearning() {
    if (learningSubmitting) return;
    setLearningRow(null);
  }

  async function submitLearning() {
    if (!learningRow) return;
    const input: LearningRecordInput = {
      status: learningStatus,
      hours: learningHours,
      note: learningNote.trim(),
    };
    const validation = validateLearningRecord(input);
    if (!validation.ok) {
      setLearningError(validation.errors.join("；"));
      return;
    }
    setLearningSubmitting(true);
    setLearningError("");
    try {
      const result = await updateLearningRecord(learningRow.id, input);
      setRows((previous) => previous.map((row) => (row.id === result.row.id ? result.row : row)));
      setCounts(mockCounts());
      setLearningRow(null);
      MessagePlugin.success("学习记录已更正");
    } catch (error: unknown) {
      setLearningError(error instanceof Error ? error.message : "学习记录更正失败");
    } finally {
      setLearningSubmitting(false);
    }
  }

  function resetFilters() {
    setFilters({ status: "all", member: "all", checkin: "all" });
  }

  if (loading) {
    return (
      <main className="page-shell">
        <div className="state-card">正在加载课期名单…</div>
      </main>
    );
  }

  if (loadError || !session) {
    return (
      <main className="page-shell">
        <div className="state-card state-error">
          <strong>名单加载失败</strong>
          <p>{loadError || "课期不存在"}</p>
          <Button theme="primary" onClick={() => setReloadToken((value) => value + 1)}>
            重新加载
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">会员空间 · 学院运营</div>
          <h1>课期报名名单</h1>
          <p className="subtitle" data-testid="session-title">
            {session.courseTitle} · {session.title}
          </p>
        </div>
        <div className="topbar-side">
          <label className="role-switch">
            <span>演示身份</span>
            <select
              aria-label="演示身份"
              value={role}
              onChange={(event) => {
                setRole(event.target.value as Role);
                setRevealedUntil({});
              }}
            >
              <option value="manager">会员经理</option>
              <option value="supervisor">主管</option>
              <option value="auditor">只读审计员</option>
            </select>
          </label>
          <div className={endedDays > 0 ? "session-pill is-ended" : "session-pill"}>
            {endedDays > 0 ? "课期已结束 " + endedDays + " 天" : "课期待开始"}
          </div>
        </div>
      </header>

      <section className="meta-strip" aria-label="课期信息">
        <span>课期编号 {session.id}</span>
        <span>时间 {formatDate(session.startsAt)} {formatTime(session.startsAt)} – {formatTime(session.endsAt)}</span>
        <span>地点 {session.venue}</span>
        <span>容量 {session.capacity} 人</span>
        <span>主管 {session.supervisor}</span>
      </section>

      {!canCorrectNow && (
        <div className="notice" data-testid="permission-notice">
          <div>
            <strong>更正受限期：</strong>
            {correctionReason}。当前身份为{ROLE_LABEL[role]}，学习记录更正按钮已禁用。
          </div>
          <button className="link-button" type="button" onClick={() => setRole("supervisor")}>
            切换为主管（演示）
          </button>
        </div>
      )}

      <section className="stats-grid" aria-label="报名统计">
        <article className="stat-card accent-blue" data-testid="stat-registered">
          <span className="stat-label">报名数</span>
          <strong>{stats.registered}</strong>
          <span className="stat-hint">全部报名</span>
        </article>
        <article className="stat-card accent-amber" data-testid="stat-waitlist">
          <span className="stat-label">候补数</span>
          <strong>{stats.waitlist}</strong>
          <span className="stat-hint">等待名额</span>
        </article>
        <article className="stat-card accent-purple" data-testid="stat-pending">
          <span className="stat-label">待审核数</span>
          <strong>{stats.pending}</strong>
          <span className="stat-hint">活动模块处理</span>
        </article>
        <article className="stat-card accent-green" data-testid="stat-checked-in">
          <span className="stat-label">签到数</span>
          <strong>{stats.checkedIn}</strong>
          <span className="stat-hint">已签到</span>
        </article>
        <article className="stat-card accent-teal" data-testid="stat-attendance">
          <span className="stat-label">出勤率</span>
          <strong>{attendanceRateText(stats.attendanceRate)}</strong>
          <span className="stat-hint">签到 / 报名</span>
        </article>
        <article className="stat-card accent-rose" data-testid="stat-non-member">
          <span className="stat-label">非会员数</span>
          <strong>{stats.nonMember}</strong>
          <span className="stat-hint">开放报名</span>
        </article>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>报名名单</h2>
            <p>
              共 {rows.length} 人 · 当前显示 {filtered.length} 人 · 统计卡始终按全课期计算
            </p>
          </div>
          <div className="filter-row">
            <label>
              报名状态
              <select
                value={filters.status}
                onChange={(event) => setFilter("status", event.target.value as Filters["status"])}
              >
                <option value="all">全部</option>
                <option value="confirmed">已通过</option>
                <option value="waitlist">候补</option>
                <option value="pending">待审核</option>
              </select>
            </label>
            <label>
              是否会员
              <select
                value={filters.member}
                onChange={(event) => setFilter("member", event.target.value as Filters["member"])}
              >
                <option value="all">全部</option>
                <option value="member">会员</option>
                <option value="non_member">非会员</option>
              </select>
            </label>
            <label>
              是否签到
              <select
                value={filters.checkin}
                onChange={(event) => setFilter("checkin", event.target.value as Filters["checkin"])}
              >
                <option value="all">全部</option>
                <option value="checked">已签到</option>
                <option value="unchecked">未签到</option>
              </select>
            </label>
            <Button variant="outline" onClick={resetFilters}>
              重置筛选
            </Button>
          </div>
        </div>

        <div className="selection-bar">
          <span className="selected-count" data-testid="selected-count">
            已选 {selectedCount} 人
          </span>
          <span className="selection-actions">
            <span data-testid="batch-open-wrap">
              <Button theme="primary" disabled={selectedCount === 0} onClick={openBatch}>
                批量补录出勤
              </Button>
            </span>
            <Button
              variant="text"
              disabled={selectedCount === 0}
              onClick={() => setSelectedIds(new Set())}
            >
              清空选择
            </Button>
          </span>
          <span className="selection-hint">仅“已通过”行可补录；补录说明必填。</span>
        </div>

        <div className="table-wrap">
          <table className="roster-table">
            <thead>
              <tr>
                <th className="check-col">
                  <input
                    type="checkbox"
                    aria-label="选择当前筛选下的全部已通过行"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    disabled={selectableFiltered.length === 0}
                  />
                </th>
                <th>姓名</th>
                <th>企业简称</th>
                <th>手机号</th>
                <th>会员等级</th>
                <th>报名来源</th>
                <th>报名状态</th>
                <th>签到时间</th>
                <th>学习记录状态</th>
                <th>是否扣权益</th>
                <th>负责会员经理</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="empty-cell">
                    没有符合筛选条件的报名记录
                  </td>
                </tr>
              )}
              {filtered.map((row) => {
                const until = revealedUntil[row.id] ?? null;
                const revealed = canRevealNow && isRevealed(until, nowMs);
                const seconds = remainingSeconds(until, nowMs);
                return (
                  <tr key={row.id} data-testid={"row-" + row.id}>
                    <td className="check-col">
                      <input
                        type="checkbox"
                        aria-label={"选择 " + row.name}
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleSelected(row)}
                        disabled={row.status !== "confirmed"}
                        title={row.status === "confirmed" ? "" : "仅已通过行可补录"}
                      />
                    </td>
                    <td>
                      <strong className="person-name">{row.name}</strong>
                    </td>
                    <td>
                      <span>{row.company}</span>
                      {!row.is_member && (
                        <Tag className="member-tag" theme="warning" variant="light-outline" size="small">
                          非会员
                        </Tag>
                      )}
                    </td>
                    <td>
                      <div className="mobile-cell">
                        <span className="mono" data-testid={"mobile-value-" + row.id}>
                          {revealed ? row.mobile : maskMobile(row.mobile)}
                        </span>
                        {revealed ? (
                          <span className="countdown">{seconds}s</span>
                        ) : canRevealNow ? (
                          <button
                            className="link-button"
                            type="button"
                            data-testid={"mobile-reveal-" + row.id}
                            onClick={() => void handleReveal(row)}
                            aria-label={"查看 " + row.name + " 的手机号"}
                          >
                            查看
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td>{row.member_level || "—"}</td>
                    <td>{SOURCE_LABEL[row.source]}</td>
                    <td>
                      <Tag theme={statusTheme(row.status)} variant="light">
                        {STATUS_LABEL[row.status]}
                      </Tag>
                      {row.status === "pending" && (
                        <Link
                          className="audit-link"
                          to={"/academy/activities?session=" + encodeURIComponent(session.id) + "&row=" + row.id}
                        >
                          审核
                        </Link>
                      )}
                    </td>
                    <td>{formatDateTime(row.checked_in_at)}</td>
                    <td>
                      <div className="learning-cell">
                        <Tag theme={learningTheme(row.learning_status)} variant="light">
                          {LEARNING_LABEL[row.learning_status]}
                        </Tag>
                        <span className="hours">{row.learning_hours > 0 ? row.learning_hours + " 学时" : "—"}</span>
                        {row.status === "confirmed" && (
                          <span title={correctionReason || "更正学习记录"}>
                            <Button
                              variant="text"
                              size="small"
                              disabled={!canCorrectNow}
                              onClick={() => openLearning(row)}
                            >
                              更正
                            </Button>
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <Tag theme={row.benefit_deducted ? "success" : "default"} variant="light">
                        {row.benefit_deducted ? "已扣" : "未扣"}
                      </Tag>
                    </td>
                    <td>{row.manager}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="mock-footer">
        <div>
          <strong>Mock 接口调用</strong> · 名单 {counts.list} · 查看手机号 {counts.reveal} · 批量补录{" "}
          <span data-testid="mock-batch-count">{counts.batch}</span> · 学习记录 {counts.learning}
        </div>
        <div>固定种子 mock 数据，不连接真实 API；统计卡与表格同源。</div>
      </footer>

      <Dialog
        visible={batchOpen}
        header="批量补录出勤"
        footer={false}
        width={580}
        onClose={closeBatch}
      >
        <div className="dialog-body">
          <p className="dialog-copy">
            已选 <strong>{selectedCount}</strong> 人；只处理“已通过”的报名行。
            <span className="dialog-mock" data-testid="batch-dialog-count">
              mock 批量补录请求：{counts.batch}
            </span>
          </p>
          <div className="field">
            <span className="field-label">补录结果</span>
            <div className="radio-row">
              {(["checked", "leave", "absent"] as AttendanceOutcome[]).map((value) => (
                <label key={value} className="radio-option">
                  <input
                    type="radio"
                    name="batch-outcome"
                    checked={batchOutcome === value}
                    onChange={() => setBatchOutcome(value)}
                  />
                  {OUTCOME_LABEL[value]}
                </label>
              ))}
            </div>
          </div>
          {batchOutcome === "checked" && (
            <label className="field">
              <span className="field-label">本次学时</span>
              <input
                className="input-control"
                type="number"
                min={0}
                max={24}
                step={0.5}
                value={batchHours}
                onChange={(event) => setBatchHours(Number(event.target.value))}
              />
            </label>
          )}
          <label className="field">
            <span className="field-label">
              补录说明 <em>*</em>
            </span>
            <textarea
              className="input-control textarea-control"
              value={batchNote}
              onChange={(event) => setBatchNote(event.target.value)}
              placeholder="例如：现场签到，名单由助教补录"
              maxLength={200}
              rows={3}
              data-testid="batch-note"
            />
            <span className="field-hint">说明必填，最多 200 字；当前 {batchNote.length}/200。</span>
          </label>
          {batchError && (
            <div className="form-error" data-testid="batch-error">
              {batchError}
            </div>
          )}
          <div className="dialog-footer">
            <button className="ghost-button" type="button" onClick={closeBatch} disabled={batchSubmitting}>
              取消
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => void submitBatch()}
              disabled={batchSubmitting}
              data-testid="batch-submit"
            >
              {batchSubmitting ? "提交中…" : "提交补录"}
            </button>
          </div>
        </div>
      </Dialog>

      <Drawer
        visible={learningRow !== null}
        header="更正学习记录"
        footer={false}
        size="460px"
        onClose={closeLearning}
      >
        {learningRow && (
          <div className="drawer-body">
            <div className="drawer-person">
              <strong>{learningRow.name}</strong>
              <span>{learningRow.company}</span>
              <span className="mono">{maskMobile(learningRow.mobile)}</span>
            </div>
            <label className="field">
              <span className="field-label">学习状态</span>
              <select
                className="input-control"
                value={learningStatus}
                onChange={(event) => setLearningStatus(event.target.value as LearningStatus)}
              >
                <option value="not_started">未开始</option>
                <option value="in_progress">学习中</option>
                <option value="completed">已完成</option>
              </select>
            </label>
            <label className="field">
              <span className="field-label">累计学时</span>
              <input
                className="input-control"
                type="number"
                min={0}
                max={24}
                step={0.5}
                value={learningHours}
                onChange={(event) => setLearningHours(Number(event.target.value))}
              />
            </label>
            <label className="field">
              <span className="field-label">
                更正说明 <em>*</em>
              </span>
              <textarea
                className="input-control textarea-control"
                value={learningNote}
                onChange={(event) => setLearningNote(event.target.value)}
                placeholder="例如：学员补交学习记录，主管复核后更正"
                maxLength={200}
                rows={4}
              />
              <span className="field-hint">说明必填，最多 200 字；当前 {learningNote.length}/200。</span>
            </label>
            {learningError && <div className="form-error">{learningError}</div>}
            <div className="dialog-footer drawer-footer">
              <button className="ghost-button" type="button" onClick={closeLearning} disabled={learningSubmitting}>
                取消
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => void submitLearning()}
                disabled={learningSubmitting}
              >
                {learningSubmitting ? "保存中…" : "保存更正"}
              </button>
            </div>
          </div>
        )}
      </Drawer>
    </main>
  );
}
