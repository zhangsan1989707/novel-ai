/**
 * 小说生成提示词
 */
import type { PromptContext, BuildPromptOptions } from '@/lib/ai/types'
import { CHAPTER_PACING } from '../shared/constants'

/**
 * 构建小说生成提示词
 */
export function buildNovelGenerationPrompt(
  context: PromptContext,
  options: BuildPromptOptions
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

  if (context.powerSystem) {
    parts.push(`\n【设定 - 力量体系】`)
    parts.push(context.powerSystem)
  }

  if (context.protagonistProfile) {
    parts.push(`\n【设定 - 主角人设】`)
    parts.push(context.protagonistProfile)
  }

  if (context.protagonistGoal) {
    parts.push(`\n【设定 - 主角目标】`)
    parts.push(context.protagonistGoal)
  }

  if (context.antagonistSetting) {
    parts.push(`\n【设定 - 反派设定】`)
    parts.push(context.antagonistSetting)
  }

  // 上下文（前几章内容）- 正确取章节开头部分，保持故事连贯
  if (options.useContext && context.previousChapters && context.previousChapters.length > 0) {
    parts.push(`\n【上下文 - 前文章节内容】`)
    // 注意：context.previousChapters 已经在 context-manager 中正确处理
    for (const chapter of context.previousChapters) {
      // 取章节开头部分，确保故事的延续性和连贯性
      const relevantContent = chapter.content?.slice(0, 500) || ''
      parts.push(`\n=== 第${chapter.chapterNumber}章 "${chapter.title}" ===`)
      parts.push(relevantContent)
    }
  }

  if (context.virtualWriterStyle) {
    parts.push(`\n【设定 - 写作风格参考】`)
    if (context.virtualWriterStyle.styleFeatures) {
      parts.push(`整体风格：${context.virtualWriterStyle.styleFeatures}`)
    }
    if (context.virtualWriterStyle.vocabularyFeatures) {
      parts.push(`用词特征：${context.virtualWriterStyle.vocabularyFeatures}`)
    }
    if (context.virtualWriterStyle.sentenceFeatures) {
      parts.push(`句式特征：${context.virtualWriterStyle.sentenceFeatures}`)
    }
    if (context.virtualWriterStyle.rhetoricFeatures) {
      parts.push(`修辞手法：${context.virtualWriterStyle.rhetoricFeatures}`)
    }
    if (context.virtualWriterStyle.themeFeatures) {
      parts.push(`主题特征：${context.virtualWriterStyle.themeFeatures}`)
    }
  }

  // 【任务】
  parts.push(`\n【任务】`)
  parts.push(`请为第${context.currentChapterNumber}章生成一个吸引人的标题，然后撰写该章节内容。`)
  
  // 添加阶段大纲（如果有）
  if (context.stageOutline) {
    parts.push(`\n【本章阶段大纲】`)
    parts.push(context.stageOutline)
  }
  
  if (context.currentChapterSummary) {
    parts.push(`\n章节概要：${context.currentChapterSummary}`)
  }

  // 【输出格式】
  parts.push(`\n【输出格式】`)
  parts.push(`请按照以下格式输出：`)
  parts.push(`标题：[章节标题，不要包含"第X章"前缀，只写标题本身]`)
  parts.push(`内容：`)
  parts.push(`[章节内容]`)

  // 网文特性引导
  parts.push(`\n【网文写作要求】`)
  parts.push(`1. 章节开头需设置悬念/钩子，吸引读者继续阅读`)
  parts.push(`2. 内容需有"爽点"或"爆点"，让读者获得情感满足`)
  parts.push(`3. 合理控制节奏：铺垫（${Math.floor(CHAPTER_PACING.SETUP * 100)}%）→ 发展（${Math.floor(CHAPTER_PACING.DEVELOPMENT * 100)}%）→ 高潮（${Math.floor(CHAPTER_PACING.CLIMAX * 100)}%）`)
  parts.push(`4. 避免与前文重复的内容和表达，禁止"水字数"`)
  parts.push(`5. 保持人物性格一致性，注意对话的心理动机`)

  // 去AI味
  parts.push(`\n【去AI味 - 禁止使用】`)
  parts.push(`- 禁止排比句堆砌（如"他感到愤怒、悲伤、迷茫"）`)
  parts.push(`- 禁止"宛如""仿佛""犹如"等过度比喻`)
  parts.push(`- 禁止段落结构过于工整对称`)
  parts.push(`- 禁止"不禁""顿时""瞬间"等网文滥词`)
  parts.push(`- 禁止每段都以人名开头`)
  parts.push(`- 禁止用总结性陈述句结尾`)

  parts.push(`\n【去AI味 - 要求使用】`)
  parts.push(`- 口语化、不完整的句子，允许意识流`)
  parts.push(`- 人物内心独白要有语气词（"妈的""这也太离谱了吧""嗯？"）`)
  parts.push(`- 描写要有细节不均匀感：有时啰嗦有时跳跃，长短句交替`)
  parts.push(`- 段落长度参差不齐：有时一句话一段，有时五六句一段`)
  parts.push(`- 对话后不要每次都加动作描写，有时就是干对话`)
  parts.push(`- 重要情节可以"拖戏"，无聊过场一句话带过`)
  parts.push(`- 情绪不要直接说"他很愤怒"，通过行为细节体现，可以用身体反应代替心理描写`)
  parts.push(`- 允许轻微视角漂移和作者吐槽式插叙`)

  // 动态字数分配
  const chapterNum = context.currentChapterNumber
  let wordCountGuidance = ''
  if (chapterNum <= 3) {
    wordCountGuidance = '开篇章节，字数约2000-2500字，重点在于建立人设和世界观'
  } else if (chapterNum % 10 === 0) {
    wordCountGuidance = '阶段高潮章节，字数约3500-4500字，需有重大冲突和转折'
  } else {
    wordCountGuidance = '普通章节，字数约2500-3500字，平稳推进剧情'
  }
  parts.push(`\n【字数要求】${wordCountGuidance}`)

  parts.push(`\n请确保内容连贯、情节合理、人物性格一致。`)
  parts.push(`注意：禁止重复前文已有的情节描写和表达方式。`)

  return parts.join('\n')
}
