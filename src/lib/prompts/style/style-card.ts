import { StyleProfilePromptCard, StyleSafetyMode, StyleRiskLevel } from '@/types/style'

export interface StylePromptCardInput {
  displayLabel: string
  prose: string
  vocabulary: string
  sentence: string
  rhetoric: string
  narrative: string
  plot: string
  character: string
  mustDo: string[]
  avoid: string[]
  riskLevel: StyleRiskLevel
  safetyMode: StyleSafetyMode
}

export function buildStylePromptCard(input: StylePromptCardInput): string {
  const parts: string[] = []

  parts.push(`## 风格卡要求`)
  parts.push(`- 风格定位：${input.displayLabel}`)
  parts.push(`- 风格安全模式：${styleSafetyModeLabel(input.safetyMode)}`)

  parts.push(`\n### 文笔特征`)
  parts.push(input.prose)

  parts.push(`\n### 词汇特征`)
  parts.push(input.vocabulary)

  parts.push(`\n### 句式节奏`)
  parts.push(input.sentence)

  parts.push(`\n### 修辞手法`)
  parts.push(input.rhetoric)

  parts.push(`\n### 叙事方式`)
  parts.push(input.narrative)

  parts.push(`\n### 剧情推进`)
  parts.push(input.plot)

  parts.push(`\n### 人物塑造`)
  parts.push(input.character)

  if (input.mustDo.length > 0) {
    parts.push(`\n### 必须遵守的风格要点`)
    for (const item of input.mustDo) {
      parts.push(`- ${item}`)
    }
  }

  if (input.avoid.length > 0) {
    parts.push(`\n### 必须避免的风格禁忌`)
    for (const item of input.avoid) {
      parts.push(`- ${item}`)
    }
  }

  parts.push(`\n### 合规要求`)
  parts.push(`- 不要复刻原文句子、段落、标志性表达、专有设定、角色名、世界观名`)
  parts.push(`- 只学习抽象写作方法，不输出可被识别为某一具体作品的表达`)
  parts.push(`- ${complianceNote(input.safetyMode)}`)

  return parts.join('\n')
}

function styleSafetyModeLabel(mode: StyleSafetyMode): string {
  switch (mode) {
    case 'SAFE_ABSTRACT': return '安全抽象模式'
    case 'STRICT_PUBLIC_DOMAIN': return '公版强风格模式'
    case 'USER_LICENSED': return '用户授权模式'
  }
}

function complianceNote(mode: StyleSafetyMode): string {
  switch (mode) {
    case 'SAFE_ABSTRACT':
      return '使用抽象风格标签，不提及具体作者名'
    case 'STRICT_PUBLIC_DOMAIN':
      return '可以学习古典技法，但避免大段近似原文的表达'
    case 'USER_LICENSED':
      return '仅限用户自有文本风格，不可用于他人作品'
  }
}

export function buildStyleDirectiveForWriter(promptCard: string, styleStrength: number): string {
  const intensity = Math.min(1, Math.max(0, styleStrength))

  if (intensity <= 0) return ''

  const directiveParts: string[] = []
  directiveParts.push(promptCard)

  if (intensity < 0.4) {
    directiveParts.push(`\n风格强度：${Math.round(intensity * 100)}%（仅影响语气和节奏）`)
  } else if (intensity < 0.7) {
    directiveParts.push(`\n风格强度：${Math.round(intensity * 100)}%（影响句式、描写密度、对话方式）`)
  } else {
    directiveParts.push(`\n风格强度：${Math.round(intensity * 100)}%（强风格化，请严格遵守）`)
  }

  return directiveParts.join('\n')
}