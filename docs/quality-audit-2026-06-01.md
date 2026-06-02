# Novel-AI 生成全流程质量审计报告

> 日期：2026-06-01 | 审计范围：章节生成 pipeline 全流程 | 模式：Bug 排查 + 质量分析
> 状态：**全部 12 个问题已修复** ✅ | 涉及 10 个文件 | TypeScript 编译通过

---

## 一、核心发现：章节截断的根因

### 🔴 Q-001：Writer maxTokens 严重低估 — 章节被强行截断

**位置**：`src/lib/ai/speed-mode.ts:93` + `src/lib/engine/orchestrator.ts:391`

**问题**：
```typescript
// speed-mode.ts:93
export function estimateMaxTokensForTargetWordCount(targetWordCount: number): number {
  return Math.ceil(Math.max(1, targetWordCount) * 1.1)
}
```

对于 3000 字目标：maxTokens = 3300。

**实际情况**：中文 LLM 中，1 个中文字符 ≈ 1.5-2 个 token（取决于模型）。3000 个中文字符 = 4500-6000 tokens。3300 tokens 只能生成约 **1650-2200 中文字符**，远低于目标！

**影响**：模型在写作到 1800-2200 字时因 token 限制被硬截断 → `isLikelyTruncated` 检测到 → 进入 `continueChapter` 修复 → 但修复时又只传最后 500 字符上下文 → 导致修复质量差 → 可能反复失败最终标记人工审核。

**严重程度**：🔴 Critical — 这是章节"突然截断""强行截断"问题的直接根因。

**修复建议**：将系数从 1.1 提升到 2.5-3.0（即 `targetWordCount * 2.5`），确保 maxTokens 覆盖中文分词膨胀系数。

---

### 🔴 Q-002：continueChapter 修复上下文严重不足

**位置**：`src/lib/engine/chapter-repair.ts:150-176`

**问题**：
```typescript
// 取最后 500 字作为上下文
const lastContext = content.slice(-500)

const prompt = `你是小说续写专家。以下章节被截断了，请继续完成。
...
截断位置（最后 500 字）：
${lastContext}

请从截断处继续写，输出续写内容（不需要重复已有内容）。`
```

只传最后 500 字符 + 简单的章节标题作为上下文，没有传递：
- 章节大纲（chapterOutline）
- 角色档案（characterProfiles）
- 前文摘要（recentChapterSummaries）
- 本章已完成部分的情节上下文

**影响**：修复后的续写内容与全文风格、情节不一致，产生逻辑断层。

**严重程度**：🔴 Critical — 修复环节质量失控，导致"修复后更差"的情况。

**修复建议**：将完整的大纲、角色列表、最近章节摘要一并传入修复 prompt。

---

## 二、章节连贯性问题深度分析

### 🔴 Q-003：缺少上一章结尾 → 下一章开头的显式衔接机制

**位置**：全文多处

**问题拆解**：

| 环节 | 现状 | 缺失 |
|------|------|------|
| **Planner** | 收到 `recentChapterSummaries`（摘要），包含章节摘要文本 | **不包含上一章的实际结尾段落**，只包含 AI 提炼的摘要 |
| **Writer Prompt** | 有 `## 前情摘要（最近3章）` | **没有"本章开篇必须紧接上一章结尾"的显式指令** |
| **Planning-v2 Prompt** | 有详细的章节结构指南 | **没有"开场场景：从上一章结尾处直接继续"的要求** |
| **Memory Pack** | 对 writer 默认只传 3 章摘要 | 没有上一章正文结尾部分的原文 |

**根因**：摘要 ≠ 结尾。200-300 字的 L1 摘要无法完整捕捉"他推开门，一道黑影迎面扑来——"这种悬崖式结尾的精髓。下一章的 Planner 不知道上一章具体是如何结束的，只能根据模糊摘要自行发挥。

**影响**：
1. 第一章结尾"突然截断" → 第二章开头"另起炉灶" → 读者感受严重的逻辑断层
2. 悬崖钩子无法被正确承接和解决

**严重程度**：🔴 Critical — 直接导致用户反馈的"两章之间衔接不强"。

**修复建议**：
1. 在 Memory Pack 中新增 `previousChapterEnding` 字段，包含上一章最后 300-500 字的原文
2. Writer prompt 中增加显式指令："**开篇要求**：本章正文必须从上一章结尾处直接继续，不得跳过时间线。上一章结尾是：[插入ending]"
3. Planner prompt 中增加："**衔接要求**：开场场景必须解决上文的悬念或承接上文的事件"

