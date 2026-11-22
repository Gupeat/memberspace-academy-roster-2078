# 验收记录 · 课期报名名单与出勤补录页

- 生成时间（UTC）：2026-11-22T08:33:19Z
- 运行环境：Node v24.21.0 / win32 x64
- 证据目录：仓库根（docs/screens 与 artifacts）
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
- 录屏命令：node scripts/capture-reveal.mjs（真实时间逐秒截帧，MediaRecorder 生成 WebM）
- 结果：PASS，exit=0
- 证据：docs/screens/reveal-mobile.webm；reveal-mobile-before.png / reveal-mobile-after.png 为前后帧。
- 成片探针：33 帧，最后 cluster 30147 ms；录制步骤约 41.39 秒；WebM 不写 Duration 元素，部分播放器显示 Infinity，但完整播放可覆盖 30 秒倒计时并恢复掩码。
- 回归输出：

~~~text
➜  Local:   http://127.0.0.1:4173/
{
  "ok": true,
  "mode": "fast-clock",
  "checks": [
    "AC1 六卡与 128 行一致",
    "AC2 查看后显示完整手机号",
    "AC2 30 秒窗口到期后恢复脱敏（假时钟）",
    "AC3 空说明被拒绝且 mock 请求数为 0",
    "有效补录请求数为 1"
  ],
  "screenshots": []
}
~~~

### AC3 批量补录未填说明时无法提交（截图）

- 回归命令：node scripts/e2e.mjs --fast
- 断言：勾选 2 个“已通过”行 → 打开批量补录 → 说明留空 → 出现 batch-error；mock-batch-count 仍为 0；弹窗内 batch-dialog-count 仍为 0；填写说明后提交成功，批量请求数变为 1、已选变为 0。
- 截图：docs/screens/batch-attendance.png（空说明红字、计数 0）、docs/screens/batch-attendance-success.png（提交成功）。

## 全部步骤

| 步骤 | 说明 | exit | 耗时 | 日志 |
| --- | --- | --- | --- | --- |
| check | 独立对账 mock 数据（六卡六值 + 分项闭合） | 0 | 0.17s | artifacts/logs/check.log |
| build | 生产构建 | 0 | 61.09s | artifacts/logs/build.log |
| typecheck | TypeScript 类型检查 | 0 | 6.72s | artifacts/logs/typecheck.log |
| unit | 领域逻辑单测 | 0 | 2.80s | artifacts/logs/unit.log |
| e2e-fast | AC 回归（假时钟验证 30 秒恢复脱敏） | 0 | 6.84s | artifacts/logs/e2e-fast.log |
| screens | AC 截图（六卡 / 手机号查看 / 批量补录空说明） | 0 | 10.43s | artifacts/logs/screens.log |
| video | AC2 真实 30 秒录屏 | 0 | 41.39s | artifacts/logs/video.log |

## 证据文件 SHA-256

| 文件 | 字节 | SHA-256 |
| --- | --- | --- |
| docs/screens/roster-stats.png | 968323 | 43ac7a95e814181b6371fc972bc8fa1cde963073c55aa5edfdd697761c2e34fd |
| docs/screens/reveal-mobile-before.png | 172176 | d6c27b34a20c9fa9ed3abdc8f8ed7bfa73e40930e4dcd2dea972296acd156f54 |
| docs/screens/reveal-mobile-poster.png | 115429 | f1e9bac9ead68fcd9e4815b9d3c626765535fc82a4aa534e8b77c4e5f6ad9adb |
| docs/screens/reveal-mobile-after.png | 115541 | d769cef088e8db4fbc32949b8ed33078ac41d41e1da8d990e578bb66cbce2354 |
| docs/screens/reveal-mobile.webm | 261335 | 7b4723198b4cf7b8b85148571791fa4511c693deedc1d3addafbf42e58f13a19 |
| docs/screens/batch-attendance.png | 168637 | 3f53c765aaf25dd15d45b524d3383d18fb911731c2640ee49ef32afd28c208cc |
| docs/screens/batch-attendance-success.png | 200201 | 4cacb0deb7a38a7dea15e3748c1d255c805ff4a1e34cc6e6b5c5502d6af8b698 |

## 复现

~~~powershell
# 在仓库根目录执行
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm verify
~~~

pnpm verify 依次运行对账、构建、类型检查、单测、AC 回归、截图和真实 30 秒录屏；任何一步失败即退出 1。
