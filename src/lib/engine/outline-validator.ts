interface ChapterOutline {
  chapterNumber: number
  title: string
  summary: string
}

interface ValidationResult {
  passed: boolean
  warnings: string[]
  violations: string[]
}

const FORBIDDEN_KEYWORDS = [
  '终局',
  '大结局',
  '最终决战',
  '天下太平',
  '一切结束',
  '终焉',
  '最后的战斗',
  '最终BOSS',
  '结束一切',
  '尘埃落定',
]

const FORBIDDEN_PATTERNS = [
  /最终[的]?.*[Bb][Oo][Ss][Ss]/,
  /最后[的]?.*敌人/,
  /万古.*归一/,
  /宇宙.*尽头/,
  /一切.*终结/,
]

export function validateOutline(
  chapters: ChapterOutline[],
  progressRatio: number
): ValidationResult {
  const result: ValidationResult = { passed: true, warnings: [], violations: [] }

  if (progressRatio >= 0.85) {
    return result
  }

  for (const chapter of chapters) {
    const text = `${chapter.title} ${chapter.summary}`.toLowerCase()

    for (const keyword of FORBIDDEN_KEYWORDS) {
      if (text.includes(keyword.toLowerCase())) {
        result.violations.push(
          `第${chapter.chapterNumber}章"${chapter.title}"包含禁止关键词："${keyword}"（当前进度${Math.round(progressRatio * 100)}%，禁止终局内容）`
        )
        result.passed = false
      }
    }

    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(text)) {
        result.violations.push(
          `第${chapter.chapterNumber}章"${chapter.title}"匹配禁止模式（当前进度${Math.round(progressRatio * 100)}%，禁止终局内容）`
        )
        result.passed = false
      }
    }
  }

  const lastChapterNumbers = chapters.slice(-Math.ceil(chapters.length * 0.3)).map(c => c.chapterNumber)
  if (lastChapterNumbers.length > 0) {
    result.warnings.push(
      `最后30%章节（${lastChapterNumbers[0]}-${lastChapterNumbers[lastChapterNumbers.length - 1]}章）请注意保持推进节奏，避免过早收官`
    )
  }

  return result
}