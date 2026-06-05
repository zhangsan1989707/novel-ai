# DEV TODO

> 更新时间：2026-06-05

## P0：已完成 ✅

- [x] 新增统一运行态类型：`ProjectRuntimeStage`、`ChapterRuntimeStatus`、`ProjectRuntimeSummary`。
- [x] 新增纯函数构建项目运行态摘要。
- [x] `/pipeline/status` 使用统一运行态摘要。
- [x] `/pipeline/stream` 使用同一份快照构建逻辑。
- [x] `/api/novel/projects/[projectId]` 返回 `runtimeSummary`。
- [x] 项目详情页接入 `runtimeSummary`。
- [x] 流水线控制面板使用统一状态。
- [x] 增加运行态单元测试。
- [x] 修复 planner/validator Agent 测试。
- [x] 修复项目详情 500 (StoryState 兼容)。
- [x] 修复基线构建阻断 (ErrorHandler 导入)。
- [x] 更新 DEV_PROGRESS / DEV_TODO / DEV_DECISIONS 文档。

### 质量审计修复 ✅

- [x] Writer maxTokens 低估修复 (1.1 → 2.5)
- [x] continueChapter 修复上下文增强
- [x] 上一章结尾衔接机制
- [x] 质量门禁评分权重修复
- [x] Reviewer 审核结果解析修复
- [x] Polisher 未检测去 AI 味修复
- [x] Orchestrator finishReason 传递修复
- [x] 全部 12 个问题修复完成

### 章节连续性 ✅

- [x] 章节连续性锚点系统 (chapter-continuity.ts)
- [x] 串行章节流程 (serial-chapter-flow)
- [x] 开篇承诺检测 (决策钩子/系统提示/倒计时等)
- [x] 连续性审计规则扩展
- [x] Planner/Writer prompt 增强

### 文档体系 ✅

- [x] 更新 AGENTS.md
- [x] 更新 CLAUDE.md
- [x] 更新 CHANGELOG.md
- [x] 更新 TODO_ISSUES.md
- [x] 更新 DEV_PROGRESS.md
- [x] 更新 DEV_DECISIONS.md
- [x] 更新 DEV_TODO.md
- [x] 更新 README.md

---

## P1：下一步增强

- [ ] 把旧 `/api/novel/engine/generate` 标记为 legacy 或接入统一运行态。
- [ ] 为蓝图、ArcPlan、章节目录阶段补充更明确的 runtime heartbeat。
- [ ] 为待审稿章节提供统一"审核/修复/重试"下一步建议。
- [ ] 导出入口按 `runtimeSummary.canExport` 给出清晰提示。
- [ ] 为 job cancel 增加用户态"已停止"文案，避免误解为系统失败。
- [ ] 增加主链路 smoke test，使用 mock AI provider 或静态样例。

---

## P2：后续增强

- [ ] 评估是否扩展 Prisma enum，支持更细的项目/章节生产状态。
- [ ] 统一旧 BatchGenerator、单章生成页、production pipeline 的配置和入口文案。
- [ ] 增加章节级 runtime summary 列表，用于目录批量显示 queued/writing/validating/needs repair。
- [ ] 为修复流程建立独立 API 和可回放记录。
- [ ] 增加 RAG/记忆构建失败时的降级提示和测试。
- [ ] 建立长篇项目 100+ 章的离线模拟数据集。

---

## P3：未来规划

- [ ] 引入真正持久化队列或外部 worker，替代 inline/background promise。
- [ ] 为多人协作、权限、审稿流增加 RBAC。
- [ ] 建立生产级观测面板、成本预算告警和任务追踪。
- [ ] 对市场、灵感、封面、风格等外围能力做产品线整理。
- [ ] 增加完整 Playwright 端到端生成回归。
