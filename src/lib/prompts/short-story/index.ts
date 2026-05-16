interface ShortStoryPromptInput {
  title: string
  genre: string
  targetAudience?: string
  targetWordCount: number
  structure: 'three_act' | 'four_act' | 'five_act'
  premise?: string
}

const STRUCTURE_NAMES: Record<string, string> = {
  three_act: '三幕式',
  four_act: '四幕式',
  five_act: '五幕式',
}

const STRUCTURE_SECTIONS: Record<string, string[]> = {
  three_act: ['setup', 'rising', 'climax', 'falling', 'resolution'].slice(0, 3),
  four_act: ['setup', 'rising', 'climax', 'resolution'],
  five_act: ['setup', 'rising', 'climax', 'falling', 'resolution'],
}

const SECTION_TYPE_NAMES: Record<string, string> = {
  setup: '开端/铺垫',
  rising: '发展/上升',
  climax: '高潮',
  falling: '下降/转折',
  resolution: '结局/收束',
}

export function buildShortOutlinePrompt(input: ShortStoryPromptInput): string {
  const parts: string[] = []

  parts.push(`【基础信息】`)
  parts.push(`标题：${input.title}`)
  parts.push(`类型：${input.genre}`)
  if (input.targetAudience) parts.push(`目标受众：${input.targetAudience}`)
  parts.push(`目标字数：${input.targetWordCount}字`)
  parts.push(`结构：${STRUCTURE_NAMES[input.structure]}`)

  if (input.premise) {
    parts.push(`\n【核心设定】`)
    parts.push(input.premise)
  }

  parts.push(`\n【任务】`)
  parts.push(`请为这部短篇小说生成一个完整的${STRUCTURE_NAMES[input.structure]}结构大纲。`)
  parts.push(`总字数控制在${input.targetWordCount}字左右。`)
  parts.push(`结构分为${STRUCTURE_SECTIONS[input.structure].length}个段落，各段落类型为：${STRUCTURE_SECTIONS[input.structure].map(s => SECTION_TYPE_NAMES[s]).join('、')}。`)

  parts.push(`\n【输出格式】`)
  parts.push(`请以 JSON 格式输出，字段说明：`)
  parts.push(`- premise: string, 核心前提/一句话概括（30-50字）`)
  parts.push(`- sections: 段落数组，每个段落包含 {sectionNumber, title, sectionType, emotionalTarget, description}`)
  parts.push(`- sections[].sectionNumber: number, 段落编号（从1开始）`)
  parts.push(`- sections[].title: string, 段落标题`)
  parts.push(`- sections[].sectionType: string, 段落类型（${STRUCTURE_SECTIONS[input.structure].join('/')}）`)
  parts.push(`- sections[].emotionalTarget: number, 情绪目标值（0-100，0=极度低沉，100=极度高昂）`)
  parts.push(`- sections[].description: string, 段落内容概要（100-200字）`)

  parts.push(`\n示例输出：`)
  parts.push(`{
  "premise": "一个关于失去与重获的故事",
  "sections": [
    {
      "sectionNumber": 1,
      "title": "平静的日常",
      "sectionType": "setup",
      "emotionalTarget": 40,
      "description": "描述主角的日常生活，建立角色基线，暗示即将到来的变故"
    }
  ]
}`)

  return parts.join('\n')
}

export function buildShortEmotionDesignPrompt(input: {
  genre: string
  structure: string
  premise: string
}): string {
  const parts: string[] = []

  parts.push(`【基础信息】`)
  parts.push(`类型：${input.genre}`)
  parts.push(`结构：${STRUCTURE_NAMES[input.structure] || input.structure}`)
  parts.push(`核心前提：${input.premise}`)

  parts.push(`\n【任务】`)
  parts.push(`请为这部短篇小说设计情绪曲线。`)
  parts.push(`需要为每个段落设计情绪目标值和情绪转折点，确保整体情绪起伏合理、有张力。`)

  parts.push(`\n【输出格式】`)
  parts.push(`请以 JSON 格式输出，字段说明：`)
  parts.push(`- overallArc: string, 整体情绪弧线描述（50-100字）`)
  parts.push(`- keyMoments: 关键情绪时刻数组，每个包含 {position, emotion, intensity, description}`)
  parts.push(`- keyMoments[].position: string, 位置描述（如"第一段末尾"）`)
  parts.push(`- keyMoments[].emotion: string, 情绪类型（如"震惊""悲伤""希望"）`)
  parts.push(`- keyMoments[].intensity: number, 强度（0-100）`)
  parts.push(`- keyMoments[].description: string, 具体描述（30-50字）`)
  parts.push(`- emotionalTransitions: 情绪转折数组，每个包含 {from, to, trigger, technique}`)
  parts.push(`- emotionalTransitions[].from: string, 起始情绪`)
  parts.push(`- emotionalTransitions[].to: string, 目标情绪`)
  parts.push(`- emotionalTransitions[].trigger: string, 触发方式`)
  parts.push(`- emotionalTransitions[].technique: string, 写作手法建议`)

  return parts.join('\n')
}

