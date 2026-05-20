/**
 * 小说修改提示词
 */
import type { PromptContext } from '@/lib/ai/types'

export type RevisionType = 'rewrite' | 'continue' | 'expand' | 'condense' | 'polish'

/**
 * 构建章节修改提示词
 */
export function buildRevisionPrompt(
  context: PromptContext,
  currentContent: string,
  revisionType: RevisionType,
  suggestion?: string
): string {
  const parts: string[] = []

  // 【基础信息】
  parts.push(`【基础信息】`)
  parts.push(`标题：${context.projectTitle}`)
  if (context.genre) parts.push(`类型：${context.genre}`)
  if (context.writingStyle) parts.push(`写作风格：${context.writingStyle}`)

  // 【设定】
  if (context.worldSetting) {
    parts.push(`\n【设定 - 世界观】`)
    parts.push(context.worldSetting)
  }

  if (context.memoryContext) {
    parts.push(`\n【记忆编排上下文】`)
    parts.push(context.memoryContext)
  }

  if (context.protagonistProfile) {
    parts.push(`\n【设定 - 主角人设】`)
    parts.push(context.protagonistProfile)
  }

  if (context.protagonistGoal) {
    parts.push(`\n【设定 - 主角目标】`)
    parts.push(context.protagonistGoal)
  }

  // 【上下文】- 根据修改类型选择合适的上下文
  parts.push(`\n【上下文 - 当前章节】`)
  parts.push(`第${context.currentChapterNumber}章 "${context.currentChapterTitle}"`)
  if (context.currentChapterSummary) {
    parts.push(`章节概要：${context.currentChapterSummary}`)
  }

  // 根据修改类型选择上下文策略
  // 对于续写和扩展，需要章节末尾来确保衔接
  // 对于重写和润色，需要章节开头来了解整体内容
  let contextContent = ''
  if (revisionType === 'continue' || revisionType === 'expand') {
    // 续写和扩展：取章节末尾部分，确保内容衔接
    contextContent = currentContent.slice(-1500)
    parts.push(`\n【上下文 - 章节末尾内容（续写起点）】`)
  } else {
    // 重写和润色：取章节开头部分，了解整体内容
    contextContent = currentContent.slice(0, 1500)
    parts.push(`\n【上下文 - 章节开头内容（参考全文风格）】`)
  }
  parts.push(contextContent)

  // 【任务】
  parts.push(`\n【任务类型】${getRevisionTypeLabel(revisionType)}`)

  switch (revisionType) {
    case 'rewrite':
      parts.push(`请根据以下建议完全重新生成内容，保留原有核心思想和人物设定：${suggestion || '请改进内容质量'}。`)
      parts.push(`目标字数：约2500-3500字`)
      break
    case 'continue':
      parts.push(`请在现有内容基础上继续续写，保持文风和人物性格一致：${suggestion || ''}`)
      parts.push(`目标字数：约2500-3500字`)
      break
    case 'expand':
      parts.push(`请在现有内容基础上进行扩展，增加更多细节描写、场景渲染、心理刻画：${suggestion || '请丰富内容细节'}。`)
      parts.push(`目标字数：约4000-5000字`)
      break
    case 'condense':
      parts.push(`请在现有内容基础上精简压缩，去除冗余描述，保留核心情节和关键表达：${suggestion || '请精简内容'}。`)
      parts.push(`目标字数：约1500-2000字`)
      break
    case 'polish':
      parts.push(`请对现有内容进行润色优化，改善表达方式、提升文笔、消除语病，使文章更加流畅优美：${suggestion || '请提升文笔质量'}。`)
      parts.push(`目标字数：与原文相近，保持原有篇幅`)
      break
  }

  // 网文特性引导
  parts.push(`\n【网文写作要求】`)
  parts.push(`1. 章节开头需设置悬念/钩子`)
  parts.push(`2. 内容需有"爽点"或"爆点"`)
  parts.push(`3. 合理控制节奏`)
  parts.push(`4. 禁止与原文重复的表达，禁止"水字数"`)

  // 去AI味
  parts.push(`\n【去AI味要求】`)
  parts.push(`- 禁止排比句堆砌、"宛如/仿佛/犹如"过度比喻、"不禁/顿时/瞬间"等滥词`)
  parts.push(`- 口语化表达，允许不完整句子和意识流，段落长短参差不齐`)
  parts.push(`- 人物内心独白要有语气词，情绪通过行为细节体现而非直说`)
  parts.push(`- 对话后不必每次加动作，允许干对话和轻微视角漂移`)

  return parts.join('\n')
}

function getRevisionTypeLabel(type: RevisionType): string {
  const labels: Record<RevisionType, string> = {
    rewrite: '重写',
    continue: '续写',
    expand: '扩展',
    condense: '精简',
    polish: '润色',
  }
  return labels[type]
}

// 类型导出
export type { }
