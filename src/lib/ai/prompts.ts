import type { PromptContext, BuildPromptOptions } from './types'
import { AnalysisDimension } from '@/types'

// P0-1: 统一 JSON 输出格式 - 完整字段类型说明
// P0-2: 增加网文特性引导 - 钩子/爽点/节奏
// P1-4: 增加 Few-shot 示例
// P1-5: 统一提示词结构 - 四段式：基础信息/设定/任务/输出格式
// P2-7: 添加重复内容检测约束

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

  // 【设定】(统一结构)
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

  // 上下文（前几章内容）
  if (options.useContext && context.previousChapters && context.previousChapters.length > 0) {
    parts.push(`\n【上下文 - 前文概要】`)
    const relevantChapters = context.previousChapters.slice(-options.contextChapterCount)
    for (const chapter of relevantChapters) {
      // P1-3: 改用摘要代替切片，保留关键情节信息
      const summary = chapter.content?.slice(-300) || ''
      parts.push(`第${chapter.chapterNumber}章 "${chapter.title}" 末尾：${summary}`)
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
  parts.push(`请撰写第${context.currentChapterNumber}章 "${context.currentChapterTitle}"`)
  if (context.currentChapterSummary) {
    parts.push(`章节概要：${context.currentChapterSummary}`)
  }

  // P0-2: 网文特性引导
  parts.push(`\n【网文写作要求】`)
  parts.push(`1. 章节开头需设置悬念/钩子，吸引读者继续阅读`)
  parts.push(`2. 内容需有"爽点"或"爆点"，让读者获得情感满足`)
  parts.push(`3. 合理控制节奏：铺垫（20%）→ 发展（50%）→ 高潮（30%）`)
  parts.push(`4. 避免与前文重复的内容和表达，禁止"水字数"`)
  parts.push(`5. 保持人物性格一致性，注意对话的心理动机`)

  // P2-6: 动态字数分配（按章节位置）
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

/**
 * 构建章节修改提示词
 */
export function buildRevisionPrompt(
  context: PromptContext,
  currentContent: string,
  revisionType: 'rewrite' | 'continue' | 'expand' | 'condense' | 'polish',
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

  if (context.protagonistProfile) {
    parts.push(`\n【设定 - 主角人设】`)
    parts.push(context.protagonistProfile)
  }

  if (context.protagonistGoal) {
    parts.push(`\n【设定 - 主角目标】`)
    parts.push(context.protagonistGoal)
  }

  // 【上下文】
  parts.push(`\n【上下文 - 当前章节】`)
  parts.push(`第${context.currentChapterNumber}章 "${context.currentChapterTitle}"`)
  if (context.currentChapterSummary) {
    parts.push(`章节概要：${context.currentChapterSummary}`)
  }

  // P1-3: 改用摘要代替全文切片
  const contentSummary = currentContent.slice(-1500)
  parts.push(`\n【上下文 - 章节内容末尾】`)
  parts.push(contentSummary)

  // 【任务】
  parts.push(`\n【任务类型】${revisionType === 'rewrite' ? '重写' : revisionType === 'continue' ? '续写' : revisionType === 'expand' ? '扩展' : revisionType === 'condense' ? '精简' : '润色'}`)

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

  // P0-2: 网文特性引导（改稿也需要）
  parts.push(`\n【网文写作要求】`)
  parts.push(`1. 章节开头需设置悬念/钩子`)
  parts.push(`2. 内容需有"爽点"或"爆点"`)
  parts.push(`3. 合理控制节奏`)
  parts.push(`4. 禁止与原文重复的表达，禁止"水字数"`)

  return parts.join('\n')
}

/**
 * 构建结局续写提示词
 */
export function buildEndingPrompt(
  context: PromptContext,
  options: {
    unresolvedForeshadowing: { setup: string; importance: string }[]
    openPlotlines: { title: string; keyEvents: string[] }[]
    characterArcs: { name: string; currentStatus: string; arcDescription?: string }[]
    endingDirection?: 'happy' | 'tragic' | 'open'
    targetChapterCount?: number
  }
): string {
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
    happy: '请提供积极向上的结局，主要角色获得成长和幸福，伏笔得到温馨回收',
    tragic: '可以有牺牲和遗憾，但要有深度和意义，让读者为角色的命运动容',
    open: '保持一定悬念，可以留白让读者想象，但核心伏笔需要回收'
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

  return parts.join('\n')
}

/**
 * 构建大纲生成提示词
 */
export function buildOutlineGenerationPrompt(
  projectTitle: string,
  genre?: string,
  writingStyle?: string,
  worldSetting?: string,
  protagonistProfile?: string,
  protagonistGoal?: string,
  antagonistSetting?: string,
  endingPlan?: string
): string {
  const parts: string[] = []

  // 【基础信息】
  parts.push(`【基础信息】`)
  parts.push(`标题：${projectTitle}`)
  if (genre) parts.push(`类型：${genre}`)
  if (writingStyle) parts.push(`写作风格：${writingStyle}`)

  // 【设定】
  if (worldSetting) {
    parts.push(`\n【设定 - 世界观】`)
    parts.push(worldSetting)
  }

  if (protagonistProfile) {
    parts.push(`\n【设定 - 主角人设】`)
    parts.push(protagonistProfile)
  }

  if (protagonistGoal) {
    parts.push(`\n【设定 - 主角目标】`)
    parts.push(protagonistGoal)
  }

  if (antagonistSetting) {
    parts.push(`\n【设定 - 反派设定】`)
    parts.push(antagonistSetting)
  }

  if (endingPlan) {
    parts.push(`\n【设定 - 结局规划】`)
    parts.push(endingPlan)
  }

  // 【任务】
  parts.push(`\n【任务】`)
  parts.push(`请为这部小说生成一个完整的分阶段大纲。`)
  parts.push(`大纲应分为4个阶段：开篇、发展、中期、结局。`)
  parts.push(`每个阶段应包含：阶段名称、核心事件、章节规划。`)

  // P0-1: 完整 JSON 字段说明
  // P1-4: Few-shot 示例
  parts.push(`\n【输出格式】`)
  parts.push(`请以 JSON 格式输出，字段说明：`)
  parts.push(`- stages: 阶段数组，每个阶段包含 {name, description, coreEvents, chapterPlan}`)
  parts.push(`- stages[].name: string, 阶段名称（如"开篇"）`)
  parts.push(`- stages[].description: string, 阶段概述（50-100字）`)
  parts.push(`- stages[].coreEvents: string[], 核心事件列表（3-5个）`)
  parts.push(`- stages[].chapterPlan: string, 章节规划说明（100-200字）`)
  parts.push(`\n示例输出：`)
  parts.push(`{
  "stages": [
    {
      "name": "开篇",
      "description": "主人公意外获得异能，面临第一个重大挑战",
      "coreEvents": ["获得异能", "遭遇敌人", "结交伙伴"],
      "chapterPlan": "第1-10章，重点建立世界观和主角初始能力"
    }
  ]
}`)

  return parts.join('\n')
}

/**
 * 构建创意生成提示词
 */
export function buildIdeaGenerationPrompt(
  theme: string,
  genre?: string,
  writingStyle?: string
): string {
  const parts: string[] = []

  // 【基础信息】
  parts.push(`【基础信息】`)
  parts.push(`创作主题：${theme}`)
  if (genre) parts.push(`期望类型：${genre}`)
  if (writingStyle) parts.push(`期望风格：${writingStyle}`)

  // 【任务】
  parts.push(`\n【任务】`)
  parts.push(`请基于以上主题，生成一套完整的网络小说创意设定。`)

  // P0-1: 完整 JSON 字段说明
  // P1-4: Few-shot 示例
  parts.push(`\n【输出格式】`)
  parts.push(`请以 JSON 格式输出，字段说明：`)
  parts.push(`- worldSetting: string, 世界观设定描述（200-500字）`)
  parts.push(`- powerSystem: string, 力量体系说明（100-300字）`)
  parts.push(`- protagonistProfile: string, 主角人设描述（150-300字，含外貌、性格、背景）`)
  parts.push(`- protagonistGoal: string, 主角目标（50-100字）`)
  parts.push(`- antagonistSetting: string, 反派设定（100-200字）`)
  parts.push(`- endingPlan: string, 结局规划（100-200字）`)
  parts.push(`- hooks: string[], 章节钩子设计示例（3-5个，30-50字/个）`)
  parts.push(`- highlights: string[], 爽点设计示例（3-5个，20-30字/个）`)
  parts.push(`\n示例输出：`)
  parts.push(`{
  "worldSetting": "灵气复苏时代，人类可通过修炼突破极限...",
  "powerSystem": "九品修炼制：一品炼体、九品通天，每品有明确特征...",
  "protagonistProfile": "林凡，20岁，看似普通的大学毕业生，实为千年难遇...",
  "protagonistGoal": "找到失踪的父母，揭开远古秘密",
  "antagonistSetting": "暗影教团，表面正义实则另有目的...",
  "endingPlan": "最终揭示父母下落，主角突破九品但选择隐退...",
  "hooks": ["看似普通的室友实为隐藏身份", "考试第一名却遭遇神秘势力"],
  "highlights": ["越级战胜强敌", "获得稀有宝物", "红颜知己倾心"]
}`)

  return parts.join('\n')
}

/**
 * 构建章节列表生成提示词 (内联在 route.ts)
 */
export function buildChapterListPrompt(
  projectTitle: string,
  genre?: string,
  writingStyle?: string,
  worldSetting?: string,
  protagonistProfile?: string,
  protagonistGoal?: string,
  antagonistSetting?: string,
  endingPlan?: string,
  totalChapters: number = 50,
  titleStyle: 'webnovel' | 'traditional' | 'poetry' = 'webnovel'
): string {
  const parts: string[] = []

  // 【基础信息】
  parts.push(`【基础信息】`)
  parts.push(`标题：${projectTitle}`)
  if (genre) parts.push(`类型：${genre}`)
  if (writingStyle) parts.push(`写作风格：${writingStyle}`)

  // 【设定】
  if (worldSetting) {
    parts.push(`\n【设定 - 世界观】`)
    parts.push(worldSetting)
  }

  if (protagonistProfile) {
    parts.push(`\n【设定 - 主角人设】`)
    parts.push(protagonistProfile)
  }

  if (protagonistGoal) {
    parts.push(`\n【设定 - 主角目标】`)
    parts.push(protagonistGoal)
  }

  if (antagonistSetting) {
    parts.push(`\n【设定 - 反派设定】`)
    parts.push(antagonistSetting)
  }

  if (endingPlan) {
    parts.push(`\n【设定 - 结局规划】`)
    parts.push(endingPlan)
  }

  // 【任务】
  parts.push(`\n【任务】`)
  parts.push(`请为这部小说生成一个完整的章节列表，共${totalChapters}章。`)

  // P0-2: 网文特性引导
  parts.push(`\n【网文章节要求】`)
  parts.push(`1. 每个章节需有吸睛标题，能激发读者好奇心`)
  parts.push(`2. 章节之间需有合理的情节推进和连贯性`)
  parts.push(`3. 每章结尾需设置悬念或钩子，吸引继续阅读`)
  parts.push(`4. 前10章为开篇期，需快速建立人设和世界观`)
  parts.push(`5. 中期（${Math.floor(totalChapters * 0.4)}-${Math.floor(totalChapters * 0.7)}章）需有持续冲突升级`)
  parts.push(`6. 后期（${Math.floor(totalChapters * 0.7)}-${totalChapters}章）需有重大转折和高潮`)

  // 标题风格说明
  const titleStyleGuide = {
    webnovel: '网文风格：吸睛、有悬念，例如"第3章 他竟然是隐藏的首富？" 或 "第5章 雨夜中的神秘告白"',
    traditional: '传统风格：简洁、概括，例如"第3章 意外的相遇" 或 "第5章 暗流涌动"',
    poetry: '诗词风格：文艺、对仗、有意境，例如"第3回 风雪夜归人" 或 "第5回 暗香浮动月黄昏"',
  }
  parts.push(`\n【标题风格】${titleStyleGuide[titleStyle]}`)

  // P0-1: 完整 JSON 字段说明
  // P1-4: Few-shot 示例
  parts.push(`\n【输出格式】`)
  parts.push(`请以 JSON 格式输出，字段说明：`)
  parts.push(`- chapters: 章节数组`)
  parts.push(`- chapters[].chapterNumber: number, 章节序号（1-${totalChapters}）`)
  parts.push(`- chapters[].title: string, 章节标题`)
  parts.push(`- chapters[].summary: string, 章节概要（50-100字，概括本章核心事件）`)
  parts.push(`- chapters[].wordCount: number, 预估字数（2000-5000之间）`)
  parts.push(`- chapters[].plotType: string, 情节类型（setup/develop/climax/resolution/transition）`)
  parts.push(`\n示例输出：`)
  parts.push(`{
  "chapters": [
    {
      "chapterNumber": 1,
      "title": "第1章 平凡少年的意外",
      "summary": "即将毕业的大学生林凡在兼职途中意外撞见一场神秘事件...",
      "wordCount": 3500,
      "plotType": "setup"
    },
    {
      "chapterNumber": 2,
      "title": "第2章 隐藏的真相",
      "summary": "林凡发现自己竟拥有异能，神秘女子出现告知其身世...",
      "wordCount": 4000,
      "plotType": "development"
    }
  ]
}`)

  return parts.join('\n')
}

/**
 * 构建拆书分析提示词
 */
export function buildPlotAnalysisPrompt(
  context: {
    projectTitle: string
    genre?: string
    worldSetting?: string
    powerSystem?: string
    protagonistProfile?: string
    antagonistSetting?: string
    previousChapters?: { chapterNumber: number; title: string; content: string }[]
  },
  options: {
    dimensions: AnalysisDimension[]
    volumeNumber: number
    contextChapterCount: number
    isFullBookAnalysis?: boolean  // 整书分析时传 true，不限制章节数量
  }
): string {
  const parts: string[] = []
  const { dimensions, volumeNumber, contextChapterCount } = options

  // 【基础信息】
  parts.push(`【基础信息】`)
  if (volumeNumber === -1) {
    parts.push(`分析范围：整书分析`)
  } else if (volumeNumber === 0) {
    parts.push(`分析范围：全卷分析`)
  } else {
    parts.push(`分析范围：第${volumeNumber}卷分析`)
  }
  parts.push(`标题：${context.projectTitle}`)
  if (context.genre) parts.push(`类型：${context.genre}`)

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
  if (context.antagonistSetting) {
    parts.push(`\n【设定 - 反派设定】`)
    parts.push(context.antagonistSetting)
  }

  // 【待分析内容】
  if (context.previousChapters && context.previousChapters.length > 0) {
    parts.push(`\n【待分析内容】`)
    // 整书分析时传入所有章节，否则只传最近的 N 章
    const relevantChapters = options.isFullBookAnalysis
      ? context.previousChapters
      : context.previousChapters.slice(-contextChapterCount)
    for (const chapter of relevantChapters) {
      parts.push(`\n--- 第${chapter.chapterNumber}章 "${chapter.title}" ---`)
      parts.push(chapter.content)
    }
  }

  // 【输出要求 - 每个维度独立输出】
  const dimensionLabels: Record<AnalysisDimension, string> = {
    [AnalysisDimension.CHARACTER_RELATION]: '人物关系分析',
    [AnalysisDimension.PLOT_LINE]: '剧情线梳理',
    [AnalysisDimension.FORESHADOWING]: '伏笔悬念标记',
    [AnalysisDimension.CHAPTER_STRUCTURE]: '章节结构分析',
    [AnalysisDimension.WORLD_SETTING]: '世界观设定提取',
  }

  // P0-1: 每个维度完整字段说明
  // P1-4: 每个维度 Few-shot 示例
  const formatTemplates: Record<AnalysisDimension, string> = {
    [AnalysisDimension.CHARACTER_RELATION]: `{
  "characters": [
    {
      "name": "角色名",
      "role": "protagonist|antagonist|supporting|minor",
      "description": "角色描述（50-100字）",
      "relationships": [
        { "target": "相关角色", "type": "关系类型如：兄弟/敌对/爱慕", "description": "关系描述" }
      ]
    }
  ],
  "summary": "人物关系整体概述（100-200字）"
}`,
    [AnalysisDimension.PLOT_LINE]: `{
  "mainPlot": [
    { "title": "主线标题", "keyEvents": ["关键事件1", "关键事件2"], "emotionalArc": "情感弧线描述" }
  ],
  "subPlots": [
    { "title": "副线标题", "keyEvents": ["关键事件"], "relationship": "与主线关联" }
  ],
  "timeline": [
    { "event": "事件", "chapter": 章节号, "significance": "重要程度:major|minor" }
  ]
}`,
    [AnalysisDimension.FORESHADOWING]: `{
  "items": [
    {
      "setup": "伏笔内容（首次出现）",
      "description": "伏笔描述（30-50字）",
      "payoff": "回收位置（章节号或待回收）",
      "chapter": 章节号,
      "importance": "major|minor",
      "type": "plot|character|world|prophecy"
    }
  ],
  "unresolved": ["未回收伏笔列表"]
}`,
    [AnalysisDimension.CHAPTER_STRUCTURE]: `{
  "chapters": [
    {
      "number": 1,
      "title": "章节标题",
      "function": "setup|development|climax|resolution|transition",
      "keyEvents": ["关键事件"],
      "wordCount": 字数,
      "emotionalBeat": "本章情感基调"
    }
  ],
  "arcAnalysis": "整体结构分析（200-300字）",
  "pacingAssessment": "节奏评估"
}`,
    [AnalysisDimension.WORLD_SETTING]: `{
  "settings": [
    {
      "name": "设定名称",
      "description": "详细描述（100-200字）",
      "rules": ["规则1", "规则2"],
      "firstAppear": "首次出现章节"
    }
  ],
  "powerSystem": {
    "name": "力量体系名称",
    "levels": ["等级1", "等级2"],
    "rules": ["修炼规则1", "规则2"]
  },
  "locations": [
    { "name": "地名", "description": "描述", "significance": "重要程度" }
  ]
}`,
  }

  parts.push(`\n【输出要求】`)
  parts.push(`请对以上内容进行深度分析，按指定维度输出结构化结果。`)

  for (const dim of dimensions) {
    parts.push(`\n【${dimensionLabels[dim]}】`)
    parts.push('字段说明：')
    parts.push(formatTemplates[dim])
  }

  return parts.join('\n')
}

/**
 * 构建简介生成/润色提示词
 */
export function buildSynopsisGenerationPrompt(params: {
  projectTitle: string
  existingSynopsis?: string
  targetAudience?: 'MALE' | 'FEMALE'
  genre?: string
  writingStyle?: string
  worldSetting?: string
  powerSystem?: string
  protagonistProfile?: string
  protagonistGoal?: string
  antagonistSetting?: string
  endingPlan?: string
  outline?: string
  targetWordCount?: number
}): string {
  const parts: string[] = []

  // 【基础信息】
  parts.push(`【基础信息】`)
  parts.push(`标题：${params.projectTitle}`)
  if (params.targetAudience) {
    parts.push(`目标受众：${params.targetAudience === 'MALE' ? '男频（男性读者为主）' : '女频（女性读者为主）'}`)
  }
  if (params.genre) parts.push(`类型：${params.genre}`)
  if (params.writingStyle) parts.push(`写作风格：${params.writingStyle}`)
  if (params.targetWordCount) parts.push(`目标字数：${params.targetWordCount}字`)

  // 【设定】
  if (params.worldSetting) {
    parts.push(`\n【设定 - 世界观】`)
    parts.push(params.worldSetting)
  }

  if (params.powerSystem) {
    parts.push(`\n【设定 - 力量体系】`)
    parts.push(params.powerSystem)
  }

  if (params.protagonistProfile) {
    parts.push(`\n【设定 - 主角人设】`)
    parts.push(params.protagonistProfile)
  }

  if (params.protagonistGoal) {
    parts.push(`\n【设定 - 主角目标】`)
    parts.push(params.protagonistGoal)
  }

  if (params.antagonistSetting) {
    parts.push(`\n【设定 - 反派设定】`)
    parts.push(params.antagonistSetting)
  }

  if (params.endingPlan) {
    parts.push(`\n【设定 - 结局规划】`)
    parts.push(params.endingPlan)
  }

  if (params.outline) {
    parts.push(`\n【设定 - 故事大纲】`)
    parts.push(params.outline)
  }

  // 【任务】
  parts.push(`\n【任务】`)

  if (params.existingSynopsis) {
    parts.push(`\n【现有简介】`)
    parts.push(params.existingSynopsis)
    parts.push(`\n请对以上简介进行润色和改进，使其更加吸引人、有感染力。`)
    parts.push(`保持原有的核心信息和风格，可以适当扩展和深化。`)
  } else {
    parts.push(`请根据以上小说设定，生成一个吸引人的小说简介。`)
    parts.push(`简介应该：`)
    parts.push(`1. 突出故事的独特卖点和核心冲突`)
    parts.push(`2. 简要介绍主角及其面临的挑战`)
    parts.push(`3. 营造悬念，吸引读者继续阅读`)
    parts.push(`4. 体现小说的类型特点和风格`)
  }

  // P0-2: 网文简介特性引导
  parts.push(`\n【简介写作要求】`)
  parts.push(`1. 前3句话必须包含最大悬念或最强冲突点`)
  parts.push(`2. 突出"爽点"和"看点"，让读者感受到阅读收益`)
  parts.push(`3. 主角名字和关键设定需在前100字内出现`)
  parts.push(`4. 避免平铺直叙，要有节奏感和张力`)
  parts.push(`5. 字数控制在200-500字之间`)

  parts.push(`\n请直接输出简介内容，不要添加标题或格式。`)

  return parts.join('\n')
}
