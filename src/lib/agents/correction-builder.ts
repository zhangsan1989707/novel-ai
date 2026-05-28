/**
 * 修正指令构建器
 * 将 Validator 的校验报告转化为定向修正指令，避免全文重写
 */

import type { ValidationReport as ValidationReportV2 } from '../prompts/chapter/validating-v2'

export interface CorrectionInstruction {
  /** 需要修改的段落/区域描述 */
  targetSection: string
  /** 具体问题 */
  issue: string
  /** 修改动作 */
  fixAction: 'rewrite' | 'delete' | 'insert_after' | 'replace'
  /** 如何修改的指导 */
  fixGuidance: string
  /** 优先级 */
  priority: 'critical' | 'major' | 'minor'
}

export interface CorrectionPlan {
  /** 定向修正指令列表（按优先级排序） */
  instructions: CorrectionInstruction[]
  /** 整体修改策略 */
  overallStrategy: string
  /** 需要保留不动的区域描述 */
  preserveSections: string[]
}

/** 严重程度排序权重 */
const SEVERITY_ORDER: Record<string, number> = { critical: 0, major: 1, minor: 2 }

/**
 * 将校验报告转化为定向修正计划
 */
export function buildCorrectionPlan(
  validationReport: ValidationReportV2,
  _currentContent: string
): CorrectionPlan {
  const issues = validationReport.issues || []
  const sorted = [...issues].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
  )

  const instructions: CorrectionInstruction[] = sorted.map(issue => ({
    targetSection: issue.location || '相关段落',
    issue: issue.description,
    fixAction: inferFixAction(issue),
    fixGuidance: issue.suggestion || `修正${issue.type}类问题：${issue.description}`,
    priority: issue.severity as CorrectionInstruction['priority'],
  }))

  const hasCritical = sorted.some(i => i.severity === 'critical')
  const overallStrategy = hasCritical
    ? '存在严重问题，优先修正 critical 级别错误，保持其余内容不变'
    : '存在可改进项，按优先级逐条修正，保留原文亮点'

  // 从 issues 的 location 中提取需要修改的区域，其余视为保留区
  const modifyLocations = new Set(instructions.map(i => i.targetSection))
  const preserveSections = ['开头引入段', '高潮段', '结尾钩子段'].filter(
    s => !modifyLocations.has(s)
  )

  return { instructions, overallStrategy, preserveSections }
}

/**
 * 根据问题类型推断修改动作
 */
function inferFixAction(issue: { type: string; severity: string }): CorrectionInstruction['fixAction'] {
  switch (issue.type) {
    case 'character':
    case 'logic':
    case 'worldview':
      return issue.severity === 'critical' ? 'rewrite' : 'replace'
    case 'foreshadow':
      return 'insert_after'
    case 'style':
      return 'replace'
    default:
      return 'replace'
  }
}

/**
 * 构建给 Writer 的定向修正 prompt
 */
export function buildCorrectionPrompt(
  correctionPlan: CorrectionPlan,
  originalContent: string
): string {
  const parts: string[] = []

  parts.push('# 章节定向修正任务')
  parts.push('')
  parts.push('## 修改策略')
  parts.push(correctionPlan.overallStrategy)

  if (correctionPlan.preserveSections.length > 0) {
    parts.push('')
    parts.push('## 保留区域（不可修改）')
    correctionPlan.preserveSections.forEach(s => parts.push(`- ${s}`))
  }

  parts.push('')
  parts.push('## 修正指令（按优先级排序）')
  correctionPlan.instructions.forEach((inst, i) => {
    parts.push('')
    parts.push(`### 指令 ${i + 1} [${inst.priority}]`)
    parts.push(`- **目标区域**：${inst.targetSection}`)
    parts.push(`- **问题**：${inst.issue}`)
    parts.push(`- **操作**：${inst.fixAction}`)
    parts.push(`- **修正指导**：${inst.fixGuidance}`)
  })

  parts.push('')
  parts.push('## 要求')
  parts.push('1. 只修改上述指令中指定的区域，保留区域内容完全不变')
  parts.push('2. 修改后的文笔风格必须与原文一致')
  parts.push('3. 确保修改后的段落与上下文自然衔接')
  parts.push('4. 输出完整的修改后章节内容，不要省略任何段落')

  parts.push('')
  parts.push('---')
  parts.push('## 原文')
  parts.push(originalContent)

  return parts.join('\n')
}