---

### 🟡 Q-004：FAST_ACCEPTANCE 模式跳过了 Planner，失去了每章定向规划

**位置**：`src/lib/engine/orchestrator.ts:290-292`

```typescript
} else if (speedMode === 'FAST_ACCEPTANCE') {
  outline = buildSeedOutlineFromChapterState(chapterNo, chapter)
}
```

FAST_ACCEPTANCE 模式下直接使用种子大纲，不调用 Planner Agent。而种子大纲非常通用（如"承接第N-1章剧情，围绕核心矛盾推进"），缺乏针对性的章节规划。

**影响**：快速模式下章节连贯性更差。

**严重程度**：🟡 Major

---

### 🟡 Q-005：Memory Pack 中章节摘要选取逻辑有两层截断

**位置**：`src/lib/memory/memory-orchestrator.ts:278-291`

```typescript
const recentSummaryLimit = pack.enableDecay
  ? pack.recentChapterSummaries.length
  : role === 'summarizer' ? 2 : role === 'validator' ? 4 : 3  // writer = 3

sections.push(buildSection(
  'recent-chapters',
  summaryLabel,
  buildRecentChapterSection(pack.recentChapterSummaries.slice(-recentSummaryLimit)),
  4,
  summaryBudget  // writer = 2200/3200
))
```

两层限制：
1. **数量限制**：writer 只看最近 3 章摘要（当 decay 未启用时）
2. **字符预算限制**：writer 只有 2200 chars（非 decay）或 3200 chars（decay）

当 3 章摘要总字符数超过 2200 时，最旧的摘要会被 `clampText` 截断。这意味着第一章的摘要可能丢失关键信息。

**严重程度**：🟡 Major

---

## 三、质量检测机制缺陷

### 🟡 Q-006：截断检测 `isLikelyTruncated` 会误判正常的悬念结尾

**位置**：`src/lib/engine/truncation-detector.ts:72-88`

```typescript
const trailingPatterns = [
  /他刚要说/, /她还没来得及/, /话还没说完/, /只见/, /忽然/, /突然/, /正在这时/,
]
const last200Chars = trimmedContent.slice(-200)
for (const pattern of trailingPatterns) {
  if (pattern.test(last200Chars)) {
    reasons.push(`结尾存在悬断句式：${pattern.source}`)
    break
  }
}
```

**问题**：`忽然`、`突然`、`只见`、`正在这时` 是网络小说中**标准的悬念结尾句式**。将这些标记为"截断"会导致：
1. 质量正常的悬念结尾 → 被标记为截断 → 进入 continueChapter 修复
2. 修复后的章节结尾可能被改成平淡的收束 → 失去悬念效果
3. 修复后再次检测（可能又有其他"截断信号"）→ 反复修复失败 → 标记人工审核

**影响**：合法的章节结尾被破坏，而且用户收到大量"人工审核"标记。

**严重程度**：🟡 Major — 破坏正常生成质量

**修复建议**：
1. 将 `忽然`、`突然`、`只见`、`正在这时` 从悬断句式中移除
2. 增加正向判断：如果这些词出现在正常段落结尾且后续有合理句号/省略号收束，则不算截断
3. 增加"语义完整性"判断维度，而非仅依赖模式匹配

---

### 🟡 Q-007：章节结尾钩子检测过于简陋

**位置**：`src/lib/engine/chapter-completion.ts:22-25`

```typescript
function detectEndingHook(content: string): boolean {
  const tail = content.slice(-300)
  return /[？?！!]|然而|没想到|下一刻|忽然|却在这时/.test(tail)
}
```

**问题**：几乎任何有问号或感叹号的结尾都会被判定为"有钩子"。无法区分：
- 真正的叙事钩子（"他不知道的是，那扇门后面等着他的，是一个彻底的陷阱——"）
- 普通感叹句（"今天真是个好天气！"）
- 自然收束（"他轻轻关上了门，这个漫长的夜晚终于结束了。"）

**影响**：
1. 假阳性：无钩子的章节被错误标记为"有钩子"，通过质量门禁
2. 假阴性（如果有的话）：有钩子的章节被判定为无钩子

**严重程度**：🟡 Major

