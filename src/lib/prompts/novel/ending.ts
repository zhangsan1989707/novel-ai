/**
 * 结局续写提示词
 */
import type { PromptContext } from '@/lib/ai/types'
import { ENDING_DIRECTIONS } from '../shared/constants'

interface EndingGenerationInput {
  context: PromptContext
  options: {
    unresolvedForeshadowing: { setup: string; importance: string }[]
    openPlotlines: { title: string; keyEvents: string[] }[]
    characterArcs: { name: string; currentStatus: string; arcDescription?: string }[]
    endingDirection?: 'happy' | 'tragic' | 'open'
    targetChapterCount?: number
  }
}

/**
 * 构建结局续写提示词
 */
export function buildEndingPrompt(input: EndingGenerationInput): string {
  const { context, options } = input
  const parts: string[] = []

  // 【基础信息】
  parts.push(`【基础信息】`)
  parts.push(`标题：${context.projectTitle} - 结局`)
  if (context.genre) parts.push(`类型：${context.genre}`)
  if (context.writingStyle) parts.push(`写作风格：${context.writingStyle}`)

  // 【设定 - 世界观】
  if (context.worldSetting) {
    parts.push(`\n【设定 - 世界观】`)
    parts.push(context.worldSetting)
  }

  // 【设定 - 主角人设】
  if (context.protagonistProfile) {
    parts.push(`\n【设定 - 主角人设】`)
    parts.push(context.protagonistProfile)
  }

  // 【设定 - 主角目标】
  if (context.protagonistGoal) {
    parts.push(`\n【设定 - 主角目标】`)
    parts.push(context.protagonistGoal)
  }

  // 【未解伏笔】
  if (options.unresolvedForeshadowing.length > 0) {
    parts.push(`\n【未解伏笔 - 必须在结局中回收】`)
    options.unresolvedForeshadowing.forEach((f, i) => {
      parts.push(`${i + 1}. ${f.setup} (${f.importance === 'major' ? '重要' : '次要'})`)
    })
  }

  // 【开放剧情线】
  if (options.openPlotlines.length > 0) {
    parts.push(`\n【待完成的剧情线】`)
    options.openPlotlines.forEach((p, i) => {
      parts.push(`${i + 1}. ${p.title}`)
      if (p.keyEvents.length > 0) {
        parts.push(`   关键事件：${p.keyEvents.join(' → ')}`)
      }
    })
  }

  // 【角色命运】
  if (options.characterArcs.length > 0) {
    parts.push(`\n【角色走向】`)
    options.characterArcs.forEach(c => {
      parts.push(`- ${c.name}: ${c.currentStatus}`)
      if (c.arcDescription) {
        parts.push(`  角色弧线: ${c.arcDescription}`)
      }
    })
  }

  // 【结局方向】
  const directionGuides = {
    [ENDING_DIRECTIONS.HAPPY]: '请提供积极向上的结局，主要角色获得成长和幸福，伏笔得到温馨回收',
    [ENDING_DIRECTIONS.TRAGIC]: '可以有牺牲和遗憾，但要有深度和意义，让读者为角色的命运动容',
    [ENDING_DIRECTIONS.OPEN]: '保持一定悬念，可以留白让读者想象，但核心伏笔需要回收'
  }
  if (options.endingDirection) {
    parts.push(`\n【结局要求】${directionGuides[options.endingDirection]}`)
  }

  // 【任务】
  const chapterCount = options.targetChapterCount || 1
  parts.push(`\n【任务】`)
  parts.push(`请撰写 ${chapterCount > 1 ? `${chapterCount}章` : '1章'} 故事结局`)
  parts.push(`结局需要：`)
  parts.push(`1. 回收所有重要伏笔（特别是标记为"重要"的）`)
  parts.push(`2. 给开放剧情线一个合理的走向和收尾`)
  parts.push(`3. 完成角色弧线的最终变形`)
  parts.push(`4. 制造情感高潮，给读者留下深刻印象`)
  parts.push(`5. 字数要求：约 ${chapterCount * 3000} 字`)

  // 【网文写作要求】
  parts.push(`\n【网文写作要求】`)
  parts.push(`1. 结局章节需要情感高潮和有力收尾`)
  parts.push(`2. 注意伏笔回收的节奏，不要一次性全部揭示`)
  parts.push(`3. 保持人物性格一致性`)
  parts.push(`4. 避免虎头蛇尾，结局要有分量感`)

  // 去AI味
  parts.push(`\n【去AI味要求】`)
  parts.push(`- 禁止排比句堆砌、过度比喻、滥词（不禁/顿时/瞬间）`)
  parts.push(`- 口语化表达，允许不完整句子，段落长短参差不齐`)
  parts.push(`- 人物内心独白要有语气词，情绪通过行为细节体现`)
  parts.push(`- 允许作者视角的碎碎念和非必要闲笔`)

  return parts.join('\n')
}

// 类型导出
export type { EndingGenerationInput }
