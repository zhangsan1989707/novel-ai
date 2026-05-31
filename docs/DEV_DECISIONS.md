# DEV DECISIONS

更新时间：2026-06-01

## 2026-06-01 第一阶段审计

- 决策：第二阶段先不改 Prisma schema。
  - 原因：当前目标是统一用户可见运行态；现有 `GenerationJob.payload.runtime`、`workflowStage`、章节状态已足够推导摘要。直接改 enum 会牵涉迁移、旧数据和大量 UI 调整，风险高。

- 决策：新增运行态解释层，而不是继续在页面里拼状态。
  - 原因：状态来源至少有六处，继续在组件内判断会让顶部、侧栏、控制面板、目录继续漂移。

- 决策：把 `COMPLETED` 在运行态里解释为“当前批次完成”或“全书完成”，取决于已完成章数是否达到总章数。
  - 原因：现有 pipeline 每次只生成一个 Arc/batch，job completed 不等于整本书完成。

- 决策：`NEEDS_REPAIR` 暂时作为用户态章节状态，不落库。
  - 原因：数据库 `ChapterStatus` 暂无该枚举，质量门禁失败当前落为 `REVIEWING`；先通过 validation/completion 信息和 job/runtime 映射表达。

- 决策：`canExport` 先按“至少有已完成正文且没有正在运行任务”判断。
  - 原因：导出部分章节是有价值的；但运行中导出容易让用户拿到半截状态。

- 决策：`canRepair` 先在失败、卡住、待审稿/有失败章节时开启用户态入口。
  - 原因：项目还没有统一修复 API，先让运行态准确暴露“需要处理”，下一轮再收敛修复入口。

- 决策：所有新增 API/页面代码遵循 Next.js 16 本地文档：动态路由 `params` 作为 Promise 处理，Route Handler 默认请求时执行。
  - 原因：项目 `AGENTS.md` 明确提醒 Next 版本差异，不能依赖旧版本记忆。