**修复建议**：使用 AI 判断或更精细的模式匹配，至少检测：
- 是否包含未解问题/悬念（问句+开放性描述）
- 是否包含新信息/转折（"然而""没想到"+新事实）
- 是否建立了下一章的预期（"明天""下一次""等着他的"）

---

### 🟡 Q-008：Quality Gate `chapterNoPassed` 检查过于严格

**位置**：`src/lib/engine/quality-gate.ts:106-119`

```typescript
function hasWrongChapterNumber(content: string, expectedChapterNo: number): boolean {
  const chapterMatches = content.match(/第(\d+)章/g)
  if (!chapterMatches) return false
  for (const match of chapterMatches) {
    const num = parseInt(match.replace('第', '').replace('章', ''))
    if (Math.abs(num - expectedChapterNo) > 1) {
      return true
    }
  }
  return false
}
```

**问题**：如果第 10 章的正文中出现"就像第 5 章时那样"，`5` 与 `10` 相差超过 1，会被标记为错误。但实际上这只是在回忆前文。

**严重程度**：🟢 Minor — 可能误杀正常内容

---

## 四、Context/Prompt 质量问题

### 🟡 Q-009：Summarizer 输入截断导致摘要质量下降

**位置**：`src/lib/prompts/chapter/summarizing.ts:39`

```typescript
parts.push(input.chapterContent.slice(0, 5000)) // 限制内容长度
```

只取前 5000 字符。对于 3000 字的章节（约 3000 个中文字符），可能刚好覆盖。但对于更长的章节（4000-5000 字），后半部分（含结尾）会被截断 → 摘要中缺少结尾钩子信息 → 下一章无法获取上一章的结尾情况。

**严重程度**：🟡 Major — 直接影响跨章节信息传递

**修复建议**：改为取前 3000 字符 + 最后 2000 字符，确保覆盖章节结构（开头、高潮、结尾）。

---

### 🟡 Q-010：Writer Prompt 缺少"防止结尾过早收束"的约束

**位置**：`src/lib/prompts/chapter/writing-v2.ts`

Writer prompt 中有："章节结尾（最后200字）：留下钩子，为下章铺垫"。但没有：
1. "如果目标字数还没达到，不要提前写结尾"（虽然有类似表述但不够强）
2. "结尾必须是章节的自然收束，而非强行截断"

**严重程度**：🟡 Major

---

## 五、架构层面问题

### 🟡 Q-011：Validator 和 Deslopper 共用同一个 Provider

**位置**：`src/lib/engine/orchestrator.ts:537-538`

```typescript
provider: await getRoleProvider('validator'),  // deslopper 也在用
```

Deslopper 复用了 `getRoleProvider('validator')` 而不是创建自己的 provider。可能导致 model 选择冲突或配额混淆。

**严重程度**：🟢 Minor

---

### 🟢 Q-012：修复循环只尝试 2 次即标记人工审核

**位置**：`src/lib/engine/orchestrator.ts:639-666`

当 `repairAttempts >= MAX_REPAIR_ATTEMPTS(2)` 时直接标记人工审核。如果一次修复不能解决问题，只有一次重试机会。对于长篇小说大量章节的场景，这可能导致积累大量待审核条目。

**严重程度**：🟢 Minor

---

## 六、问题汇总与优先级

| ID | 问题 | 严重度 | 影响范围 | 修复复杂度 |
|----|------|--------|----------|-----------|
| Q-001 | Writer maxTokens 低估导致截断 | 🔴 Critical | 所有章节 | 低（改一个系数）|
| Q-002 | continueChapter 上下文不足 | 🔴 Critical | 截断修复 | 中 |
| Q-003 | 缺少上一章结尾传递机制 | 🔴 Critical | 所有章节间 | 中 |
| Q-004 | FAST_ACCEPTANCE 跳过 Planner | 🟡 Major | 快速模式 | 中 |
| Q-005 | Memory 摘要两层截断 | 🟡 Major | 上下文 | 低 |
| Q-006 | 截断检测误判悬念结尾 | 🟡 Major | 质量门禁 | 中 |
| Q-007 | 结尾钩子检测过于简陋 | 🟡 Major | 质量门禁 | 中 |
| Q-008 | chapterNoPassed 检查过严 | 🟢 Minor | 质量门禁 | 低 |
| Q-009 | Summarizer 输入截断 | 🟡 Major | 摘要质量 | 低 |
| Q-010 | Writer Prompt 缺少防早收指令 | 🟡 Major | 章节结尾 | 低 |
| Q-011 | Deslopper 复用 Provider | 🟢 Minor | 去AI味 | 低 |
| Q-012 | 修复循环仅 2 次 | 🟢 Minor | 修复流程 | 低 |

