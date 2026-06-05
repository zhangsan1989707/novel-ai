<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Novel AI - Agent Development Guide

## Project Identity

Novel AI is an **AI-powered web novel industrial production system** — not just a writing tool. The core differentiator is **long-form narrative stability control**: infinite continuation, anti-collapse, anti-premature-ending, world expansion, and platform rhythm adaptation.

## Critical Development Rules

### 1. Schema Changes Are High Risk
- **NEVER** modify Prisma schema without explicit approval. The database drives 60+ engine modules and 135+ API routes.
- New fields/extensions should go into `GenerationJob.payload` JSON, `NovelChapter.chapterOutline` JSON, or `StoryState.metadata` JSON first.
- If a Prisma migration is unavoidable, check backward compatibility with existing `select` queries — old code may not read new columns.

### 2. No Real Environment Config Changes
- Do NOT modify `.env`, `.env.example`, `docker-compose.yml`, or `Dockerfile` unless explicitly requested.
- `NODE_TLS_REJECT_UNAUTHORIZED=0` is intentional for corporate SSL proxy environments.

### 3. Pipeline State Consistency
- All pipeline state must go through `src/lib/engine/project-runtime.ts` (`ProjectRuntimeStage`, `ProjectRuntimeSummary`).
- `/pipeline/status` and `/pipeline/stream` must share snapshot logic via `src/lib/engine/project-pipeline-snapshot.ts`.
- NEVER compute pipeline state directly in UI components.

### 4. API Response Format
```typescript
// Success
{ success: true, data: { ... } }

// Error
{ success: false, error: { code: "ERROR_CODE", message: "描述" } }
```

### 5. Agent Interface Contract
All agents must follow the adapter pattern in `src/lib/agents/adapters.ts`:
```typescript
interface AgentDefinition<Input, Output> {
  type: AgentType
  name: string
  description: string
  execute(input: Input): Promise<Output>
}
```

### 6. Chapter Generation Quality Gate
- After writing, chapters must pass through: Writer → Polisher → Reviewer → Validator → Deslopper → QualityGate
- `FAST_ACCEPTANCE` mode skips heavy validation but must still pass basic checks
- Truncated chapters (detected by `truncation-detector.ts`) must enter repair, not be marked COMPLETED

### 7. Context Budget Management
- `src/lib/engine/context-budget.ts` controls token allocation across Blueprint(10%), ArcPlan(15%), Summaries(25%), Plotlines(15%), Characters(15%), StyleGuide(10%), Outline(10%)
- When budget overflows, discard: old content > expired characters > closed plotlines > old phase goals
- NEVER truncate: current goals, active plotlines, protagonist state, world rules

### 8. MaxTokens Calculation
- Chinese text: 1 character ≈ 1.5-2 tokens. For 3000-word target, maxTokens should be at least `targetWordCount * 2.5`
- The fix was applied in `src/lib/ai/speed-mode.ts` — do NOT revert to `* 1.1`

## Key Files by Module

| Module | Key File | Purpose |
|--------|----------|---------|
| Engine | `src/lib/engine/orchestrator.ts` | Main generation pipeline |
| Pipeline | `src/lib/engine/production-pipeline.ts` | Production-grade pipeline |
| Runtime | `src/lib/engine/project-runtime.ts` | Unified runtime state |
| Continuity | `src/lib/engine/chapter-continuity.ts` | Cross-chapter continuity |
| Agents | `src/lib/agents/adapters.ts` | Agent registry & adapters |
| Memory | `src/lib/memory/memory-orchestrator.ts` | Context assembly |
| Quality | `src/lib/engine/quality-gate.ts` | Quality gate |
| Deslop | `src/lib/knowledge/anti-ai.ts` | Anti-AI vocabulary (60+ words) |
| Prompts | `src/lib/prompts/chapter/writing-v2.ts` | Enhanced writing prompts |
| API | `src/app/api/novel/projects/[projectId]/generate/stream/route.ts` | SSE streaming |

## Commit Convention
```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试
chore: 构建/工具
```

## Quick Commands
```bash
npm run dev          # Start dev server (port 3200)
npm run build        # Production build
npm test             # Unit tests (280 tests, 35 files)
npm run test:e2e     # E2E tests
npm run lint         # ESLint
```
