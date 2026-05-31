import { finaleGuardValidator } from './outline-validator'
import { countChineseWords } from '@/lib/utils'

interface ContentValidationInput {
  chapterNumber: number
  title: string
  content: string
  progressRatio: number
  currentArcStage?: string
  currentArcName?: string
  finalBossNames?: string[]
  protectedVillainNames?: string[]
  openPlotlines?: Array<{
    description: string
    plannedAt?: number | null
    plantedAt?: number | null
    status?: string | null
  }>
  blueprintConstraints?: string[]
}

interface ContentValidationResult {
  passed: boolean
  riskScore: number
  violations: string[]
  warnings: string[]
  unsafeChunkCount: number
  shouldReroll: boolean
}

const EXTRA_FORBIDDEN_PATTERNS = [
  /终于.*完结/,
  /(就此|从此).*(结束|终结|了结)/,
  /(永别|诀别|永诀)/,
  /再无(任何|一丝)(牵绊|关系|关联)/,
  /(彻底|完全).*(解脱|消逝|湮灭)/,
  /故事.*到此(结束|为止)/,
  /(一切|所有).*(化为|变成).*(虚无|泡影|空)/,
  /天地(归(于|在)|重新).*宁静/,
]

export function computeRiskScore(
  violations: string[],
  contentLength: number
): number {
  if (violations.length === 0) return 0
  const density = violations.length / Math.max(contentLength / 500, 1)
  const base = Math.min(violations.length * 0.15, 0.6)
  const adjusted = base + density * 0.05
  return Math.min(adjusted, 1.0)
}

export function validateChapterContent(input: ContentValidationInput): ContentValidationResult {
  const {
    chapterNumber,
    title,
    content,
    progressRatio,
    currentArcStage,
    currentArcName,
    finalBossNames,
    protectedVillainNames,
    openPlotlines,
    blueprintConstraints,
  } = input

  const warnings: string[] = []
  const violations: string[] = []

  const titleResult = finaleGuardValidator(
    [{ chapterNumber, title, summary: '' }],
    {
      progressRatio,
      currentArcStage,
      currentArcName,
      finalBossNames,
      protectedVillainNames,
      openPlotlines,
      blueprintConstraints,
    }
  )

  violations.push(...titleResult.violations)
  warnings.push(...titleResult.warnings)

  const contentBlocks = splitContentIntoBlocks(content, 200)
  let unsafeChunkCount = 0

  for (const block of contentBlocks) {
    const blockResult = finaleGuardValidator(
      [{ chapterNumber, title: '', summary: block }],
      {
        progressRatio,
        currentArcStage,
        currentArcName,
        finalBossNames,
        protectedVillainNames,
        openPlotlines,
        blueprintConstraints,
      }
    )

    if (blockResult.violations.length > 0) {
      unsafeChunkCount++
      violations.push(
        `第${chapterNumber}章"${title}"正文内容包含违规信号（第${contentBlocks.indexOf(block) + 1}/${contentBlocks.length}段）`
      )
    }
  }

  for (const pattern of EXTRA_FORBIDDEN_PATTERNS) {
    if (progressRatio < 0.85 && pattern.test(content)) {
      violations.push(
        `第${chapterNumber}章"${title}"正文匹配额外禁用模式，疑似过早收束（当前进度${Math.round(progressRatio * 100)}%）`
      )
    }
  }

  if (progressRatio < 0.5) {
    const wordCount = countChineseWords(content)
    const closureScore = computeClosureDensity(content, wordCount)
    if (closureScore > 0.3) {
      warnings.push(
        `第${chapterNumber}章正文收束语义密度偏高（${(closureScore * 100).toFixed(1)}%），当前进度${Math.round(progressRatio * 100)}%，请保持中期拓展感`
      )
    }
  }

  const riskScore = computeRiskScore(violations, content.length)
  const passed = violations.length === 0
  const shouldReroll = riskScore >= 0.7

  warnings.push(
    `正文校验：扫描了 ${contentBlocks.length} 个内容段，发现 ${unsafeChunkCount} 个不安全段`
  )

  return { passed, riskScore, violations, warnings, unsafeChunkCount, shouldReroll }
}

function splitContentIntoBlocks(content: string, blockSize: number): string[] {
  const blocks: string[] = []
  for (let i = 0; i < content.length; i += blockSize) {
    const block = content.slice(i, i + blockSize)
    const lastPeriod = block.lastIndexOf('。')
    const lastNewline = block.lastIndexOf('\n')
    const breakPoint = Math.max(lastPeriod, lastNewline)
    if (breakPoint > 0 && i + breakPoint < content.length) {
      blocks.push(content.slice(i, i + breakPoint + 1))
      i += breakPoint + 1 - blockSize
    } else {
      blocks.push(block)
    }
  }
  return blocks
}

const CLOSURE_WORDS = [
  '结束', '终结', '完结', '落幕', '永别', '诀别',
  '最后一', '最终之', '终极', '彻底毁灭', '永久消灭',
  '再无', '不再', '从此', '永远', '尘埃落定',
]

function computeClosureDensity(content: string, wordCount: number): number {
  let matches = 0
  for (const word of CLOSURE_WORDS) {
    let pos = 0
    while ((pos = content.indexOf(word, pos)) !== -1) {
      matches++
      pos += word.length
    }
  }
  return matches / Math.max(wordCount / 200, 1)
}