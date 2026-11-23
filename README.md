# 课期报名名单与出勤补录页 · #2078【S6-ACAD-049】

工作台「学院 / 课期 / 报名名单」页：六张统计卡、128 行报名名单、手机号查看与 30 秒自动脱敏、报名状态/会员/签到筛选、批量补录出勤、单行学习记录更正、课期结束超过 30 天的权限限制。纯前端 React + TypeScript + TDesign，接口走本地内存 mock；企业、姓名、手机号、课期均为虚构数据。演示身份除会员经理、主管外，新增无手机号查看权限的“只读审计员”。

任务原文写“9 个业务列 + 单独手机号列”，本页按 10 列实现（9 个业务列 + 手机号），并在本文件说明，避免把手机号塞进企业列。

## 1. 技术栈

| 项 | 版本 / 说明 |
|---|---|
| React / React DOM | 18.3.1 |
| React Router | 6.30.1 |
| TypeScript | 5.6.3 |
| Vite | 5.4.11 |
| TDesign React | 1.18.6 |
| Vitest | 2.1.8 |
| playwright-core | 1.65.1 |
| pnpm | 11.28.5（<code>pnpm-workspace.yaml</code> 用 <code>allowBuilds</code> 允许 esbuild 构建） |
| Node.js | v24.21.0（验证环境） |
| 截图/录屏浏览器 | Microsoft Edge（本机安装；脚本也支持 Chrome/Chromium） |
| 录屏格式 | WebM（VP9），由浏览器 MediaRecorder 生成，不依赖 ffmpeg |

## 2. 目录

    repo/
      src/
        domain/types.ts              # RosterRow / SessionInfo / 枚举 / 标签
        domain/stats.ts              # 六卡统计、筛选、脱敏、倒计时、批量与单行校验/应用
        domain/permissions.ts        # 30 天更正窗口 + 只读审计员权限
        api/mockApi.ts               # 内存 mock、请求日志、成功才计数
        pages/RosterPage.tsx         # 页面编排：六卡、10 列、筛选、弹窗、抽屉、权限
        pages/ActivitiesPage.tsx     # 待审核“审核”跳转的活动模块占位
        styles.css                   # 运营后台视觉
        domain/stats.test.ts         # 11 例领域测试
        domain/permissions.test.ts   # 30 天边界 + 只读审计员测试
      scripts/
        generate_roster.mjs          # 确定性生成 mock/roster.json（seed=2078）
        check-roster.mjs             # 独立重算六值并对账（AC1）
        e2e.mjs                      # AC1/AC2/AC3 回归；--fast 假时钟；--capture 截图
        capture-reveal.mjs           # AC2 真实 30 秒 WebM 录屏
        build.mjs                    # 构建（固定 TEMP，避免 Windows esbuild 临时目录问题）
        run_acceptance.mjs           # 一键验收：对账/构建/类型/单测/e2e/截图/录屏
      mock/roster.json               # 冻结 mock 数据（128 行）
      docs/screens/                  # 截图、前后帧、30 秒录屏
      docs/ROSTER-HANDCALC.md         # 六卡手算与复跑口径
      artifacts/                     # 验收报告与日志；clean-room/ 是干净副本复跑证据
      README.md

## 3. 安装与运行

    pnpm install --frozen-lockfile
    pnpm dev        # http://127.0.0.1:5173
    pnpm build
    pnpm preview    # http://127.0.0.1:4173

页面路由：<code>/academy/sessions/sess-2078/roster</code>；根路径会自动跳转。活动模块占位：<code>/academy/activities</code>。

## 4. 测试与验收

    pnpm typecheck
    pnpm test
    pnpm check       # 独立对账 mock 数据（AC1）
    pnpm e2e         # 假时钟回归 AC1/AC2/AC3
    pnpm screens     # 生成 AC1/AC2/AC3 截图
    pnpm capture     # 真实 30 秒录屏（AC2）
    pnpm verify      # 一键跑全部步骤，写 artifacts/ACCEPTANCE.md

当前基线：2 个测试文件、15 例领域测试；<code>pnpm check</code> 六卡对账 PASS；<code>pnpm e2e</code> 三条 AC 全 PASS；<code>pnpm verify</code> 总体 PASS，生成 <code>artifacts/ACCEPTANCE.md</code>、<code>artifacts/acceptance.json</code> 与 <code>artifacts/logs/</code>。

