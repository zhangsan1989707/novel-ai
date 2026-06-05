# DEV PROGRESS

> 更新时间：2026-06-05

---

## 2026-06-05 文档更新

已完成：
- 更新 AGENTS.md：添加 Agent 开发规则、架构约束、关键文件索引
- 更新 CLAUDE.md：更新项目结构、新增文档索引、开发决策记录
- 更新 CHANGELOG.md：汇总全部功能变更、最新修复记录
- 更新 TODO_ISSUES.md：重新分类 TODO 优先级、标记完成项
- 更新 DEV_PROGRESS.md：本文件，汇总最新进展
- 更新 PROJECT_ANALYSIS.md：刷新项目全貌数据
- 更新 README.md：更新技术栈和功能列表

---

## 2026-06-01 ~ 2026-06-05 主要进展

### 章节连续性增强
- 新增 `chapter-continuity.ts`：跨章节连续性锚点系统
- 新增 `serial-chapter-flow`：上一章结尾承诺必须在下一章兑现
- 新增 `OpeningObligation` 类型：决策钩子、系统提示、倒计时等 hook 类型检测
- 扩展 Planner/Writer prompt：显式要求处理上一章结尾承诺
- 扩展 continuity audit：`serial_flow_break` 规则

### 质量审计修复 (12/12 完成)
- Q-001: Writer maxTokens 低估修复 (系数 1.1 → 2.5)
- Q-002: continueChapter 修复上下文增强
- Q-003: 上一章结尾衔接机制
- Q-004~Q-012: 质量门禁、Reviewer、Polisher、Orchestrator 等修复

### 开发基础设施
- 统一错误处理体系
- Agent 模块单元测试 (planner/validator)
- 核心模块文档 (agents/ai/memory/engine)
- API 文档 (projects)
- 项目详情 500 兼容修复

---

## 当前项目状态

### 代码规模

| 类别 | 数量 |
|------|------|
| TypeScript 库文件 | 219 |
| React 组件 (TSX) | 100 |
| API 路由 | 135 |
| Prisma 模型 | 30+ |
| Agent 类型 | 11 |
| AI 提供商 | 8 |
| 单元测试 | 280 (35 files) |

### 核心引擎 (60 files)

```
src/lib/engine/
├── orchestrator.ts              # 主编排器
├── production-pipeline.ts       # 生产级流水线
├── project-runtime.ts           # 统一运行态
├── project-pipeline-snapshot.ts # 快照构建
├── chapter-continuity.ts        # 章节连续性 (新增)
├── chapter-repair.ts            # 章节修复
├── chapter-commit.ts            # 章节提交
├── quality-gate.ts              # 质量门禁
├── context-budget.ts            # 上下文预算
├── context-compression.ts       # 上下文压缩
├── long-novel-controller.ts     # 长篇控制器
├── story-state.ts               # 故事状态
├── world-expansion.ts           # 世界扩张
├── villain-lifecycle.ts         # 反派生命周期
├── truncation-detector.ts       # 截断检测
├── blueprint-console.ts         # 蓝图书写
├── story-steering.ts            # 故事导向
├── rag-vector.ts                # RAG 向量检索
└── ...                          # 更多模块
```

### 完成度评估

| 模块 | 状态 | 说明 |
|------|------|------|
| 项目 CRUD | ✅ 完成 | 创作/拆解双模式 |
| 章节管理 | ✅ 完成 | CRUD + 拖拽排序 + 版本历史 |
| 章节生成 | ✅ 完成 | SSE 流式 + 批量 + 修复 |
| Agent 流水线 | ✅ 完成 | 11 Agent + 质量门禁 |
| 分层摘要 | ✅ 完成 | L1/L2/L3 三层 |
| 去 AI 味 | ✅ 完成 | 60+词库 + 多维评分 |
| 角色管理 | ✅ 完成 | 档案 + 关系图 + 声音指纹 |
| 伏笔追踪 | ✅ 完成 | 埋设/回收/状态 |
| 长篇控制 | ✅ 完成 | 蓝图 + 弧线 + 世界扩张 |
| 章节连续性 | ✅ 完成 | 锚点 + 审计 + 串行流程 |
| 统一运行态 | ✅ 完成 | runtimeSummary |
| 上下文管理 | ✅ 完成 | 预算 + 压缩 + 策略 |
| 导出 | ✅ 完成 | TXT/MD/JSON/EPUB |
| 成本追踪 | ✅ 完成 | Token + 配额 + 预警 |
| 风格系统 | ✅ 完成 | 提取 + 验证 + 应用 |
| 市场分析 | ✅ 完成 | 趋势 + 竞品 + 灵感 |
| 虚拟作家 | ✅ 完成 | 训练 + 风格学习 |
| RAG 检索 | ✅ 完成 | pgvector + 索引重建 |
| 封面生成 | ✅ 完成 | AI 生成 + 管理 |
| 通知系统 | ✅ 完成 | 系统/任务/配额/错误 |
| 文档体系 | ✅ 完成 | 20+ 文档 |

### P1 待处理项 (DEV_TODO)

- [ ] 旧 engine API 标记 legacy
- [ ] 蓝图/ArcPlan 阶段 heartbeat event
- [ ] 导出入口按 runtimeSummary.canExport 提示
- [ ] Job cancel 用户态文案
- [ ] 主链路 smoke test

### P2 待处理项

- [ ] Prisma enum 扩展评估
- [ ] 统一旧 BatchGenerator 入口
- [ ] 章节级 runtime summary 列表
- [ ] 独立修复 API
- [ ] RAG 降级提示
- [ ] 100+ 章离线模拟数据集

### P3 未来规划

- [ ] 外部 worker / 持久化队列
- [ ] 多人协作 + RBAC
- [ ] 生产级观测面板
- [ ] 市场/灵感/封面 产品线整理
- [ ] Playwright 端到端生成回归
