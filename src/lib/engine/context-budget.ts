const BUDGET_ALLOCATION = {
  blueprint: 0.10,
  arcPlan: 0.15,
  summaries: 0.25,
  plotlines: 0.15,
  characters: 0.15,
  styleGuide: 0.10,
  currentOutline: 0.10,
}

interface ChapterContext {
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

function estimateTokens(text: string): number {
  return Math.ceil(text.length * 0.4)
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
  const fullContext = [
    blueprint && `[蓝图]\n${blueprint}`,
    arcPlan && `[Arc计划]\n${arcPlan}`,
    summaries && `[近期摘要]\n${summaries}`,
    plotlines && `[活跃伏笔]\n${plotlines}`,
    characters && `[角色状态]\n${characters}`,
    styleGuide && `[风格指南]\n${styleGuide}`,
    currentOutline && `[当前大纲]\n${currentOutline}`,
  ].filter(Boolean).join('\n\n---\n\n')

  return {
    blueprint,
    arcPlan,
    summaries,
    plotlines,
    characters,
    styleGuide,
    currentOutline,
    fullContext,
    estimatedTokens: estimateTokens(fullContext),
  }
}

export function trimContext(context: ChapterContext, maxTokens: number): string {
  const { fullContext, estimatedTokens } = context
  if (estimatedTokens <= maxTokens) return fullContext

  const budget = {
    blueprint: Math.floor(maxTokens * BUDGET_ALLOCATION.blueprint),
    arcPlan: Math.floor(maxTokens * BUDGET_ALLOCATION.arcPlan),
    summaries: Math.floor(maxTokens * BUDGET_ALLOCATION.summaries),
    plotlines: Math.floor(maxTokens * BUDGET_ALLOCATION.plotlines),
    characters: Math.floor(maxTokens * BUDGET_ALLOCATION.characters),
    styleGuide: Math.floor(maxTokens * BUDGET_ALLOCATION.styleGuide),
    currentOutline: Math.floor(maxTokens * BUDGET_ALLOCATION.currentOutline),
  }

  function capText(text: string, tokenBudget: number): string {
    if (!text) return ''
    const estimatedChars = Math.floor(tokenBudget / 0.4)
    if (text.length <= estimatedChars) return text
    return text.substring(0, estimatedChars) + '...'
  }

  const parts = [
    context.blueprint && `[蓝图]\n${capText(context.blueprint, budget.blueprint)}`,
    context.arcPlan && `[Arc计划]\n${capText(context.arcPlan, budget.arcPlan)}`,
    context.summaries && `[近期摘要]\n${capText(context.summaries, budget.summaries)}`,
    context.plotlines && `[活跃伏笔]\n${capText(context.plotlines, budget.plotlines)}`,
    context.characters && `[角色状态]\n${capText(context.characters, budget.characters)}`,
    context.styleGuide && `[风格指南]\n${capText(context.styleGuide, budget.styleGuide)}`,
    context.currentOutline && `[当前大纲]\n${capText(context.currentOutline, budget.currentOutline)}`,
  ].filter(Boolean)

  return parts.join('\n\n---\n\n')
}

export function getBudgetAllocation(): Record<string, number> {
  return { ...BUDGET_ALLOCATION }
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
    [blueprint, arcPlan, summaries, plotlines, characters, styleGuide, currentOutline]
      .filter(Boolean)
      .join('\n')
  )
}