/**
 * 章节列表生成提示词
 */
import { TITLE_STYLES } from '../shared/constants'

interface ChapterListGenerationInput {
  projectTitle: string
  genre?: string
  writingStyle?: string
  worldSetting?: string
  protagonistProfile?: string
  protagonistGoal?: string
  antagonistSetting?: string
  endingPlan?: string
  totalChapters: number
  titleStyle: 'webnovel' | 'traditional' | 'poetry'
  outline?: string
  outlineStages?: Record<string, any>
  existingChapters?: Array<{
    chapterNumber: number
    title: string
    summary: string
  }>
}

/**
 * 构建章节列表生成提示词
 */
export function buildChapterListPrompt(input: ChapterListGenerationInput): string {
  const parts: string[] = []
  const hasExistingChapters = input.existingChapters && input.existingChapters.length > 0
  const existingCount = hasExistingChapters ? (input.existingChapters || []).length : 0

  // 【基础信息】
  parts.push(`【基础信息】`)
  parts.push(`标题：${input.projectTitle}`)
  if (input.genre) parts.push(`类型：${input.genre}`)
  if (input.writingStyle) parts.push(`写作风格：${input.writingStyle}`)

  // 【设定】
  if (input.worldSetting) {
    parts.push(`\n【设定 - 世界观】`)
    parts.push(input.worldSetting)
  }

  if (input.protagonistProfile) {
    parts.push(`\n【设定 - 主角人设】`)
    parts.push(input.protagonistProfile)
  }

  if (input.protagonistGoal) {
    parts.push(`\n【设定 - 主角目标】`)
    parts.push(input.protagonistGoal)
  }

  if (input.antagonistSetting) {
    parts.push(`\n【设定 - 反派设定】`)
    parts.push(input.antagonistSetting)
  }

  if (input.endingPlan) {
    parts.push(`\n【设定 - 结局规划】`)
    parts.push(input.endingPlan)
  }

  // 【已有章节】- 如果有已有章节
  if (hasExistingChapters) {
    parts.push(`\n【已有章节】`)
    parts.push(`以下是已经存在的章节，请在此基础上继续生成后续章节：`)
    for (const chapter of input.existingChapters!) {
      parts.push(`- 第${chapter.chapterNumber}章: ${chapter.title}`)
      parts.push(`  概要: ${chapter.summary}`)
    }
  }

  // 【大纲参考】- 如果有大纲，优先参考
  if (input.outlineStages && Object.keys(input.outlineStages).length > 0) {
    parts.push(`\n【大纲参考 - 章节分配】`)
    parts.push(`请严格按照以下大纲的阶段规划来生成章节列表。`)
    parts.push(`全书共 ${input.totalChapters} 章，各阶段的章节分配如下：`)
    
    if (input.outlineStages.stages && Array.isArray(input.outlineStages.stages)) {
      const stages = input.outlineStages.stages as Array<{
        name: string
        description: string
        coreEvents?: string[]
        chapterRatio?: number
        chapterPlan?: string
      }>
      
      const ratios = stages.map((s) => s.chapterRatio ?? (1 / stages.length))
      const ratioSum = ratios.reduce((a: number, b: number) => a + b, 0)
      const normalized = ratios.map((r: number) => r / ratioSum)
      
      let chapterCursor = 1
      const stageRanges: Array<{ name: string; start: number; end: number; description: string; coreEvents: string[]; chapterPlan: string }> = []
      
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i]
        let count: number
        if (i === stages.length - 1) {
          count = input.totalChapters - chapterCursor + 1
        } else {
          count = Math.max(1, Math.round(normalized[i] * input.totalChapters))
        }
        const start = chapterCursor
        const end = chapterCursor + count - 1
        stageRanges.push({
          name: stage.name,
          start,
          end,
          description: stage.description || '',
          coreEvents: stage.coreEvents || [],
          chapterPlan: stage.chapterPlan || '',
        })
        chapterCursor = end + 1
      }
      
      for (const range of stageRanges) {
        parts.push(`\n【${range.name}】第${range.start}-${range.end}章（共${range.end - range.start + 1}章）`)
        parts.push(`阶段概述：${range.description}`)
        parts.push(`核心事件：${range.coreEvents.join('、')}`)
        parts.push(`章节规划：${range.chapterPlan}`)
      }
      
      parts.push(`\n⚠️ 你必须严格按照以上章节分配来生成章节，每个阶段的章节数必须与分配一致！`)
    } else {
      parts.push(JSON.stringify(input.outlineStages, null, 2))
    }
  } else if (input.outline) {
    parts.push(`\n【大纲参考】`)
    parts.push(input.outline)
  }

  // 【任务 - 重要：严格控制章节数量】
  parts.push(`\n【任务 - 重要】`)
  if (hasExistingChapters) {
    // 继续生成模式
    const startChapter = existingCount + 1
    const endChapter = input.totalChapters
    const chaptersToGenerate = endChapter - existingCount
    parts.push(`⚠️ 已有 ${existingCount} 章，你需要继续生成从第 ${startChapter} 章到第 ${endChapter} 章，共 ${chaptersToGenerate} 章！`)
    parts.push(`注意：章节号必须从 ${startChapter} 开始连续编号！`)
    parts.push(`⚠️ 确保新增章节能承接最后一章（第${existingCount}章）的剧情，保持情节连贯性！`)
  } else {
    // 全新生成
    parts.push(`⚠️ 你必须严格生成 EXACTLY ${input.totalChapters} 章，不多也不少！`)
    parts.push(`如果生成超过 ${input.totalChapters} 章或少于 ${input.totalChapters} 章，都将导致任务失败。`)
  }

  // 【网文章节要求】
  const hasOutlineStages = input.outlineStages && Object.keys(input.outlineStages).length > 0
  parts.push(`\n【网文章节要求】`)
  parts.push(`1. 每个章节需有吸睛标题，能激发读者好奇心`)
  parts.push(`2. 章节之间需有合理的情节推进和连贯性`)
  parts.push(`3. 每章结尾需设置悬念或钩子，吸引继续阅读`)
  if (!hasExistingChapters) {
    if (hasOutlineStages) {
      parts.push(`4. 请严格按照上方【大纲参考 - 章节分配】中各阶段的章节范围来安排情节节奏`)
      parts.push(`5. 每个阶段的核心事件必须在该阶段的章节范围内完成`)
    } else {
      parts.push(`4. 前${Math.max(3, Math.floor(input.totalChapters * 0.1))}章为开篇期，需快速建立人设和世界观`)
      parts.push(`5. 中期（${Math.floor(input.totalChapters * 0.4)}-${Math.floor(input.totalChapters * 0.7)}章）需有持续冲突升级`)
      parts.push(`6. 后期（${Math.floor(input.totalChapters * 0.7)}-${input.totalChapters}章）需有重大转折和高潮`)
    }
  }

  // 【标题风格】
  const titleStyleGuide = {
    [TITLE_STYLES.WEBNOVEL]: '网文风格：吸睛、有悬念，例如"第3章 他竟然是隐藏的首富？" 或 "第5章 雨夜中的神秘告白"',
    [TITLE_STYLES.TRADITIONAL]: '传统风格：简洁、概括，例如"第3章 意外的相遇" 或 "第5章 暗流涌动"',
    [TITLE_STYLES.POETRY]: '诗词风格：文艺、对仗、有意境，例如"第3回 风雪夜归人" 或 "第5回 暗香浮动月黄昏"',
  }
  parts.push(`\n【标题风格】${titleStyleGuide[input.titleStyle]}`)

  // 【输出格式 - 必须严格遵守】
  parts.push(`\n【输出格式 - 必须严格遵守】`)
  const outputChapterCount = hasExistingChapters ? (input.totalChapters - existingCount) : input.totalChapters
  const startChapterNumber = hasExistingChapters ? (existingCount + 1) : 1
  const endChapterNumber = input.totalChapters

  parts.push(`⚠️ 重要：你必须输出一个包含 EXACTLY ${outputChapterCount} 个章节的 JSON 数组！`)
  parts.push(`输出格式要求（请严格参照以下示例）：`)
  parts.push(`{`)
  parts.push(`  "chapters": [`)
  parts.push(`    {`)
  parts.push(`      "chapterNumber": ${startChapterNumber},`)
  parts.push(`      "title": "第${startChapterNumber}章 死亡倒计时：第一个规则是别相信任何人",`)
  parts.push(`      "summary": "主角在上班途中收到一条神秘短信，告知他已被选入死亡游戏，必须遵守规则才能活过今晚。第一条规则是：别相信任何人。他发现身边的同事似乎都在隐藏秘密，而倒计时已经开始。",`)
  parts.push(`      "wordCount": 3000,`)
  parts.push(`      "plotType": "setup"`)
  parts.push(`    },`)
  parts.push(`    {`)
  parts.push(`      "chapterNumber": ${startChapterNumber + 1},`)
  parts.push(`      "title": "第${startChapterNumber + 1}章 密室里的连环谋杀：谁才是真正的猎手？",`)
  parts.push(`      "summary": "主角与五名陌生人被困在密室中，每隔一小时就有一人被杀。他必须在下一个倒计时结束前找出凶手，但每个人都可能是猎手，包括他自己。",`)
  parts.push(`      "wordCount": 3000,`)
  parts.push(`      "plotType": "develop"`)
  parts.push(`    }`)
  parts.push(`    // ... 必须恰好 ${outputChapterCount} 个章节条目，每个都必须有summary！`)
  parts.push(`  ]`)
  parts.push(`}`)
  parts.push(`字段说明：`)
  if (hasExistingChapters) {
    parts.push(`- chapters[].chapterNumber: 必须是从 ${startChapterNumber} 到 ${endChapterNumber} 的连续整数`)
  } else {
    parts.push(`- chapters[].chapterNumber: 必须是从 1 到 ${input.totalChapters} 的连续整数`)
  }
  parts.push(`- chapters[].title: 章节标题`)
  parts.push(`- chapters[].summary: ⚠️ 绝对必填！每个章节都必须有50-100字的概要描述！`)
  parts.push(`  ❌ 严禁出现空字符串""、null、undefined或省略该字段！`)
  parts.push(`  ❌ 严禁只写"待补充"、"暂无"等占位文字！`)
  parts.push(`  ✅ 必须为每个章节写出具体的情节概要，包含主要事件和冲突！`)
  parts.push(`  示例："主角在逃亡中触发银色硬币，被拉入时间裂缝，看到三天前的自己手中握着字条"`)
  parts.push(`- chapters[].wordCount: 预估字数（2000-5000之间）`)
  parts.push(`- chapters[].plotType: 情节类型（setup/develop/climax/resolution/transition）`)

  return parts.join('\n')
}

