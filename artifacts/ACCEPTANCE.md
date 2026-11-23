# 验收记录 · 课期报名名单与出勤补录页

- 生成时间（UTC）：2026-11-23T23:45:33Z
- 运行环境：Node v24.21.0 / win32 x64
- 证据目录：仓库根（docs/screens 与 artifacts）
- 开始时间（UTC）：2026-11-23T23:43:39Z
- 总体结果：PASS
- 日志与输出中的本机仓库路径已替换为 <repo>；端口仅为本机预览 127.0.0.1:4173。

## 逐条验收

### AC1 统计卡数字与 mock 数据手算结果一致（截图）

- 命令：node scripts/check-roster.mjs（独立读取 mock/roster.json 重算，不复用页面状态）
- 结果：PASS，exit=0
- 六卡：报名数 128、候补数 12、待审核数 7、签到数 96、出勤率 75.0%、非会员数 23。
- 手算：96 ÷ 128 = 75.0%；96 已签到 + 13 已通过未签到 + 12 候补 + 7 待审核 = 128，四类互斥且闭合。
- 截图：docs/screens/roster-stats.png（1440×6664 全页，含六卡与 128 行名单）。
- 对账输出：

~~~text
出勤率 | checkedIn / registered | 75.0% | 75.0% | PASS
非会员数 | is_member=false | 23 | 23 | PASS
分项闭合：签到 96 + 已通过未签到 13 + 候补 12 + 待审核 7 = 128
r020 脱敏：*******1234
{
  "ok": true,
  "stats": {
    "registered": 128,
    "waitlist": 12,
    "pending": 7,
    "checkedIn": 96,
    "attendanceRate": "75.0",
    "nonMember": 23
  },
  "confirmed": 109,
  "confirmedNotChecked": 13,
  "revealRow": "r020"
}
~~~

### AC2 点击查看手机号，30 秒后恢复脱敏（录屏）

- 回归命令：node scripts/e2e.mjs --fast（假时钟 fast-forward 31 秒）
- 结果：PASS，exit=0
- 权限断言：切换“只读审计员”后手机号仍为 *******1234，表格内“查看”按钮数为 0；截图 docs/screens/mobile-no-permission.png。
- 录屏命令：node scripts/capture-reveal.mjs（真实时间逐秒截帧，MediaRecorder 生成 WebM）
- 结果：PASS，exit=0
- 证据：docs/screens/reveal-mobile.webm；reveal-mobile-before.png / reveal-mobile-after.png 为前后帧。
- 成片探针：33 帧，末帧时间戳 35845 ms（约 35.8 秒）；录制步骤约 40.32 秒；WebM 不写 Duration 元素，部分播放器显示 Infinity，但完整播放可覆盖 30 秒倒计时并恢复掩码。
- 回归输出：

~~~text
➜  Local:   http://127.0.0.1:4173/
{
  "ok": true,
  "mode": "fast-clock",
  "checks": [
    "AC1 六卡与 128 行一致",
    "AC2 只读审计员不渲染查看按钮、不可勾选/批量补录、切换后更正抽屉关闭且手机号保持脱敏",
    "AC2 查看后显示完整手机号",
    "AC2 30 秒窗口到期后恢复脱敏（假时钟）",
    "AC3 空说明被拒绝且 mock 请求数为 0",
    "有效补录请求数为 1，签到数 96→98，已签到 r001 时间/学时不变"
  ],
  "screenshots": []
}
~~~

### AC3 批量补录未填说明时无法提交（截图）

- 回归命令：node scripts/e2e.mjs --fast
- 断言：勾选 2 个“已通过”且未签到行 → 打开批量补录 → 说明留空 → 出现 batch-error；mock-batch-count 仍为 0；弹窗内 batch-dialog-count 仍为 0；填写说明后提交成功，批量请求数变为 1、已选变为 0、签到数 96→98、出勤率 76.6%，已签到 r001 的签到时间与学时不变。
- 截图：docs/screens/batch-attendance.png（空说明红字、计数 0）、docs/screens/batch-attendance-success.png（提交成功）。

## 全部步骤

| 步骤 | 说明 | exit | 耗时 | 日志 |
| --- | --- | --- | --- | --- |
| check | 独立对账 mock 数据（六卡六值 + 分项闭合） | 0 | 0.15s | artifacts/logs/check.log |
| build | 生产构建 | 0 | 45.48s | artifacts/logs/build.log |
| typecheck | TypeScript 类型检查 | 0 | 5.67s | artifacts/logs/typecheck.log |
| unit | 领域逻辑单测 | 0 | 3.00s | artifacts/logs/unit.log |
| e2e-fast | AC 回归（假时钟验证 30 秒恢复脱敏） | 0 | 7.84s | artifacts/logs/e2e-fast.log |
| screens | AC 截图（六卡 / 手机号查看 / 批量补录空说明） | 0 | 12.00s | artifacts/logs/screens.log |
| video | AC2 真实 30 秒录屏 | 0 | 40.32s | artifacts/logs/video.log |

## 证据文件 SHA-256

| 文件 | 字节 | SHA-256 |
| --- | --- | --- |
| docs/screens/roster-stats.png | 968302 | 0133463a790e30a5c2d7a26112dd818d3cf7fa3f0a049ffcd89437755fd3495f |
| docs/screens/mobile-no-permission.png | 921830 | 0521dbeeadb206c45909f5a454590141d194020eefef8610d54b0ffb14145f2c |
| docs/screens/reveal-mobile-before.png | 171969 | 4d507085336ebff46e6cdd82fa3632dfd8712333f1139f0c2f680ad46ad059bf |
| docs/screens/reveal-mobile-poster.png | 115451 | 4caba52b813e590dd2f5b43044023a6391a2c9ec321cd18b20db966e57bc9083 |
| docs/screens/reveal-mobile-after.png | 115569 | 223b99136790357ed7dbcf570167d3490b2ada9a4f75d988de0438399325a386 |
| docs/screens/reveal-mobile.webm | 289409 | 47ea1cd785b16376bbd228428c57036a40efb9feb0dfc6d26c900cd5d1fb320d |
| docs/screens/batch-attendance.png | 172046 | 7f108f88232b8a905c7093f62a9271a9ac18f24ef0fe306c64e44c4f877b5c7e |
| docs/screens/batch-attendance-success.png | 204987 | 42aac3968ac3032209c8905b7f43b7b07160cb76818d4d7c17c19be92d5614e9 |

## 复现

~~~powershell
# 在仓库根目录执行
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm verify
~~~

pnpm verify 依次运行对账、构建、类型检查、单测、AC 回归、截图和真实 30 秒录屏；任何一步失败即退出 1。