干净副本复跑：把源码复制到空目录（排除 <code>node_modules</code>、<code>dist</code>、<code>artifacts</code>、<code>.esbuild-tmp</code>），执行 <code>pnpm install --offline --frozen-lockfile</code> 与 <code>node scripts/run_acceptance.mjs</code>，同一套步骤 PASS；证据在 <code>artifacts/clean-room/</code>。<code>--offline</code> 依赖本机 pnpm store，全新机器可去掉该参数让 pnpm 联网解析。

## 5. 验收项对照

| # | 任务要求 | 实现与证据 |
|---|---|---|
| AC1 | 统计卡数字与 mock 数据手算结果一致（截图） | 报名 128、候补 12、待审核 7、签到 96、出勤率 75.0%、非会员 23；96÷128=75.0%，96+13+12+7=128；<code>scripts/check-roster.mjs</code> 独立重算；手算底稿 <code>docs/ROSTER-HANDCALC.md</code>；截图 <code>docs/screens/roster-stats.png</code>（1440×6664 全页） |
| AC2 | 点击查看手机号，30 秒后恢复脱敏（录屏） | r020 默认 <code>*******1234</code>；有权限的经理/主管点击“查看”显示 <code>13800001234</code>，按钮倒计时 30→1，30 秒后恢复；只读审计员不渲染“查看”按钮且号码始终脱敏（<code>docs/screens/mobile-no-permission.png</code>）；<code>docs/screens/reveal-mobile.webm</code> 为真实时间录屏（VP9），前后帧 <code>reveal-mobile-before.png</code> / <code>reveal-mobile-after.png</code>；<code>pnpm e2e</code> 用假时钟 fast-forward 31 秒做回归 |
| AC3 | 批量补录未填说明时无法提交（截图） | 勾选 2 个“已通过”行 → 批量补录 → 说明留空 → 出现红字，<code>mock-batch-count</code> 保持 0，弹窗计数保持 0；填写说明后成功，批量请求数变为 1；截图 <code>docs/screens/batch-attendance.png</code>（空说明）与 <code>batch-attendance-success.png</code>（成功） |

## 6. 页面与业务规则

### 6.1 统计卡

六卡始终按全课期计算，不随筛选变化；筛选只影响表格行。统计口径：报名数=全部行数；候补数=status=waitlist；待审核数=status=pending；签到数=checked_in_at 非空；出勤率=签到数÷报名数（一位小数）；非会员数=is_member=false。

### 6.2 表格列（10 列）

姓名、企业简称（非会员带标签）、手机号、会员等级、报名来源、报名状态、签到时间、学习记录状态（含学时与“更正”）、是否扣权益、负责会员经理。

### 6.3 手机号查看

默认只显示 <code>*******</code> + 后 4 位；会员经理和主管可点“查看”，调用 <code>revealMobile</code> 返回 30 秒有效期；页面按 500ms 刷新剩余秒数，到期自动恢复脱敏。只读审计员（<code>auditor</code>）没有查看权限，该身份下不渲染“查看”按钮，手机号始终脱敏。切换身份会清除已查看状态。角色切换只用于演示权限，不是真实 IAM。

### 6.4 筛选

报名状态（全部/已通过/候补/待审核）、是否会员（全部/会员/非会员）、是否签到（全部/已签到/未签到）三组可叠加；“重置筛选”恢复全部。

### 6.5 批量补录出勤

只处理“已通过”行；可多选；补录结果支持“已签到/请假/未到场”；学时 0–24；说明必填、最多 200 字。前端校验通过后才调用 mock；空说明时按钮不提交、请求计数不增加。已签到会写入签到时间并置“已扣权益”；请假/未到场清空签到时间且不扣权益。

### 6.6 单行学习记录更正

行内“更正”打开抽屉，可改学习状态、学时、说明；说明必填、最多 200 字；保存成功后行内状态与学时更新。

### 6.7 30 天权限

课期结束时间 <code>2026-10-18T17:30:00+08:00</code>。结束超过 30 天（即晚于 <code>2026-11-17T17:30:00+08:00</code>）后，会员经理的“更正”按钮禁用，页面顶部显示“课期结束超过 30 天，需主管权限”；主管不受限。演示页默认以经理身份进入，并提供“切换为主管（演示）”。边界规则为 <code>now &lt;= endsAt + 30 天</code> 仍可更正，超过 1ms 即禁用。只读审计员在任何时间都无更正权限。

### 6.8 待审核行

