/**
 * 写作 Agent Prompt - 生成章节正文
 */
import { CHAPTER_WORD_COUNT, CHAPTER_PACING, AI_WRITE_FORBIDDEN } from '../shared/constants'
import type { ChapterOutline } from '@/lib/engine/types'

interface WriterPromptInput {
  projectTitle: string
  genre?: string | null
  writingStyle?: string | null
  worldSetting?: string | null
  powerSystem?: string | null
  chapterNo: number
  outline: ChapterOutline
  characterProfiles: string
  recentSummaries: string
  targetWordCount: number
}

export function buildWriterPrompt(input: WriterPromptInput): string {
  const parts: string[] = []

  parts.push(`【基础信息】`)
  parts.push(`标题：${input.projectTitle}`)
  if (input.genre) parts.push(`类型：${input.genre}`)
  if (input.writingStyle) parts.push(`写作风格：${input.writingStyle}`)

  if (input.worldSetting) {
    parts.push(`\n【世界观】`)
    parts.push(input.worldSetting)
  }

  if (input.powerSystem) {
    parts.push(`\n【力量体系】`)
    parts.push(input.powerSystem)
  }

  parts.push(`\n【出场角色档案】`)
  parts.push(input.characterProfiles)

  parts.push(`\n【前情摘要（最近3章）】`)
  parts.push(input.recentSummaries)

  parts.push(`\n【章节大纲】`)
  parts.push(JSON.stringify(input.outline, null, 2))

  parts.push(`\n【网文写作要求】`)
  parts.push(`1. 章节开头需设置悬念/钩子，吸引读者继续阅读`)
  parts.push(`2. 内容需有"爽点"或"爆点"，让读者获得情感满足`)
  parts.push(`3. 合理控制节奏：铺垫（${Math.floor(CHAPTER_PACING.SETUP * 100)}%）→ 发展（${Math.floor(CHAPTER_PACING.DEVELOPMENT * 100)}%）→ 高潮（${Math.floor(CHAPTER_PACING.CLIMAX * 100)}%）`)
  parts.push(`4. 避免与前文重复的内容和表达，禁止"水字数"`)
  parts.push(`5. 保持人物性格一致性，注意对话的心理动机`)

  // 去AI味 - 禁止使用
  parts.push(`\n【去AI味 - 禁止使用】`)
  parts.push(`- 禁止排比句堆砌（如"他感到愤怒、悲伤、迷茫"）`)
  parts.push(`- 禁止"宛如""仿佛""犹如"等过度比喻`)
  parts.push(`- 禁止"不禁""顿时""瞬间"等网文滥词`)
  parts.push(`- 禁止段落结构过于工整对称`)
  parts.push(`- 禁止每段都以人名开头`)

  // 去AI味 - 要求使用
  parts.push(`\n【去AI味 - 要求使用】`)
  parts.push(`- 口语化、不完整的句子，允许意识流`)
  parts.push(`- 人物内心独白要有语气词（"妈的""这也太离谱了吧""嗯？"）`)
  parts.push(`- 描写有细节不均匀感，长短句交替，段落长短参差不齐`)
  parts.push(`- 对话后不要每次都加动作描写，有时就是干对话`)
  parts.push(`- 重要情节可以"拖戏"，无聊过场一句话带过`)
  parts.push(`- 情绪通过行为细节体现，用身体反应代替心理描写`)
  parts.push(`- 允许轻微视角漂移和作者吐槽式插叙`)

  parts.push(`\n【任务】`)
  parts.push(`请根据以上大纲写出第${input.chapterNo}章正文。`)
  parts.push(`字数要求：${Math.floor(input.targetWordCount * (1 - CHAPTER_WORD_COUNT.TOLERANCE))}-${Math.floor(input.targetWordCount * (1 + CHAPTER_WORD_COUNT.TOLERANCE))}字`)
  parts.push(`输出格式：纯 Markdown 正文，不加任何 JSON 包装。`)

  return parts.join('\n')
}

// 类型导出
export type { WriterPromptInput }
