# DEV DECISIONS

> 更新时间：2026-06-05

## 2026-06-05 文档体系更新

- 决策：更新所有核心文档，反映项目当前真实状态。
  - 原因：项目自 2026-06-01 以来经历了质量审计修复、章节连续性增强、开发基础设施建设等多个阶段，旧文档已严重过时。

- 决策：AGENTS.md 从简单的 Next.js 警告升级为完整的 Agent 开发指南。
  - 原因：项目已达 219 个 TS 文件 + 135 个 API 路由的规模，需要明确的开发约束和架构规则。

- 决策：README.md 更新技术栈和功能列表，反映 11 种 Agent、8 家 AI 提供商、长篇工业化控制的当前状态。
  - 原因：旧 README 仍声称 6 家 AI 提供商和 5 种 Agent。

---

## 2026-06-01 第一阶段审计

- 决策：第二阶段先不改 Prisma schema。
  - 原因：当前目标是统一用户可见运行态；现有 `GenerationJob.payload.runtime`、`workflowStage`、章节状态已足够推导摘要。直接改 enum 会牵涉迁移、旧数据和大量 UI 调整，风险高。

- 决策：新增运行态解释层，而不是继续在页面里拼状态。
  - 原因：状态来源至少有六处，继续在组件内判断会让顶部、侧栏、控制面板、目录继续漂移。

- 决策：把 `COMPLETED` 在运行态里解释为"当前批次完成"或"全书完成"，取决于已完成章数是否达到总章数。
  - 原因：现有 pipeline 每次只生成一个 Arc/batch，job completed 不等于整本书完成。

- 决策：`NEEDS_REPAIR` 暂时作为用户态章节状态，不落库。
  - 原因：数据库 `ChapterStatus` 暂无该枚举，质量门禁失败当前落为 `REVIEWING`；先通过 validation/completion 信息和 job/runtime 映射表达。

- 决策：`canExport` 先按"至少有已完成正文且没有正在运行任务"判断。
  - 原因：导出部分章节是有价值的；但运行中导出容易让用户拿到半截状态。

- 决策：`canRepair` 先在失败、卡住、待审稿/有失败章节时开启用户态入口。
  - 原因：项目还没有统一修复 API，先让运行态准确暴露"需要处理"，下一轮再收敛修复入口。

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

## 2026-06-01 项目详情 500 兼容修复

- 决策：用户详情页和主链路健康检查不再用 `storyState: true` 全量读取，而是只 select 当前页面和流程真正需要的字段。
  - 原因：旧本地数据库可能缺少新增列 `story_states.emotionalArcSummaries`；全量读取会让项目详情 API 直接 500。主链路应优先可打开、可诊断，再由迁移或脚本补齐扩展字段。

- 决策：不自动执行未跟踪的 `fix-db.js`，也不把它纳入提交。
  - 原因：它属于本地修库辅助脚本，可能是用户现场排障产物；本次修复只提交应用层兼容，不改真实数据库和环境配置。

- 决策：保留 Prisma 迁移文件，不回退 `emotionalArcSummaries` 字段设计。
  - 原因：字段本身服务于长篇情绪弧摘要，问题在于旧库漂移时用户首屏不应因扩展字段不可用而崩溃。

## 2026-06-01 质量审计修复决策

- 决策：Writer maxTokens 从 `targetWordCount * 1.1` 提升到 `targetWordCount * 2.5`。
  - 原因：中文 LLM 中 1 个中文字符 ≈ 1.5-2 个 token，1.1 系数导致 3000 字目标只能生成 1650-2200 字。这是章节截断问题的直接根因。

- 决策：continueChapter 修复上下文从"最后 500 字"升级为"完整大纲 + 角色列表 + 最近章节摘要"。
  - 原因：只传最后 500 字导致修复后的续写内容与全文风格、情节不一致。

- 决策：章节开篇必须显式处理上一章结尾的 hook/承诺。
  - 原因：摘要 ≠ 结尾，L1 摘要无法捕捉悬崖式结尾的精髓。必须在 planner/writer prompt 中注入上一章结尾原文。

## 2026-06-02 章节连续性 P0 设计

- 决策：使用 lightweight `ChapterContinuity` layer，不新建数据库表。
  - 原因：P0 目标是在现有基础设施上阻止明显跨章节断裂，不需要完整 Novel Bible。

- 决策：连续性锚点包含 `mustContinueFrom`、`forbiddenJumps`、`protagonistName` 等关键约束。
  - 原因：Web novel 章节最常见的断裂问题是主角名字漂移、场景无过渡跳跃、资源凭空出现。

- 决策：确定性字符串/启发式检查优先，LLM-based review 作为 P1 增强。
  - 原因：P0 需要可靠阻塞行为，不能被 LLM 不确定性影响。

## 2026-06-03 串行章节流程设计

- 决策：上一章结尾如果有决策钩子、系统提示、倒计时、门/到达等 hook，下一章开篇必须处理。
  - 原因：读者预期上一章结尾的"请宿主决策"会在下一章看到决策过程，直接跳到新场景是明显的阅读断裂。

- 决策：开篇不需要完全解决 hook，可以加深或推迟，但推迟必须是显式的。
  - 原因：网文创作中有些 hook 是跨章节的，但读者需要知道"作者没忘，只是还在铺垫"。

- 决策：增加 `serial_flow_break` 审计规则，对决策/系统 hook 标记 critical，对弱 hook 标记 major。
  - 原因：不同类型的 hook 对连续性影响不同，需要分级处理。
