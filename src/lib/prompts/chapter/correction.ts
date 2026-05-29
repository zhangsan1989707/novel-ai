/**
 * 修正模式提示词模板
 * 用于定向修正章节内容，而非全文重写
 */

export interface CorrectionPromptInput {
  /** 章节编号 */
  chapterNo: number
  /** 章节标题 */
  chapterTitle?: string
  /** 角色档案（格式化后的字符串） */
  characterProfiles: string
  /** 修正指令（格式化后的字符串） */
  correctionInstructions: string
  /** 需要保留的区域描述 */
  preserveSections: string[]
  /** 原始章节内容 */
  originalContent: string
  /** 世界观设定 */
  worldSetting?: string | null
  /** 目标字数 */
  targetWordCount?: number
}

/**
 * 构建修正模式的系统提示词
 */
export function buildCorrectionSystemPrompt(): string {
  return `你是一位专业的网络小说编辑，擅长精准修正章节问题。

你的工作原则：
1. **最小修改原则** — 只修改指令中明确指出的区域，不做额外润色
2. **风格保持** — 修改后的文笔必须与原文风格完全一致
3. **上下文衔接** — 修改的段落必须与前后文自然过渡
4. **完整性** — 输出必须包含完整章节内容，不可省略原文段落`
}

/**
 * 构建修正模式的用户提示词
 */
export function buildCorrectionUserPrompt(input: CorrectionPromptInput): string {
  const parts: string[] = []

  parts.push(`# 第${input.chapterNo}章定向修正`)
  if (input.chapterTitle) parts.push(`章节标题：${input.chapterTitle}`)

  if (input.characterProfiles) {
    parts.push('')
    parts.push('## 角色档案')
    parts.push(input.characterProfiles)
  }

  if (input.worldSetting) {
    parts.push('')
    parts.push('## 世界观设定')
    parts.push(input.worldSetting)
  }

  parts.push('')
  parts.push(input.correctionInstructions)

  if (input.preserveSections.length > 0) {
    parts.push('')
    parts.push('## 保留区域（以下段落禁止修改）')
    input.preserveSections.forEach(s => parts.push(`- ${s}`))
  }

  if (input.targetWordCount) {
    parts.push('')
    parts.push(`## 字数要求`)
    parts.push(`修正后总字数不低于 ${input.targetWordCount} 字`)
  }

  parts.push('')
  parts.push('## 输出要求')
  parts.push('请输出修正后的完整章节内容。不要输出分析或解释，只输出小说正文。')

  parts.push('')
  parts.push('---')
  parts.push('## 原文')
  parts.push(input.originalContent)

  return parts.join('\n')
}
