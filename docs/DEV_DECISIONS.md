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

## 2026-06-01 第二阶段实现

- 决策：新增 `project-pipeline-snapshot.ts`，由 API status 和 SSE stream 共用，而不是继续维护两份相似代码。
  - 原因：状态漂移的主要来源之一就是 status 和 stream 各自计算章节数、job、runtime。

- 决策：项目详情 API 通过额外读取 pipeline snapshot 返回 `runtimeSummary`。
  - 原因：详情页首屏需要统一运行态；额外查询比把运行态逻辑塞进巨大 project route 更可回滚。

- 决策：`runtimeSummary.canStart` 包含模型绑定、蓝图确认、ArcPlan 确认、维护任务、任务运行态。
  - 原因：按钮禁用规则必须从统一模型来，避免顶部按钮和控制面板不一致。

- 决策：当维护任务 active 时，详情页优先使用项目详情 API 中带 maintenance 语义的 `runtimeSummary`。
  - 原因：pipeline status 端点不读取维护任务，不能覆盖初始化中的项目级运行态。

- 决策：修复 `npm run build` 暴露的 `ErrorHandler` 导入歧义，但只改错误处理入口和类型收窄。
  - 原因：`src/lib/errors.ts` 与 `src/lib/errors/` 目录同名导致 `./errors` 解析到旧文件，阻断构建；改为显式导入 `./errors/handler`、`./errors/types` 最小且可回滚。

- 决策：保留本地 `.env` 中 `NODE_TLS_REJECT_UNAUTHORIZED=0` 引发的构建告警，不修改环境配置。
  - 原因：用户明确禁止修改真实环境配置；该告警不阻断本阶段验收。

- 决策：修复 planner/validator 测试与当前 Agent 接口的偏差，并让 `plannerAgent` 把直接传入的角色档案合并进记忆上下文。
  - 原因：完整测试发现旧测试仍按历史接口断言；角色档案是长篇一致性的核心输入，直接忽略会削弱章节策划稳定性。
