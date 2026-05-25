/**
 * 增强版策划 Agent Prompt - 精细化章节结构设计
 */

interface PlannerPromptInput {
  projectTitle: string
  genre?: string | null
  writingStyle?: string | null
  memoryContext?: string
  worldSetting?: string | null
  powerSystem?: string | null
  protagonistProfile?: string | null
  antagonistSetting?: string | null
  chapterNo: number
  recentChapterSummaries: { chapterNo: number; summary: string }[]
  openPlotlines: { id: string; description: string }[]
  emotionalArc: { chapterNo: number; value: number }[]
  targetWordCount: number
  popularFictionProfile?: {
    emotionEngine?: { primaryEmotion?: string; openingBomb?: string; readerPayoff?: string; forbiddenSlowStart?: boolean } | null
    cheatAbility?: { name?: string; oneLineRule?: string; readerFantasy?: string } | null
    conflictEngine?: { conflictTypes?: string[]; conflictFrequency?: string; payoffInterval?: string; hookStrategy?: string } | null
    characterTagEngine?: { protagonistTags?: string[]; behaviorProofs?: Array<{ tag: string; requiredScene: string; forbiddenBehavior: string }> } | null
  } | null
}

interface PlannerPromptOutput {
  chapterTitle: string
  chapterGoal: string
  mainConflict: string
  keyScenes: Array<{
    scene: string
    characters?: string[]
    emotion?: string
  }>
  ending: string
  foreshadows?: string[]
  resolvedPlotlines?: string[]
}

