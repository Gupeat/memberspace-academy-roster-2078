# 验收截图与录屏索引

本目录由以下命令生成：

    pnpm screens   # 截图
    pnpm capture   # 30 秒 WebM 录屏

所有数据为虚构演示数据；手机号默认脱敏。

| 文件 | 用途 | 对应 AC |
|---|---|---|
| roster-stats.png | 1440×6664 全页：六卡 128/12/7/96/75.0%/23、128 行 10 列名单、权限提示 | AC1 |
| mobile-no-permission.png | 只读审计员身份：手机号脱敏、表格无“查看”按钮 | AC2 |
| reveal-mobile-before.png | 点击查看后 r020 显示完整 <code>13800001234</code> 与 30 秒倒计时 | AC2 |
| reveal-mobile-poster.png | 点击查看前的页面帧（默认 <code>*******1234</code>，录屏起始画面） | AC2 |
| reveal-mobile.webm | 真实 30 秒：完整号码 → 倒计时 → 自动恢复脱敏 | AC2 |
| reveal-mobile-after.png | 30 秒后恢复 <code>*******1234</code> | AC2 |
| batch-attendance.png | 勾选 2 行、说明留空、红字提示、批量请求计数 0 | AC3 |
| batch-attendance-success.png | 填写说明后提交成功、批量请求计数 1 | AC3 |

<code>reveal-mobile.webm</code> 为浏览器 MediaRecorder 生成的 VP9 WebM，不是 MP4；本机没有 ffmpeg，改名成 MP4 会造成误导，因此保持真实格式。录制步骤约 36–41 秒，成片约 30.4 秒/33 帧；WebM 不写 Duration 元素，部分播放器显示 Infinity，完整播放仍覆盖 30 秒倒计时与恢复脱敏。录屏脚本会校验 WebM 文件头与 EBML 帧/时间戳，并在结束时断言手机号已恢复脱敏。

截图哈希与完整步骤见 <code>artifacts/ACCEPTANCE.md</code>（运行 <code>pnpm verify</code> 后生成）。