export function buildShortReversalDesignPrompt(input: {
  genre: string
  premise: string
  sectionCount: number
}): string {
  const parts: string[] = []

  parts.push(`【基础信息】`)
  parts.push(`类型：${input.genre}`)
  parts.push(`核心前提：${input.premise}`)
  parts.push(`段落数量：${input.sectionCount}`)

  parts.push(`\n【任务】`)
  parts.push(`请为这部短篇小说设计反转点。`)
  parts.push(`短篇小说需要精炼而有力的反转，通常1-2个核心反转即可。`)
  parts.push(`反转应出人意料但合情合理，与核心前提紧密关联。`)

  parts.push(`\n【输出格式】`)
  parts.push(`请以 JSON 格式输出，字段说明：`)
  parts.push(`- reversals: 反转数组，每个包含 {sectionNumber, type, description, setupHint, payoffHint}`)
  parts.push(`- reversals[].sectionNumber: number, 反转所在段落编号`)
  parts.push(`- reversals[].type: string, 反转类型（如"身份反转""动机反转""局势反转""认知反转"）`)
  parts.push(`- reversals[].description: string, 反转内容描述（50-100字）`)
  parts.push(`- reversals[].setupHint: string, 伏笔/铺垫建议（如何在前文暗示）`)
  parts.push(`- reversals[].payoffHint: string, 揭示建议（如何呈现反转效果）`)

  return parts.join('\n')
}

export function buildShortHookDesignPrompt(input: {
  genre: string
  structure: string
  sections: { number: number; type: string; title: string }[]
}): string {
  const parts: string[] = []

  parts.push(`【基础信息】`)
  parts.push(`类型：${input.genre}`)
  parts.push(`结构：${STRUCTURE_NAMES[input.structure] || input.structure}`)

  parts.push(`\n【段落列表】`)
  input.sections.forEach(s => {
    parts.push(`段落${s.number}（${SECTION_TYPE_NAMES[s.type] || s.type}）：${s.title}`)
  })

  parts.push(`\n【任务】`)
  parts.push(`请为这部短篇小说的每个段落设计钩子。`)
  parts.push(`钩子是段落开头或结尾吸引读者继续阅读的元素。`)
  parts.push(`- 开头钩子：段落开头吸引读者注意力的手法`)
  parts.push(`- 结尾钩子：段落结尾制造悬念或期待的手法`)

  parts.push(`\n【输出格式】`)
  parts.push(`请以 JSON 格式输出，字段说明：`)
  parts.push(`- hooks: 钩子数组，每个包含 {sectionNumber, openingHook, closingHook}`)
  parts.push(`- hooks[].sectionNumber: number, 段落编号`)
  parts.push(`- hooks[].openingHook: object, 开头钩子 {type, description}`)
  parts.push(`- hooks[].openingHook.type: string, 钩子类型（如"悬念""冲突""疑问""对比""预言"）`)
  parts.push(`- hooks[].openingHook.description: string, 具体描述（30-50字）`)
  parts.push(`- hooks[].closingHook: object, 结尾钩子 {type, description}`)
  parts.push(`- hooks[].closingHook.type: string, 钩子类型`)
  parts.push(`- hooks[].closingHook.description: string, 具体描述（30-50字）`)

  return parts.join('\n')
}

export function buildShortWritingPrompt(input: {
  title: string
  genre: string
  sectionNumber: number
  sectionType: string
  sectionTitle: string
  premise: string
  previousContent: string
  emotionalTarget: number
  targetWordCount: number
  hookDesign?: string
  reversalDesign?: string
}): string {
  const parts: string[] = []

  parts.push(`【小说信息】`)
  parts.push(`标题：${input.title}`)
  parts.push(`类型：${input.genre}`)
  parts.push(`核心前提：${input.premise}`)

  parts.push(`\n【当前段落】`)
  parts.push(`段落编号：${input.sectionNumber}`)
  parts.push(`段落类型：${SECTION_TYPE_NAMES[input.sectionType] || input.sectionType}`)
  parts.push(`段落标题：${input.sectionTitle}`)
  parts.push(`情绪目标值：${input.emotionalTarget}/100（0=极度低沉，100=极度高昂）`)
  parts.push(`目标字数：${input.targetWordCount}字`)

  if (input.hookDesign) {
    parts.push(`\n【钩子设计】`)
    parts.push(input.hookDesign)
  }

  if (input.reversalDesign) {
    parts.push(`\n【反转设计】`)
    parts.push(input.reversalDesign)
  }

  if (input.previousContent) {
    parts.push(`\n【前文内容】`)
    parts.push(input.previousContent)
  }

  parts.push(`\n【写作要求】`)
  parts.push(`1. 请根据以上信息写作当前段落的正文内容`)
  parts.push(`2. 严格控制字数在${input.targetWordCount}字左右`)
  parts.push(`3. 情绪基调应与目标值${input.emotionalTarget}匹配`)
  parts.push(`4. 如有钩子设计，请在段落开头/结尾体现对应的钩子手法`)
  parts.push(`5. 如有反转设计，请在合适位置自然呈现反转效果`)
  parts.push(`6. 与前文保持连贯，注意叙事节奏`)
  parts.push(`7. 直接输出正文内容，不要包含标题、段落标记等额外信息`)

  return parts.join('\n')
}

export { STRUCTURE_NAMES, STRUCTURE_SECTIONS, SECTION_TYPE_NAMES }
export type { ShortStoryPromptInput }
