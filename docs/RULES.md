# Current rules / 当前规则

Rules version: `growth-v2 / event-dates-v1`.

## 中文

- **一个项目一株植物**：同一 Codex 项目中的所有任务共用一株。只有已确认的具体进展才增加成长；聊天、token 数和消息长度不计分。
- **成长**：小步 +1、一段完整工作 +2、里程碑 +3。六个主体阶段阈值为 `0 / 6 / 16 / 32 / 56 / 88`；首次可运行版本、可点击原型或已验证成果才允许揭晓品种。
- **持续生长**：达到器官成长条件后，每 16 分新增一轮花或叶，每 4 分推进一个器官状态，最多同时展示 8 个，之后继续轮换。
- **日期**：新进展使用事件的 `occurredAt` 记录阶段日期 `at`，另存 `recordedAt` 作为接收时间。离线补收不改写事件日期。已有成果只能依据可访问的真实证据补充 `achievedAt`；不知道就留空。
- **旧记录**：历史存档只能提供标明来源的 `observedAt`，不能伪装成精确成果日期。铅笔修改保存在 `journalDates`，保留原事件和分数。
- **校准**：补同步使用成长模型 2 和核对过的阶段/日期；不按聊天长度推断成果，不捏造历史。校准基线避免延迟事件重复抬高成长。
- **灵感独立计分**：新想法 +1、解决实际取舍的决定 +2；每项目每天最多 3 次。普通进展不奖励灵感，只有灵感的项目不会凭空种下植物。
- **换盆与装饰**：盆样式按单株选择，花架和前景装饰全园通用；预览不扣费，不改变存档。
- **自启动**：新安装默认关闭。用户可在右下角隐私说明左侧开关随 Codex 启动，点问号查看说明；手动关闭项目园后不会循环重开。

## English

- **One plant per project.** Tasks in the same Codex project share a plant. Only confirmed, concrete progress grows it. Chat length, tokens and message counts do not earn progress.
- **Growth:** small +1, medium +2, milestone +3. Six body-stage thresholds: `0 / 6 / 16 / 32 / 56 / 88`. Discovery requires a first runnable version, clickable prototype or validated result.
- **Continued growth:** once organ growth begins, another flower/leaf cycle starts every 16 points, with a phase every 4 points. Up to 8 organs are displayed before cycling through new ones.
- **Dates:** `occurredAt` becomes the stage's event date `at`; `recordedAt` separately records receipt. Offline delivery preserves the event date. Earlier achievements require accessible evidence for `achievedAt`; unknown dates stay unknown.
- **Legacy records:** historical saves provide only a source-labelled `observedAt`. Pencil edits live in `journalDates` without rewriting the original event or score.
- **Calibration:** model 2 accepts reviewed stages and dates, never inferred achievements from conversation volume. Its baseline prevents delayed events from double-counting growth already represented by calibration.
- **Inspiration is separate:** idea +1, decision +2, at most 3 awards per project per day. Normal progress earns no inspiration; insight alone does not create a plant.
- **Decorations:** pots are selected per plant; shelves and foreground decorations apply garden-wide. Previews do not spend inspiration or change the save.
- **Startup:** off for a fresh installation. The footer toggle beside Privacy enables or disables launch with Codex; its question-mark button explains the behavior. A manual close does not cause a restart loop.
