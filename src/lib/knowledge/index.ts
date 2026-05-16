export * from './hooks'
export * from './styles'
export * from './anti-ai'
export * from './genre-formulas'
export * from './emotional-arcs'

import type { HookTechnique } from './hooks'
import type { StyleModule } from './styles'
import type { GenreFormula } from './genre-formulas'
import type { EmotionalArcTemplate } from './emotional-arcs'
import { getHooksByGenre } from './hooks'
import { getStylesByGenre } from './styles'
import { getFormulaByGenre } from './genre-formulas'
import { getArcByGenre } from './emotional-arcs'
import { forbiddenWords, forbiddenPatterns } from './anti-ai'

export function getKnowledgeForGenre(genre: string): {
  hooks: { chapterStart: HookTechnique[]; chapterEnd: HookTechnique[]; paragraph: HookTechnique[] }
  styles: StyleModule[]
  formula: GenreFormula | undefined
  arcs: EmotionalArcTemplate[]
} {
  const genreHooks = getHooksByGenre(genre)
  return {
    hooks: {
      chapterStart: genreHooks.filter(h => h.category === 'chapter_start'),
      chapterEnd: genreHooks.filter(h => h.category === 'chapter_end'),
      paragraph: genreHooks.filter(h => h.category === 'paragraph'),
    },
    styles: getStylesByGenre(genre),
    formula: getFormulaByGenre(genre),
    arcs: getArcByGenre(genre),
  }
}

export function getAntiAiPromptFragment(): string {
  const criticalWords = forbiddenWords.filter(w => w.level === 'critical').map(w => `"${w.word}"`)
  const warningWords = forbiddenWords.filter(w => w.level === 'warning').map(w => `"${w.word}"`)
  const lines: string[] = []
  lines.push(`一级禁用词（命中即替换）：${criticalWords.join('、')}`)
  lines.push(`二级禁用词（尽量避免）：${warningWords.join('、')}`)
  lines.push('禁止模式：')
  for (const p of forbiddenPatterns) {
    lines.push(`- ${p.pattern}：${p.description}`)
    lines.push(`  ✗ ${p.example.bad}`)
    lines.push(`  ✓ ${p.example.good}`)
  }
  return lines.join('\n')
}

export function getWritingEnhancementPrompt(genre: string, _chapterNo: number): string {
  const knowledge = getKnowledgeForGenre(genre)
  const lines: string[] = []

  if (knowledge.hooks.chapterStart.length > 0) {
    lines.push('【章首钩子参考】')
    for (const h of knowledge.hooks.chapterStart) {
      lines.push(`- ${h.name}：${h.description}（例：${h.example}）`)
    }
  }

  if (knowledge.hooks.chapterEnd.length > 0) {
    lines.push('【章尾钩子参考】')
    for (const h of knowledge.hooks.chapterEnd) {
      lines.push(`- ${h.name}：${h.description}（例：${h.example}）`)
    }
  }

  if (knowledge.styles.length > 0) {
    lines.push('【风格技法参考】')
    for (const s of knowledge.styles) {
      lines.push(`- ${s.name}：${s.description}`)
      lines.push(`  规则：${s.rules.join('；')}`)
      lines.push(`  ✓ ${s.examples[0].good}`)
      lines.push(`  ✗ ${s.examples[0].bad}`)
    }
  }

  if (knowledge.formula) {
    lines.push('【题材公式】')
    lines.push(`- ${knowledge.formula.name}：${knowledge.formula.structure}`)
    lines.push(`- 核心要素：${knowledge.formula.keyElements.join('、')}`)
    lines.push(`- 节奏指南：${knowledge.formula.pacingGuide}`)
    lines.push(`- 读者期待：${knowledge.formula.readerExpectations.join('、')}`)
    lines.push(`- 常见陷阱：${knowledge.formula.commonPitfalls.join('、')}`)
  }

  if (knowledge.arcs.length > 0) {
    lines.push('【情绪弧线参考】')
    for (const arc of knowledge.arcs) {
      lines.push(`- ${arc.name}：${arc.description}`)
      const phaseDescs = arc.phases.map(p => `${p.name}(情绪值${p.emotion})`)
      lines.push(`  阶段：${phaseDescs.join(' → ')}`)
    }
  }

  return lines.join('\n')
}
