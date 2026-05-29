/**
 * Reader Agent 提示词
 * 模拟目标读者的阅读体验评估
 */

interface ReaderPromptInput {
  chapterNo: number
  chapterTitle?: string
  genre?: string | null
  targetAudience?: string | null
  chapterContent: string
  recentSummaries: string
}

export function buildReaderSystemPrompt(): string {
  return `你是一位资深网络小说读者，拥有敏锐的阅读直觉和丰富的阅读经验。
你的任务是从纯粹的读者视角评估一个章节的阅读体验。

评估维度：
1. 悬念吸引力（engagement）- 开头 300 字是否能抓住注意力
2. 节奏舒适度（pacing）- 是否有拖沓或过快的段落
3. 情感共鸣度（emotion）- 是否能引发情感反应
4. 可读性（readability）- 文字是否流畅自然，有没有明显AI感
5. 钩子强度（hook）- 开头钩子是否让人想继续读
6. 悬念强度（cliffhanger）- 结尾是否让人想翻到下一章

评分标准：
- 90-100：优秀，让人欲罢不能
- 70-89：良好，有吸引力但有改进空间
- 50-69：一般，有些地方让人出戏
- 50以下：较差，需要大幅修改

请以严格 JSON 格式输出评估结果。`
}

export function buildReaderUserPrompt(input: ReaderPromptInput): string {
  const parts: string[] = []

  parts.push(`# 读者体验评估任务`)
  parts.push('')
  parts.push(`你正在追读一部${input.genre || '网络小说'}，这是第${input.chapterNo}章。`)
  if (input.targetAudience) {
    parts.push(`目标读者群体：${input.targetAudience}`)
  }
  if (input.chapterTitle) {
    parts.push(`章节标题：${input.chapterTitle}`)
  }

  if (input.recentSummaries) {
    parts.push('')
    parts.push('## 前情回顾')
    parts.push(input.recentSummaries)
  }

  parts.push('')
  parts.push('## 本章内容')
  parts.push(input.chapterContent)

  parts.push('')
  parts.push('## 输出要求')
  parts.push('请以 JSON 格式输出你的阅读体验评估：')
  parts.push('```json')
  parts.push('{')
  parts.push('  "engagementScore": 0-100,')
  parts.push('  "pacingScore": 0-100,')
  parts.push('  "emotionalScore": 0-100,')
  parts.push('  "readabilityScore": 0-100,')
  parts.push('  "hookStrength": 0-100,')
  parts.push('  "cliffhangerStrength": 0-100,')
  parts.push('  "highlights": ["亮点1", "亮点2", "亮点3"],')
  parts.push('  "painPoints": ["疲劳点1", "疲劳点2"],')
  parts.push('  "suggestions": ["建议1", "建议2"],')
  parts.push('  "readerMood": "读完后的情绪状态描述",')
  parts.push('  "wouldContinueReading": true/false,')
  parts.push('  "estimatedReadingTime": 5')
  parts.push('}')
  parts.push('```')

  return parts.join('\n')
}

export type { ReaderPromptInput }