export function buildSummaryCompletionPrompt(
  chapters: Array<{ chapterNumber: number; title: string; summary?: string }>,
  projectTitle: string,
  genre?: string
): string {
  const parts: string[] = []
  const missingChapters = chapters.filter(ch => !ch.summary || !ch.summary.trim())

  parts.push(`你是一个专业的小说编辑。以下是一部小说的章节列表，其中部分章节缺少概要描述。`)
  parts.push(`请为每个缺少概要的章节补充50-100字的具体情节概要。`)
  parts.push(`概要必须包含该章的主要事件、冲突或悬念，不得使用占位文字。`)
  parts.push(``)
  parts.push(`小说标题：${projectTitle}`)
  if (genre) parts.push(`类型：${genre}`)
  parts.push(``)
  parts.push(`完整章节列表：`)

  for (const ch of chapters) {
    if (ch.summary && ch.summary.trim()) {
      parts.push(`第${ch.chapterNumber}章 ${ch.title}：${ch.summary}`)
    } else {
      parts.push(`第${ch.chapterNumber}章 ${ch.title}：【缺少概要，需要补充】`)
    }
  }

  parts.push(``)
  parts.push(`请只为缺少概要的章节补充，输出JSON格式：`)
  parts.push(`{`)
  parts.push(`  "summaries": [`)
  for (const ch of missingChapters) {
    parts.push(`    { "chapterNumber": ${ch.chapterNumber}, "summary": "第${ch.chapterNumber}章的概要描述" },`)
  }
  parts.push(`  ]`)
  parts.push(`}`)
  parts.push(``)
  parts.push(`注意：chapterNumber 必须与上面缺少概要的章节号完全对应！`)

  return parts.join('\n')
}

// 类型导出
export type { ChapterListGenerationInput }