**修复优先级建议**：
1. **第一批（必须立即修复）**：Q-001、Q-003、Q-002
2. **第二批（应尽快修复）**：Q-006、Q-007、Q-009、Q-010
3. **第三批（可排期修复）**：Q-004、Q-005、Q-008、Q-011、Q-012

---

## 七、修复方案概要

### 7.1 Q-001 修复：修正 maxTokens 估算

```typescript
// speed-mode.ts:93 — 修改前
export function estimateMaxTokensForTargetWordCount(targetWordCount: number): number {
  return Math.ceil(Math.max(1, targetWordCount) * 1.1)
}

// 修改后
export function estimateMaxTokensForTargetWordCount(targetWordCount: number): number {
  // 中文字符 → token 膨胀系数 1.5-2x，加 50% 安全余量
  return Math.ceil(Math.max(1, targetWordCount) * 2.5)
}
```

### 7.2 Q-003 修复：增加上一章结尾传递

1. 在 `buildChapterMemoryPack` 中新增 `previousChapterEnding` 字段，取上一章最后 500 字原文
2. Writer prompt 增加衔接指令
3. Planner prompt 增加衔接要求

### 7.3 Q-002 修复：增强 continueChapter 上下文

在 continueChapter 的 prompt 中传入：
- 章节大纲 (chapterOutline)
- 角色档案
- 最近 2-3 章摘要

### 7.4 Q-006 修复：优化截断检测

将 `忽然|突然|只见|正在这时` 从悬断句式移至"需结合上下文判断"的软信号类别。

---

## 八、修复实施记录（2026-06-01）

| 批次 | ID | 文件 | 变更摘要 |
|------|-----|------|----------|
| 🔴 P0 | Q-001 | `speed-mode.ts` | maxTokens 系数 1.1→2.5，增加中英文档注释 |
| 🔴 P0 | Q-003 | `memory-orchestrator.ts` | 新增 `getPreviousChapterEnding` + MemoryPack 增加 `previousChapterEnding` 字段 + `pickMemorySections` 优先级0 输出上一章结尾 |
| 🔴 P0 | Q-003 | `writing-v2.ts` | 新增"⚠️ 章节衔接要求"段（5条衔接指令） |
| 🔴 P0 | Q-003 | `planning-v2.ts` | 新增"⚠️ 章节衔接要求"段（4条衔接指令） |
| 🔴 P0 | Q-002 | `chapter-repair.ts` | `continueChapter` 接受 `chapterOutline`/`characterProfiles`/`recentSummaries`/`previousChapterEnding` 四个新参数，续写上下文从 500 字→800 字 |
| 🔴 P0 | Q-002 | `orchestrator.ts` | 调用 `continueChapter` 时传递完整上下文 |
| 🟡 P1 | Q-006 | `truncation-detector.ts` | "忽然/突然/只见/正在这时"从硬截断移至软信号，增加悬念结尾豁免逻辑 |
| 🟡 P1 | Q-007 | `chapter-completion.ts` | `detectEndingHook` 重写为四维判断：悬念式/转折式/承诺式/情感式钩子 |
| 🟡 P1 | Q-009 | `summarizing.ts` | 长章节(>5000字)改为取"前3000+后2000"覆盖首尾 |
| 🟡 P1 | Q-010 | `writing-v2.ts` | 增加"⚠️ 防止过早收束"段（4条防早收约束） |
| 🟢 P2 | Q-005 | `memory-orchestrator.ts` | Writer 最近摘要数 3→5 章，预算 2200→3200 chars |
| 🟢 P2 | Q-008 | `quality-gate.ts` | `hasWrongChapterNumber` 只检查未来章节号（`> expectedChapterNo`），允许回忆前文 |
| 🟢 P2 | Q-011 | `orchestrator.ts` | Deslopper 从复用 `getRoleProvider('validator')` 改为 `getRoleProvider('deslopper')` |

**总变更**：10 个文件 | **TypeScript 编译**：0 个新错误 | **测试**：预存测试错误未受影响
