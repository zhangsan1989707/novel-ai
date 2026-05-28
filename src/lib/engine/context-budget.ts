const CHARS_PER_TOKEN = 2.5
const DEFAULT_SECTION_ORDER: ContextSectionKey[] = [
  'blueprint',
  'arcPlan',
  'summaries',
  'plotlines',
  'characters',
  'styleGuide',
  'currentOutline',
]

const BUDGET_ALLOCATION: Record<ContextSectionKey, number> = {
  blueprint: 0.14,
  arcPlan: 0.16,
  summaries: 0.24,
  plotlines: 0.14,
  characters: 0.12,
  styleGuide: 0.08,
  currentOutline: 0.12,
}

/** 衰减模式预算分配：摘要被压缩后，释放空间给伏笔系统 */
const BUDGET_ALLOCATION_DECAY: Record<ContextSectionKey, number> = {
  blueprint: 0.14,
  arcPlan: 0.16,
  summaries: 0.16,
  plotlines: 0.22,
  characters: 0.12,
  styleGuide: 0.08,
  currentOutline: 0.12,
}

const SECTION_LABELS: Record<ContextSectionKey, string> = {
  blueprint: '蓝图',
  arcPlan: 'Arc计划',
  summaries: '近期摘要',
  plotlines: '活跃伏笔',
  characters: '角色状态',
  styleGuide: '风格指南',
  currentOutline: '当前大纲',
}

const SECTION_PRIORITIES: Record<ContextSectionKey, number> = {
  blueprint: 95,
  arcPlan: 90,
  summaries: 100,
  plotlines: 88,
  characters: 74,
  styleGuide: 58,
  currentOutline: 82,
}

export interface ChapterContext {
  blueprint: string
  arcPlan: string
  summaries: string
  plotlines: string
  characters: string
  styleGuide: string
  currentOutline: string
  fullContext: string
  estimatedTokens: number
}

export type ContextSectionKey =
  | 'blueprint'
  | 'arcPlan'
  | 'summaries'
  | 'plotlines'
  | 'characters'
  | 'styleGuide'
  | 'currentOutline'

export interface ContextSectionStats {
  key: ContextSectionKey
  label: string
  originalTokens: number
  keptTokens: number
  removedTokens: number
  wasTrimmed: boolean
}

export interface ContextBudgetStats {
  maxTokens: number
  originalTokens: number
  finalTokens: number
  tokensRemoved: number
  wasTrimmed: boolean
  prioritizedRecentSummaryChunks: number
  droppedSummaryChunks: number
  sections: ContextSectionStats[]
}

export interface ManagedContextBudget {
  fullContext: string
  trimmedContext: string
  estimatedTokens: number
  stats: ContextBudgetStats
}

