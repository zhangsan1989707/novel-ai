# TODO Issues 跟踪记录

> 更新时间：2026-06-05
> 当发现新的 TODO 或待处理问题时添加到此文档

---

## High Priority

### TODO-001: Orchestrator finishReason 传递

**位置：** `src/lib/engine/orchestrator.ts:636`

**原始代码：**
```typescript
finishReason: undefined, // TODO: 从 writer 获取 finishReason
```

**问题描述：**
writerAgent 执行后未正确传递 finishReason，导致在某些场景下无法获取正确的生成终止原因。

**期望行为：**
从 writerAgent 的返回结果中获取 finishReason 并传递给调用方。

**验收标准：**
- [ ] 确认 writerAgent 返回值包含 finishReason
- [ ] 在 orchestrator 中正确提取并传递 finishReason
- [ ] 编写单元测试覆盖此场景

**状态：** 进行中 (2026-06-01 已修复部分，需验证)

---

## Medium Priority

### TODO-002: 旧 engine API 标记 legacy

**位置：** `src/app/api/novel/engine/generate/route.ts`

**问题描述：**
旧 `/api/novel/engine/generate` 与新 project pipeline 并存，用户路径和工程路径不完全统一。

**期望行为：**
标记为 legacy 或接入统一运行态。

**状态：** 待处理 (DEV_TODO P1)

---

### TODO-003: 合并重复的章节统计逻辑

**位置：** `/pipeline/status` 与 `/pipeline/stream`

**问题描述：**
两个端点有重复的章节统计逻辑，字段计算逻辑容易漂移。

**期望行为：**
统一使用 `project-pipeline-snapshot.ts` 的快照构建逻辑。

**状态：** 已部分完成 (2026-06-01)

---

### TODO-004: 蓝图/ArcPlan/章节目录阶段 progress event

**问题描述：**
蓝图、ArcPlan、章节目录阶段缺少细粒度 progress event，用户只能看到等待状态。

**期望行为：**
为这些阶段补充 heartbeat event。

**状态：** 待处理 (DEV_TODO P1)

---

## Low Priority

### TODO-005: Prisma enum 扩展评估

**问题描述：**
`ChapterStatus` 只有 `DRAFT/GENERATING/COMPLETED/REVIEWING`，无法表达 queued、failed、needs repair、skipped。

**期望行为：**
评估是否扩展 enum，但需要谨慎对待迁移影响。

**状态：** 待处理 (DEV_TODO P2)

---

### TODO-006: 统一旧 BatchGenerator 入口

**问题描述：**
`BatchGenerator`、单章生成页、production pipeline 三条生成入口体验不一致。

**期望行为：**
统一配置和入口文案。

**状态：** 待处理 (DEV_TODO P2)

---

## 已完成项

### ✅ 2026-06-01 第二阶段完成
- [x] 新增统一运行态类型
- [x] 统一 pipeline 快照构建逻辑
- [x] 项目详情 API 返回 runtimeSummary
- [x] 项目详情页接入 runtimeSummary
- [x] 修复 planner/validator Agent 测试
- [x] 修复项目详情 500 (StoryState 兼容)
- [x] 修复基线构建阻断 (ErrorHandler 导入)

### ✅ 2026-06-01 质量审计修复完成
- [x] Writer maxTokens 低估 (1.1 → 2.5)
- [x] continueChapter 修复上下文不足
- [x] 缺少上一章结尾衔接机制
- [x] 质量门禁评分权重偏差
- [x] Reviewer 审核结果解析
- [x] Polisher 未检测去 AI 味

---

## 添加新 Issue

```markdown
### TODO-XXX: [简短描述]

**位置：** `src/path/to/file.ts:LINENUMBER`

**原始代码：**
```typescript
// TODO: [描述]
```

**问题描述：**
[详细描述问题]

**期望行为：**
[描述期望的行为]

**验收标准：**
- [ ] [标准1]
- [ ] [标准2]

**状态：** 待处理
```
