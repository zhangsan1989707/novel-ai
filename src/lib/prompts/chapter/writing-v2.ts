/**
 * 增强版写作 Agent Prompt - 精细化控制版本
 */
import { CHAPTER_WORD_COUNT, CHAPTER_PACING } from '../shared/constants'
import type { ChapterOutline } from '@/lib/engine/types'
import { getKnowledgeForGenre, getAntiAiPromptFragment } from '@/lib/knowledge'
import type { StyleProfilePromptCard, StyleSafetyMode } from '@/types/style'
import { buildStylePromptCard, buildStyleDirectiveForWriter } from '../style/style-card'

interface WriterPromptInput {
  projectTitle: string
  genre?: string | null
  writingStyle?: string | null
  memoryContext?: string
  worldSetting?: string | null
  powerSystem?: string | null
  chapterNo: number
  outline: ChapterOutline
  characterProfiles: string
  recentSummaries: string
  targetWordCount: number
  popularFictionProfile?: {
    emotionEngine?: { primaryEmotion?: string; readerPayoff?: string } | null
    cheatAbility?: { name?: string; oneLineRule?: string; limitation?: string; readerFantasy?: string } | null
    conflictEngine?: { conflictTypes?: string[]; hookStrategy?: string } | null
    characterTagEngine?: { protagonistTags?: string[]; behaviorProofs?: Array<{ tag: string; requiredScene: string; forbiddenBehavior: string }> } | null
  } | null
  /** 角色声音约束文本 */
  voiceConstraints?: string
  /** 风格调制指令 */
  styleDirective?: string
  styleProfilePromptCard?: StyleProfilePromptCard | null
  styleStrength?: number
  styleSafetyMode?: StyleSafetyMode
}