type ContextSection = {
  key: ContextSectionKey
  label: string
  content: string
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

function normalizeSectionContent(text: string): string {
  return text.trim()
}

function renderSection(section: ContextSection): string {
  return `[${section.label}]\n${section.content}`
}

function buildSections(context: ChapterContext): ContextSection[] {
  return DEFAULT_SECTION_ORDER
    .map((key) => {
      const content = normalizeSectionContent(context[key] || '')
      if (!content) return null
      return {
        key,
        label: SECTION_LABELS[key],
        content,
      }
    })
    .filter((section): section is ContextSection => Boolean(section))
}

function joinSections(sections: ContextSection[]): string {
  return sections.map(renderSection).join('\n\n---\n\n')
}

function sliceToTokenBudget(text: string, tokenBudget: number): string {
  if (!text || tokenBudget <= 0) return ''
  const maxChars = Math.max(1, Math.floor(tokenBudget * CHARS_PER_TOKEN))
  if (text.length <= maxChars) return text

  const truncated = text.slice(0, Math.max(1, maxChars - 1)).trimEnd()
  return `${truncated}…`
}

function splitSummaryChunks(text: string): string[] {
  const normalized = normalizeSectionContent(text)
  if (!normalized) return []

  const matched = normalized.match(
    /(?:^|\n)(?=(?:第\s*\d+\s*章|Chapter\s+\d+|\[\s*Chapter\s+\d+\s*\]|章节\s*\d+))/gi
  )

  if (!matched || matched.length <= 1) {
    return normalized
      .split(/\n{2,}/)
      .map((chunk) => chunk.trim())
      .filter(Boolean)
  }

  return normalized
    .split(/(?=(?:^|\n)(?:第\s*\d+\s*章|Chapter\s+\d+|\[\s*Chapter\s+\d+\s*\]|章节\s*\d+))/gim)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
}

function trimSummarySection(text: string, tokenBudget: number): {
  content: string
  prioritizedRecentSummaryChunks: number
  droppedSummaryChunks: number
} {
  if (!text || tokenBudget <= 0) {
    return { content: '', prioritizedRecentSummaryChunks: 0, droppedSummaryChunks: 0 }
  }

  const chunks = splitSummaryChunks(text)
  if (chunks.length === 0) {
    return { content: '', prioritizedRecentSummaryChunks: 0, droppedSummaryChunks: 0 }
  }

  const kept: string[] = []
  let remaining = tokenBudget

  for (let index = chunks.length - 1; index >= 0; index -= 1) {
    const chunk = chunks[index]
    const chunkTokens = estimateTokens(chunk)

    if (chunkTokens <= remaining) {
      kept.unshift(chunk)
      remaining -= chunkTokens
      continue
    }

    if (kept.length === 0) {
      kept.unshift(sliceToTokenBudget(chunk, remaining))
      remaining = 0
    }

    break
  }

  const content = kept.join('\n\n')
  return {
    content,
    prioritizedRecentSummaryChunks: kept.filter(Boolean).length,
    droppedSummaryChunks: Math.max(0, chunks.length - kept.filter(Boolean).length),
  }
}

function trimSectionContent(section: ContextSection, tokenBudget: number) {
  if (section.key === 'summaries') {
    return trimSummarySection(section.content, tokenBudget)
  }

  return {
    content: sliceToTokenBudget(section.content, tokenBudget),
    prioritizedRecentSummaryChunks: 0,
    droppedSummaryChunks: 0,
  }
}

function allocateBudgets(sections: ContextSection[], maxTokens: number, decayMode?: boolean): Record<ContextSectionKey, number> {
  const budgets = {} as Record<ContextSectionKey, number>

  for (const key of DEFAULT_SECTION_ORDER) {
    budgets[key] = 0
  }

  if (maxTokens <= 0) return budgets

  const activeSections = sections.length
  const separatorOverhead = Math.max(0, activeSections - 1) * estimateTokens('\n\n---\n\n')
  const headingOverhead = sections.reduce((sum, section) => sum + estimateTokens(`[${section.label}]\n`), 0)
  const distributable = Math.max(activeSections, maxTokens - separatorOverhead - headingOverhead)

  let assigned = 0
  for (const section of sections) {
    const allocation = decayMode ? BUDGET_ALLOCATION_DECAY : BUDGET_ALLOCATION
    const budget = Math.max(1, Math.floor(distributable * allocation[section.key]))
    budgets[section.key] = budget
    assigned += budget
  }

  let remainder = distributable - assigned
  const priorityOrder = [...sections].sort((left, right) => SECTION_PRIORITIES[right.key] - SECTION_PRIORITIES[left.key])

  while (remainder > 0 && priorityOrder.length > 0) {
    for (const section of priorityOrder) {
      if (remainder <= 0) break
      budgets[section.key] += 1
      remainder -= 1
    }
  }

  return budgets
}

export function buildChapterContext(
  blueprint: string,
  arcPlan: string,
  summaries: string,
  plotlines: string,
  characters: string,
  styleGuide: string,
  currentOutline: string
): ChapterContext {
  const context: ChapterContext = {
    blueprint,
    arcPlan,
    summaries,
    plotlines,
    characters,
    styleGuide,
    currentOutline,
    fullContext: '',
    estimatedTokens: 0,
  }

  const fullContext = joinSections(buildSections(context))

  return {
    ...context,
    fullContext,
    estimatedTokens: estimateTokens(fullContext),
  }
}

export function manageContextBudget(context: ChapterContext, maxTokens: number, options?: { decayMode?: boolean }): ManagedContextBudget {
  const sections = buildSections(context)
  const fullContext = context.fullContext || joinSections(sections)
  const originalTokens = estimateTokens(fullContext)

  if (originalTokens <= maxTokens) {
    return {
      fullContext,
      trimmedContext: fullContext,
      estimatedTokens: originalTokens,
      stats: {
        maxTokens,
        originalTokens,
        finalTokens: originalTokens,
        tokensRemoved: 0,
        wasTrimmed: false,
        prioritizedRecentSummaryChunks: 0,
        droppedSummaryChunks: 0,
        sections: sections.map((section) => {
          const sectionTokens = estimateTokens(section.content)
          return {
            key: section.key,
            label: section.label,
            originalTokens: sectionTokens,
            keptTokens: sectionTokens,
            removedTokens: 0,
            wasTrimmed: false,
          }
        }),
      },
    }
  }

  const sectionBudgets = allocateBudgets(sections, maxTokens, options?.decayMode)
  let prioritizedRecentSummaryChunks = 0
  let droppedSummaryChunks = 0

  const trimmedSections = sections
    .map((section) => {
      const trimmed = trimSectionContent(section, sectionBudgets[section.key] || 0)
      prioritizedRecentSummaryChunks += trimmed.prioritizedRecentSummaryChunks
      droppedSummaryChunks += trimmed.droppedSummaryChunks
      if (!trimmed.content) return null
      return {
        ...section,
        content: trimmed.content,
      }
    })
    .filter((section): section is ContextSection => Boolean(section))

  const trimmedContext = joinSections(trimmedSections)
  const finalTokens = estimateTokens(trimmedContext)

  return {
    fullContext,
    trimmedContext,
    estimatedTokens: finalTokens,
    stats: {
      maxTokens,
      originalTokens,
      finalTokens,
      tokensRemoved: Math.max(0, originalTokens - finalTokens),
      wasTrimmed: true,
      prioritizedRecentSummaryChunks,
      droppedSummaryChunks,
      sections: sections.map((section) => {
        const original = estimateTokens(section.content)
        const keptContent = trimmedSections.find((item) => item.key === section.key)?.content || ''
        const kept = estimateTokens(keptContent)
        return {
          key: section.key,
          label: section.label,
          originalTokens: original,
          keptTokens: kept,
          removedTokens: Math.max(0, original - kept),
          wasTrimmed: kept < original,
        }
      }),
    },
  }
}

export function trimContext(context: ChapterContext, maxTokens: number, options?: { decayMode?: boolean }): string {
  return manageContextBudget(context, maxTokens, options).trimmedContext
}

export function getBudgetAllocation(decayMode?: boolean): Record<string, number> {
  return { ...(decayMode ? BUDGET_ALLOCATION_DECAY : BUDGET_ALLOCATION) }
}

export function estimateContextTokens(
  blueprint: string,
  arcPlan: string,
  summaries: string,
  plotlines: string,
  characters: string,
  styleGuide: string,
  currentOutline: string
): number {
  return estimateTokens(
    buildChapterContext(
      blueprint,
      arcPlan,
      summaries,
      plotlines,
      characters,
      styleGuide,
      currentOutline
    ).fullContext
  )
}