export function buildPlannerPrompt(input: PlannerPromptInput): string {
  const parts: string[] = []

  parts.push(`# 章节策划任务`)
  parts.push(`\n## 基础信息`)
  parts.push(`- 作品标题：${input.projectTitle}`)
  parts.push(`- 章节编号：第${input.chapterNo}章`)
  parts.push(`- 目标字数：${input.targetWordCount}字`)
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

  if (input.protagonistProfile) {
    parts.push(`\n## 主角人设`)
    parts.push(input.protagonistProfile)
  }

  if (input.antagonistSetting) {
    parts.push(`\n## 反派设定`)
    parts.push(input.antagonistSetting)
  }

  if (input.recentChapterSummaries.length > 0) {
    parts.push(`\n## 前情摘要（最近3章）`)
    for (const ch of input.recentChapterSummaries) {
      parts.push(`**第${ch.chapterNo}章**：${ch.summary}`)
    }
  }

  if (input.openPlotlines.length > 0) {
    parts.push(`\n## 进行中的剧情线/伏笔`)
    for (const pl of input.openPlotlines) {
      parts.push(`- [ ] ${pl.description}`)
    }
    parts.push(`\n**策划要求**：本章必须推进或提及至少1个进行中的伏笔`)
  }

  if (input.emotionalArc.length > 0) {
    parts.push(`\n## 情绪热度曲线分析`)
    const recentArc = input.emotionalArc.slice(-5)
    parts.push(`最近5章热度值：${recentArc.map(p => p.value).join(' → ')}`)
    
    const currentHeat = input.emotionalArc[input.emotionalArc.length - 1]?.value || 50
    const avgHeat = recentArc.reduce((sum, p) => sum + p.value, 0) / recentArc.length
    
    parts.push(`\n### 热度分析`)
    if (currentHeat < 30) {
      parts.push(`- 当前情绪偏低（${currentHeat}）`)
      parts.push(`- 建议：本章适合升温、设置新冲突、或让角色做出重大决策`)
    } else if (currentHeat > 70) {
      parts.push(`- 当前情绪偏高（${currentHeat}）`)
      parts.push(`- 建议：本章适合高潮延续、或短暂缓冲后引出新冲突`)
    } else {
      parts.push(`- 当前情绪平稳（${currentHeat}）`)
      parts.push(`- 建议：本章适合稳步推进主线冲突`)
    }
    
    if (avgHeat < 40 && currentHeat > 60) {
      parts.push(`\n⚠️ 注意：从低潮突然跳到高潮，节奏变化较大，需做好过渡`)
    } else if (avgHeat > 60 && currentHeat < 40) {
      parts.push(`\n⚠️ 注意：从高潮突然回落，需要处理好读者情绪落差`)
    }
  }

  if (input.popularFictionProfile) {
    parts.push(`\n## 爆款四因子约束`)
    parts.push(`- 主情绪：${input.popularFictionProfile.emotionEngine?.primaryEmotion || '爽'}`)
    parts.push(`- 开篇情绪炸弹：${input.popularFictionProfile.emotionEngine?.openingBomb || '第一屏就给读者情绪刺激'}`)
    parts.push(`- 读者回报：${input.popularFictionProfile.emotionEngine?.readerPayoff || '本章要给读者明确回报'}`)
    parts.push(`- 金手指：${input.popularFictionProfile.cheatAbility?.name || '主角优势'} / ${input.popularFictionProfile.cheatAbility?.oneLineRule || '一句话就能解释清'} `)
    parts.push(`- 冲突类型：${input.popularFictionProfile.conflictEngine?.conflictTypes?.join('、') || '羞辱、争夺、危机'}`)
    parts.push(`- 冲突频率：${input.popularFictionProfile.conflictEngine?.conflictFrequency || '每章必须有明确冲突'}`)
    parts.push(`- 爽点间隔：${input.popularFictionProfile.conflictEngine?.payoffInterval || '1-3章内必须兑现一次'}`)
    parts.push(`- 钩子策略：${input.popularFictionProfile.conflictEngine?.hookStrategy || '结尾留下下一章承诺'}`)
    parts.push(`- 主角标签：${input.popularFictionProfile.characterTagEngine?.protagonistTags?.join('、') || '鲜明标签'}`)
    if (input.popularFictionProfile.characterTagEngine?.behaviorProofs?.length) {
      parts.push(`- 行为证明：${input.popularFictionProfile.characterTagEngine.behaviorProofs.map(item => `${item.tag}:${item.requiredScene}`).join('；')}`)
    }
  }

  parts.push(`\n## 章节结构设计指南`)
  
  parts.push(`\n### 开篇钩子设计（占章节前10%字数）`)
  parts.push(`开篇必须包含以下至少一种：`)
  parts.push(`- 悬念式：以问题或困境开头`)
  parts.push(`- 冲突式：以冲突场面开头`)
  parts.push(`- 动作式：以紧张动作场面开头`)
  parts.push(`- 倒叙式：以回忆或闪回开头`)
  parts.push(`**参考字数**：${Math.floor(input.targetWordCount * 0.1)}字`)

  parts.push(`\n### 关键场景设计（占章节60%字数）`)
  parts.push(`需要设计2-4个关键场景，每个场景包含：`)
  parts.push(`- 场景描述：具体发生什么`)
  parts.push(`- 出场人物：谁在这个场景`)
  parts.push(`- 情感基调：这个场景要传达什么情绪`)
  parts.push(`- 场景功能：是推进剧情、揭示信息、还是制造冲突`)
  parts.push(`**参考字数**：${Math.floor(input.targetWordCount * 0.6)}字`)

  parts.push(`\n### 高潮设计（占章节20%字数）`)
  parts.push(`本章的高潮需要：`)
  parts.push(`- 汇聚之前埋设的伏笔或冲突`)
  parts.push(`- 角色做出关键选择或行动`)
  parts.push(`- 给读者强烈的情感冲击`)
  parts.push(`**参考字数**：${Math.floor(input.targetWordCount * 0.2)}字`)

  parts.push(`\n### 章节结尾设计（占章节10%字数）`)
  parts.push(`结尾必须包含以下至少一种：`)
  parts.push(`- 悬念式：留下未解之谜`)
  parts.push(`- 转折式：出人意料的结局`)
  parts.push(`- 情感式：以情感高潮结尾`)
  parts.push(`- 钩子式：引出下章内容`)
  parts.push(`**参考字数**：${Math.floor(input.targetWordCount * 0.1)}字`)

  parts.push(`\n## 输出要求`)
  parts.push(`请以严格 JSON 格式输出，字段说明：`)
  parts.push(`\`\`\`json`)
  parts.push(`{`)
  parts.push(`  "chapterTitle": "章节标题（简洁有力，最好包含爆点）",`)
  parts.push(`  "chapterGoal": "本章核心目标（一句话说明这章要完成什么）",`)
  parts.push(`  "mainConflict": "本章主要冲突（是什么在阻碍主角？）",`)
  parts.push(`  "emotionTarget": "本章主情绪目标",`)
  parts.push(`  "conflictTarget": "本章冲突目标",`)
  parts.push(`  "payoffTarget": "本章回报/爽点目标",`)
  parts.push(`  "cliffhanger": "本章结尾钩子",`)
  parts.push(`  "cheatUsage": "本章如何使用金手指或主角优势",`)
  parts.push(`  "characterTagProof": "本章如何证明主角标签",`)
  parts.push(`  "forbiddenMistakes": ["本章禁止犯的错误"],`)
  parts.push(`  "keyScenes": [`)
  parts.push(`    {`)
  parts.push(`      "scene": "场景描述",`)
  parts.push(`      "characters": ["角色1", "角色2"],`)
  parts.push(`      "emotion": "情感基调"`)
  parts.push(`    }`)
  parts.push(`  ],`)
  parts.push(`  "ending": "章节结尾设计",`)
  parts.push(`  "foreshadows": ["新埋伏笔1", "新埋伏笔2"],`)
  parts.push(`  "resolvedPlotlines": ["回收的伏笔描述"]`)
  parts.push(`}`)
  parts.push(`\`\`\``)
  parts.push(`\n**注意事项**：`)
  parts.push(`- foreshadows 和 resolvedPlotlines 可以为空数组 []`)
  parts.push(`- keyScenes 建议包含3个场景，1个开篇+1-2个发展+1个高潮`)
  parts.push(`- 所有字段都是必填的`)

  return parts.join('\n')
}

// 类型导出
export type { PlannerPromptInput, PlannerPromptOutput }