export function buildWriterPrompt(input: WriterPromptInput): string {
  const parts: string[] = []

  parts.push(`# 写作任务`)
  parts.push(`\n## 基础信息`)
  parts.push(`- 作品标题：${input.projectTitle}`)
  parts.push(`- 章节编号：第${input.chapterNo}章`)
  if (input.genre) parts.push(`- 小说类型：${input.genre}`)
  if (input.writingStyle) parts.push(`- 写作风格：${input.writingStyle}`)

  if (input.memoryContext) {
    parts.push(`\n## 记忆编排上下文`)
    parts.push(input.memoryContext)
  }

  if (input.worldSetting) {
    parts.push(`\n## 世界观设定`)
    parts.push(input.worldSetting)
  }

  if (input.powerSystem) {
    parts.push(`\n## 力量体系`)
    parts.push(input.powerSystem)
  }

  parts.push(`\n## 出场角色档案`)
  parts.push(input.characterProfiles)

  if (input.voiceConstraints) {
    parts.push(`\n## 角色声音一致性要求`)
    parts.push(input.voiceConstraints)
    parts.push(`\n- 每个角色的对话必须符合其语言指纹`)
    parts.push(`- 不同角色之间的对话风格必须有明显差异`)
    parts.push(`- 主角内心独白也需符合其用词层次`)
    parts.push(`- 有口头禅的角色在对应情绪场景下必须使用口头禅`)
  }

  parts.push(`\n## 前情摘要（最近3章）`)
  parts.push(input.recentSummaries)

  parts.push(`\n## 本章大纲`)
  parts.push(`### 章节标题`)
  parts.push(input.outline.chapterTitle)
  parts.push(`\n### 章节目标`)
  parts.push(input.outline.chapterGoal)
  parts.push(`\n### 主要冲突`)
  parts.push(input.outline.mainConflict)
  parts.push(`\n### 关键场景`)
  for (const scene of input.outline.keyScenes || []) {
    parts.push(`- 场景${(scene as unknown as Record<string, unknown>).sceneNumber || ''}：${scene.scene}`)
    if (scene.emotion) parts.push(`  情感基调：${scene.emotion}`)
    if (scene.characters?.length) parts.push(`  出场人物：${scene.characters.join('、')}`)
  }
  parts.push(`\n### 章节结尾`)
  parts.push(input.outline.ending)
  if (input.outline.foreshadows?.length) {
    parts.push(`\n### 需要埋设的伏笔`)
    for (const foreshadow of input.outline.foreshadows) {
      parts.push(`- ${foreshadow}`)
    }
  }
  if (input.outline.resolvedPlotlines?.length) {
    parts.push(`\n### 需要回收的伏笔`)
    for (const resolved of input.outline.resolvedPlotlines) {
      parts.push(`- ${resolved}`)
    }
  }

  if (input.popularFictionProfile) {
    parts.push(`\n## 爆款四因子硬要求`)
    parts.push(`- 本章主情绪：${input.outline.emotionTarget || input.popularFictionProfile.emotionEngine?.primaryEmotion || '爽'}`)
    parts.push(`- 本章回报：${input.outline.payoffTarget || input.popularFictionProfile.emotionEngine?.readerPayoff || '给读者明确反馈'}`)
    parts.push(`- 金手指使用：${input.outline.cheatUsage || `${input.popularFictionProfile.cheatAbility?.name || '主角优势'} / ${input.popularFictionProfile.cheatAbility?.oneLineRule || '一句话可解释'}`}`)
    parts.push(`- 金手指限制：${input.popularFictionProfile.cheatAbility?.limitation || '不要一次性暴露全部能力'}`)
    parts.push(`- 读者代入点：${input.popularFictionProfile.cheatAbility?.readerFantasy || '让读者觉得给我我也能翻盘'}`)
    parts.push(`- 冲突重点：${input.outline.conflictTarget || input.popularFictionProfile.conflictEngine?.conflictTypes?.join('、') || '本章必须有明确冲突'}`)
    parts.push(`- 人设证明：${input.outline.characterTagProof || input.popularFictionProfile.characterTagEngine?.behaviorProofs?.map(item => `${item.tag}:${item.requiredScene}`).join('；') || '通过行为证明主角标签'}`)
    parts.push(`- 结尾钩子：${input.outline.cliffhanger || input.popularFictionProfile.conflictEngine?.hookStrategy || '本章结尾必须留下新威胁或承诺'}`)
    parts.push(`- 禁止错误：${input.outline.forbiddenMistakes?.join('；') || '禁止大段设定说明、流水账、关键时刻圣母、复杂说明金手指'}`)
  }

  if (input.styleDirective) {
    parts.push(`\n${input.styleDirective}`)
  }

  if (input.styleProfilePromptCard) {
    const styleStrength = input.styleStrength ?? 0.5
    const safetyMode = input.styleSafetyMode ?? 'SAFE_ABSTRACT'
    const styleCard = buildStyleDirectiveForWriter(
      buildStylePromptCard({ ...input.styleProfilePromptCard, safetyMode }),
      styleStrength
    )
    if (styleCard) {
      parts.push(`\n${styleCard}`)
    }
  }

  parts.push(`\n## 写作规范`)
  
  parts.push(`\n### 节奏控制`)
  const setupEnd = Math.floor(input.targetWordCount * CHAPTER_PACING.SETUP)
  const devEnd = Math.floor(input.targetWordCount * (CHAPTER_PACING.SETUP + CHAPTER_PACING.DEVELOPMENT))
  parts.push(`- 开篇钩子（0-${setupEnd}字）：设置悬念，吸引读者`)
  parts.push(`- 情节发展（${setupEnd}-${devEnd}字）：铺垫冲突，积累张力`)
  parts.push(`- 高潮爆发（${devEnd}-${input.targetWordCount}字）：解决核心冲突`)
  parts.push(`- 章节结尾（最后200字）：留下钩子，为下章铺垫`)

  parts.push(`\n### 内容质量要求`)
  parts.push(`1. 每500字至少包含一个"爆点"或"爽点"`)
  parts.push(`2. 对话要有潜台词，不要都是表面意思`)
  parts.push(`3. 人物反应要符合性格，有差异化`)
  parts.push(`4. 场景描写要"五感"俱全，调动读者感官`)
  parts.push(`5. 避免与前文重复的表达和情节`)
  parts.push(`6. 本章必须提供明确情绪价值、明确冲突、明确人设证明和明确章节钩子`)

  parts.push(`\n### 叙事视角要求`)
  parts.push(`- 尽量保持第三人称视角一致`)
  parts.push(`- 限制"内心OS"数量，每章不超过3次`)
  parts.push(`- 允许轻微的视角漂移作为插叙使用`)

  const genre = input.genre || ''
  const knowledge = genre ? getKnowledgeForGenre(genre) : null

  if (knowledge) {
    if (knowledge.hooks.chapterStart.length > 0 || knowledge.hooks.chapterEnd.length > 0) {
      parts.push(`\n### 钩子技法参考`)
      if (knowledge.hooks.chapterStart.length > 0) {
        parts.push('章首钩子：')
        for (const h of knowledge.hooks.chapterStart) {
          parts.push(`- ${h.name}：${h.description}（例：${h.example}）`)
        }
      }
      if (knowledge.hooks.chapterEnd.length > 0) {
        parts.push('章尾钩子：')
        for (const h of knowledge.hooks.chapterEnd) {
          parts.push(`- ${h.name}：${h.description}（例：${h.example}）`)
        }
      }
      if (knowledge.hooks.paragraph.length > 0) {
        parts.push('段落钩子：')
        for (const h of knowledge.hooks.paragraph) {
          parts.push(`- ${h.name}：${h.description}（例：${h.example}）`)
        }
      }
    }

    if (knowledge.styles.length > 0) {
      parts.push(`\n### 风格技法参考`)
      for (const s of knowledge.styles) {
        parts.push(`- ${s.name}：${s.description}`)
        parts.push(`  规则：${s.rules.join('；')}`)
        if (s.examples.length > 0) {
          parts.push(`  ✓ ${s.examples[0].good}`)
          parts.push(`  ✗ ${s.examples[0].bad}`)
        }
      }
    }
  }

  parts.push(`\n### 禁止事项（去AI味）`)
  parts.push(`- 禁止排比句堆砌（如"他感到愤怒、悲伤、迷茫"）`)
  parts.push(`- 禁止"宛如""仿佛""犹如"等过度比喻`)
  parts.push(`- 禁止"不禁""顿时""瞬间"等网文滥词`)
  parts.push(`- 禁止段落结构过于工整对称`)
  parts.push(`- 禁止每段都以人名开头`)
  parts.push(`- 禁止过度使用"他的""她的"等物主代词开头`)
  parts.push(`- 禁止大段连续的环境描写（超过3段）`)
  parts.push(`- 禁止总结性陈述（不要写"这一战，他明白了一个道理..."）`)

  const antiAiExtra = getAntiAiPromptFragment()
  if (antiAiExtra) {
    parts.push(`\n### 去AI味扩展规则`)
    parts.push(antiAiExtra)
  }

  parts.push(`\n### 鼓励事项（增强人味）`)
  parts.push(`- 口语化表达，允许不完整的句子`)
  parts.push(`- 人物内心独白要有语气词（"妈的""这也太离谱了吧"）`)
  parts.push(`- 描写有细节不均匀感，长短句交替`)
  parts.push(`- 对话后不要每次都加动作描写，有时就是干对话`)
  parts.push(`- 重要情节可以"拖戏"，无聊过场一句话带过`)
  parts.push(`- 情绪通过行为细节体现，用身体反应代替心理描写`)
  parts.push(`- 允许轻微的作者吐槽式插叙`)
  parts.push(`- 关键时刻可以使用"留白"艺术`)

  if (knowledge) {
    if (knowledge.formula) {
      parts.push(`\n### 题材公式`)
      parts.push(`- 公式名称：${knowledge.formula.name}`)
      parts.push(`- 结构：${knowledge.formula.structure}`)
      parts.push(`- 核心要素：${knowledge.formula.keyElements.join('、')}`)
      parts.push(`- 节奏指南：${knowledge.formula.pacingGuide}`)
      parts.push(`- 读者期待：${knowledge.formula.readerExpectations.join('、')}`)
      parts.push(`- 常见陷阱（避免）：${knowledge.formula.commonPitfalls.join('、')}`)
    }

    if (knowledge.arcs.length > 0) {
      parts.push(`\n### 情绪弧线参考`)
      for (const arc of knowledge.arcs) {
        const phaseDescs = arc.phases.map(p => `${p.name}(情绪值${p.emotion})`)
        parts.push(`- ${arc.name}：${arc.description}（${phaseDescs.join(' → ')}）`)
      }
    }
  }

  parts.push(`\n## 字数要求`)
  parts.push(`目标字数：${input.targetWordCount}字`)
  parts.push(`允许范围：${Math.floor(input.targetWordCount * (1 - CHAPTER_WORD_COUNT.TOLERANCE))}-${Math.floor(input.targetWordCount * (1 + CHAPTER_WORD_COUNT.TOLERANCE))}字`)
  parts.push(`**请优先达到目标字数；如果内容还没写满，不要提前收尾，继续扩写到达要求。**`)

  parts.push(`\n## 输出要求`)
  parts.push(`- 仅输出 Markdown 格式的章节正文`)
  parts.push(`- 不要输出任何 JSON、元数据或额外说明`)
  parts.push(`- 章节标题使用 # 或 ## 标记`)

  return parts.join('\n')
}

// 类型导出
export type { WriterPromptInput }