“审核”按钮跳转 <code>/academy/activities</code> 占位页，说明审核在活动模块处理；本页不实现审核动作，符合任务范围。

## 7. Mock 数据与契约

<code>mock/roster.json</code> 由 <code>scripts/generate_roster.mjs</code> 以 seed=2078 确定性生成：128 行、24 家会员企业 + 8 家非会员企业、8 位会员经理、4 个会员等级、3 种报名来源。r020 固定为“已通过 + 已签到 + 会员”，手机号 <code>13800001234</code>，用于 AC2。

六值：报名 128、候补 12、待审核 7、签到 96、出勤率 75.0%、非会员 23；已通过 109，其中已签到 96、已通过未签到 13；12+7+109=128。

<code>src/api/mockApi.ts</code> 提供：

- <code>loadRoster()</code>：读取内存 rows；
- <code>revealMobile(rowId)</code>：返回完整手机号与 30 秒有效期的 expiresAt；
- <code>batchAttendance(input)</code>：先校验，再应用；成功才写请求日志；
- <code>updateLearningRecord(rowId, input)</code>：单行更正；
- <code>getMockRequestCount(kind?)</code> / <code>getMockRequestLog()</code> / <code>currentRows()</code>：验收断言与调试。

刷新页面恢复种子数据。没有真实 HTTP 请求；若要接后端，替换 <code>src/api/mockApi.ts</code> 的五个导出函数即可，页面不依赖传输层。

## 8. 截图 / 录屏

- 截图：Playwright + Edge headless，e2e 视口 1440×1100；<code>roster-stats.png</code> 为全页 1440×6664；<code>mobile-no-permission.png</code> 为只读审计员身份下的全页截图（无“查看”按钮）。
- 录屏：<code>scripts/capture-reveal.mjs</code> 在页面注入 detached canvas，逐秒用 Playwright 截帧并 drawImage，<code>canvas.captureStream(1)</code> + MediaRecorder 生成 WebM；不依赖 ffmpeg、不修改 DOM 可见结构。录制步骤约 36–41 秒（含启动与收尾），成片约 30.4 秒/33 帧，覆盖完整 30 秒倒计时与恢复脱敏；WebM 不写 Duration 元素，部分播放器会显示 Infinity，完整播放不受影响。
- 录屏不是 MP4：本机无 ffmpeg，WebM 是浏览器原生可播放格式；README 与验收记录均如实写明，不把 GIF/WebM 改名成 MP4。

## 9. 已知限制

- 纯前端演示：无真实后端、数据库、IAM、工作台、活动系统或短信；刷新即恢复种子数据。
- 角色切换是页面内演示开关，不是真实权限系统；生产应由服务端鉴权并下发 <code>canRevealMobile</code> / <code>canCorrect</code>。
- 手机号、姓名、企业、课期均为虚构；手机号仅用于演示脱敏，不指向真实个人。
- 仅桌面工作台布局（1280–1440 宽优先）；未做移动端、暗色主题、多语言。
- 录屏需要本机 Edge/Chrome/Chromium；脚本按 <code>EDGE_PATH</code>/<code>CHROME_PATH</code>、PATH 与系统安装目录解析，不写死绝对路径。
- 单测覆盖领域规则与 30 天边界；像素级视觉回归不在范围内，视觉证据为人工复核截图。

## 10. 安全与数据

- 仓库不含 API Key、Token、平台凭据、真实客户数据或本机绝对路径。
- 页面不发起外部请求；mock 数据在内存中，刷新重置。
- 截图和录屏中的手机号均为虚构演示数据；默认视图始终脱敏。

## 11. 失败排查

- <code>pnpm install</code> 报 esbuild 构建被忽略：确认 <code>pnpm-workspace.yaml</code> 中 <code>allowBuilds: { esbuild: true }</code> 存在，且 <code>node</code> 在 PATH 上（esbuild 的 postinstall 会调用 <code>node</code>），再执行 <code>pnpm rebuild esbuild</code>。
- e2e/录屏报找不到浏览器：设置 <code>$env:EDGE_PATH</code> 或 <code>$env:CHROME_PATH</code>，或安装 Chrome/Chromium。
- 端口 4173 被占用：先结束旧 <code>vite preview</code> 进程；脚本使用 <code>--strictPort</code>，不会静默换端口。
- 录屏文件很小或打不开：确认浏览器支持 <code>MediaRecorder</code> 的 WebM；脚本会检查文件头 <code>1a45dfa3</code> 并在失败时退出 1。
