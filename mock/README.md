# mock/roster.json 数据说明

## 来源

<code>mock/roster.json</code> 由 <code>scripts/generate_roster.mjs</code> 以固定 seed=2078 生成，是可重复的演示数据，不是真实客户数据。生成器只使用标准库，输出稳定：同一 Node 版本下重复运行应逐字节一致。

重新生成：

    node scripts/generate_roster.mjs
    node scripts/check-roster.mjs

## 课期

| 字段 | 值 |
|---|---|
| id | sess-2078 |
| 课程 | 产业资源连接实战营（虚构） |
| 期次 | 第 12 期 · 名单对账场 |
| 开始 | 2026-10-18T09:00:00+08:00 |
| 结束 | 2026-10-18T17:30:00+08:00 |
| 场地 | A 座 3F 多功能厅（虚构） |
| 容量 | 140 |
| 主管 | 顾清 |

课期结束时间故意选在约 35 天前，用于演示“结束超过 30 天，经理不可更正、主管可更正”的权限边界。

## 行数与统计

| 指标 | 值 |
|---|---|
| 报名总数 | 128 |
| 候补 | 12 |
| 待审核 | 7 |
| 已通过 | 109 |
| 已签到 | 96 |
| 已通过未签到 | 13 |
| 出勤率 | 75.0%（96 ÷ 128） |
| 非会员 | 23 |

分项闭合：96 + 13 + 12 + 7 = 128。六卡始终按全课期计算，不受筛选影响。

## 行结构

| 字段 | 说明 |
|---|---|
| id | r001–r128 |
| name | 虚构姓名（16 姓 × 8 名，唯一） |
| mobile | 虚构手机号；默认展示后 4 位 |
| is_member | 是否会员 |
| company | 企业简称（24 家会员 + 8 家非会员） |
| member_level | 普通/银卡/金卡/钻石会员；非会员为空 |
| source | mini / workbench / campaign |
| status | confirmed / waitlist / pending |
| checked_in_at | ISO 时间或 null |
| learning_status | not_started / in_progress / completed |
| benefit_deducted | 是否扣权益；与签到一致 |
| manager | 负责会员经理（8 人） |
| learning_hours | 0–24；未开始可为 0 |

## 固定演示行

<code>r020</code>（第 20 行，数组下标 19）固定为：

- 姓名：陈予安
- 企业：南山培训（会员）
- 手机号：<code>13800001234</code>
- 状态：confirmed；已签到 2026-10-18T08:35:00+08:00
- 学习状态：not_started；已扣权益
- 用途：AC2 录屏中点击“查看”→显示完整号码→30 秒后恢复 <code>*******1234</code>。

## 修改数据

如果手工改 <code>roster.json</code>，必须同时满足：

1. 行数 128，id 与手机号唯一；
2. 12 候补 + 7 待审核 + 109 已通过 = 128；
3. 96 已签到，且全部来自已通过行；
4. 非会员 23；
5. r020 保持上述固定值，否则 AC2 的截图/录屏与 e2e 断言会失效。

<code>scripts/check-roster.mjs</code> 会检查这些约束，失败时 exit 1。不要用页面状态或测试输出反推数据；页面和测试都只读这份冻结数据。
