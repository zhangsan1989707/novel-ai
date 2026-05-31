# DEV TODO

更新时间：2026-06-01

## P0：必须马上修

- [ ] 新增统一运行态类型：`ProjectRuntimeStage`、`ChapterRuntimeStatus`、`ProjectRuntimeSummary`。
- [ ] 新增纯函数构建项目运行态摘要，不依赖 React，不直接写数据库。
- [ ] 让 `/api/novel/projects/[projectId]/pipeline/status` 使用统一运行态摘要。
- [ ] 让 `/api/novel/projects/[projectId]/pipeline/stream` 使用同一份快照构建逻辑。
- [ ] 让 `/api/novel/projects/[projectId]` 返回 `runtimeSummary`。
- [ ] 项目详情页顶部 badge 使用 `runtimeSummary.stageLabel`。
- [ ] 流水线控制面板使用 `runtimeSummary.canStart/canPause/canResume/canRepair/canExport`。
- [ ] 侧栏进度优先展示 `runtimeSummary.overallProgress`。
- [ ] 章节目录识别当前实时章节，展示更清晰的运行中状态。
- [ ] 增加运行态单元测试。
- [ ] 更新 `docs/DEV_PROGRESS.md`、`docs/DEV_TODO.md`、`docs/DEV_DECISIONS.md`。

## P1：下一步增强

- [ ] 把旧 `/api/novel/engine/generate` 标记为 legacy 或接入统一运行态。
- [ ] 合并 `/pipeline/status` 与 `/pipeline/stream` 中重复的章节统计逻辑。
- [ ] 为蓝图、ArcPlan、章节目录阶段补充更明确的 runtime heartbeat。
- [ ] 为待审稿章节提供统一“审核/修复/重试”下一步建议。
- [ ] 导出入口按 `runtimeSummary.canExport` 给出清晰提示。
- [ ] 为 job cancel 增加用户态“已停止”文案，避免误解为系统失败。
- [ ] 增加主链路 smoke test，使用 mock AI provider 或静态样例。

## P2：下下步增强

- [ ] 评估是否扩展 Prisma enum，支持更细的项目/章节生产状态。
- [ ] 统一旧 BatchGenerator、单章生成页、production pipeline 的配置和入口文案。
- [ ] 增加章节级 runtime summary 列表，用于目录批量显示 queued/writing/validating/needs repair。
- [ ] 为修复流程建立独立 API 和可回放记录。
- [ ] 增加 RAG/记忆构建失败时的降级提示和测试。
- [ ] 建立长篇项目 100+ 章的离线模拟数据集。

## P3：以后再做

- [ ] 引入真正持久化队列或外部 worker，替代 inline/background promise。
- [ ] 为多人协作、权限、审稿流增加 RBAC。
- [ ] 建立生产级观测面板、成本预算告警和任务追踪。
- [ ] 对市场、灵感、封面、风格等外围能力做产品线整理。
- [ ] 增加完整 Playwright 端到端生成回归。

