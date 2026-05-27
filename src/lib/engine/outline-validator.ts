interface ChapterOutline {
  chapterNumber: number
  title: string
  summary: string
}

interface PlotlineGuard {
  description: string
  plannedAt?: number | null
  plantedAt?: number | null
  status?: string | null
}

interface OutlineValidationOptions {
  progressRatio: number
  currentArcName?: string
  currentArcStage?: string
  finalBossNames?: string[]
  protectedVillainNames?: string[]
  openPlotlines?: PlotlineGuard[]
  blueprintConstraints?: string[]
}

interface ValidationResult {
  passed: boolean
  warnings: string[]
  violations: string[]
}

interface FinaleGuardResult {
  violations: string[]
  warnings: string[]
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

const MAINLINE_TERMINATION_KEYWORDS = [
  '主线终结',
  '主线结束',
  '终结主线',
  '宿命完结',
  '夙愿已了',
  '天下归于平静',
  '尘埃落定',
  '再无后患',
  '大仇得报',
]

const MAINLINE_TERMINATION_PATTERNS = [
  /主线.*(完结|结束|终结)/,
  /(全部|所有).*(恩怨|主线|纷争).*(结束|了结|落幕)/,
  /(彻底|终于).*(解决|终结).*(主线|宿敌|最终敌人)/,
]

const FORESHADOW_RESOLUTION_KEYWORDS = [
  '所有伏笔回收',
  '全部伏笔回收',
  '真相大白',
  '谜底揭晓',
  '谜底大白',
  '秘密彻底揭开',
  '所有秘密揭晓',
  '全部真相公开',
]

const FORESHADOW_RESOLUTION_PATTERNS = [
  /(所有|全部).*(伏笔|秘密|真相|谜团).*(回收|揭晓|揭开|解开)/,
  /(真相|谜底).*(终于|彻底)?.*(大白|揭晓|揭开)/,
]

const VILLAIN_DEFEAT_TERMS = [
  '死亡',
  '死去',
  '陨落',
  '伏诛',
  '被杀',
  '身死',
  '终结',
  '消灭',
  '毁灭',
  '陨灭',
  '彻底击败',
  '彻底打倒',
]

function normalizeOptions(progress: number | OutlineValidationOptions): OutlineValidationOptions {
  if (typeof progress === 'number') {
    return { progressRatio: progress }
  }
  return progress
}

function containsAny(text: string, values: string[]): string | null {
  for (const value of values) {
    if (value && text.includes(value.toLowerCase())) {
      return value
    }
  }
  return null
}

function matchDescription(text: string, description: string): boolean {
  const normalized = description.trim().toLowerCase()
  if (!normalized) return false

  const compact = normalized.replace(/\s+/g, '')
  if (compact.length >= 4 && text.includes(compact)) return true

  const chunks = compact
    .split(/[，。；、,:：/|]/)
    .map(item => item.trim())
    .filter(item => item.length >= 4)

  return chunks.some(chunk => text.includes(chunk))
}

export function finaleGuardValidator(
  chapters: ChapterOutline[],
  options: OutlineValidationOptions
): FinaleGuardResult {
  const violations: string[] = []
  const warnings: string[] = []
  const progressRatio = options.progressRatio
  const strictVillainGuard = progressRatio < 0.9
  const strictForeshadowGuard = progressRatio < 0.88
  const strictMainlineGuard = progressRatio < 0.92
  const finalBossNames = (options.finalBossNames || []).map(item => item.toLowerCase()).filter(Boolean)
  const protectedVillains = (options.protectedVillainNames || []).map(item => item.toLowerCase()).filter(Boolean)
  const openPlotlines = options.openPlotlines || []

  if (progressRatio >= 0.85) {
    warnings.push(
      `当前进度 ${Math.round(progressRatio * 100)}%，目录已进入后段，可逐步增强收束感，但仍需避免一次性终结全部主线。`
    )
  }

  for (const chapter of chapters) {
    const text = `${chapter.title} ${chapter.summary}`.toLowerCase()

    if (progressRatio < 0.85) {
      for (const keyword of FORBIDDEN_KEYWORDS) {
        if (text.includes(keyword.toLowerCase())) {
          violations.push(
            `第${chapter.chapterNumber}章"${chapter.title}"包含禁止关键词："${keyword}"（当前进度${Math.round(progressRatio * 100)}%，禁止终局内容）`
          )
        }
      }

      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(text)) {
          violations.push(
            `第${chapter.chapterNumber}章"${chapter.title}"匹配禁止模式（当前进度${Math.round(progressRatio * 100)}%，禁止终局内容）`
          )
        }
      }
    }

    if (strictMainlineGuard) {
      const keyword = containsAny(text, MAINLINE_TERMINATION_KEYWORDS)
      if (keyword) {
        violations.push(
          `第${chapter.chapterNumber}章"${chapter.title}"出现主线终结信号："${keyword}"（当前阶段 ${options.currentArcStage || '未知'}，禁止主线提前收束）`
        )
      }

      for (const pattern of MAINLINE_TERMINATION_PATTERNS) {
        if (pattern.test(text)) {
          violations.push(
            `第${chapter.chapterNumber}章"${chapter.title}"出现主线收官模式（当前阶段 ${options.currentArcStage || '未知'}，禁止主线提前收束）`
          )
        }
      }
    }

    if (strictForeshadowGuard) {
      const keyword = containsAny(text, FORESHADOW_RESOLUTION_KEYWORDS)
      if (keyword) {
        violations.push(
          `第${chapter.chapterNumber}章"${chapter.title}"出现伏笔/谜团提前回收信号："${keyword}"（当前进度 ${Math.round(progressRatio * 100)}%）`
        )
      }

      for (const pattern of FORESHADOW_RESOLUTION_PATTERNS) {
        if (pattern.test(text)) {
          violations.push(
            `第${chapter.chapterNumber}章"${chapter.title}"出现伏笔/谜团集中揭晓模式（当前进度 ${Math.round(progressRatio * 100)}%）`
          )
        }
      }
    }

    if (strictVillainGuard) {
      const defeated = containsAny(text, VILLAIN_DEFEAT_TERMS)
      if (defeated) {
        for (const name of finalBossNames) {
          if (text.includes(name)) {
            violations.push(
              `第${chapter.chapterNumber}章"${chapter.title}"让终极反派"${name}"出现"${defeated}"语义（当前进度 ${Math.round(progressRatio * 100)}%，禁止最大反派提前死亡或退场）`
            )
          }
        }

        for (const name of protectedVillains) {
          if (text.includes(name)) {
            violations.push(
              `第${chapter.chapterNumber}章"${chapter.title}"让关键反派"${name}"出现"${defeated}"语义（当前 Arc ${options.currentArcName || '未知'}，禁止关键反派过早清场）`
            )
          }
        }
      }
    }

    for (const plotline of openPlotlines) {
      if (!plotline.description || !matchDescription(text, plotline.description)) continue
      if (!containsAny(text, ['揭晓', '揭开', '解开', '回收', '收束', '了结', '结束', '真相', '谜底'])) continue

      const plannedAt = typeof plotline.plannedAt === 'number' ? plotline.plannedAt : null
      if (plannedAt && chapter.chapterNumber < plannedAt) {
        violations.push(
          `第${chapter.chapterNumber}章"${chapter.title}"疑似提前回收伏笔"${plotline.description}"（计划回收章节 ${plannedAt}）`
        )
        continue
      }

      if (!plannedAt && strictForeshadowGuard) {
        violations.push(
          `第${chapter.chapterNumber}章"${chapter.title}"疑似提前收束未解决伏笔"${plotline.description}"（当前进度 ${Math.round(progressRatio * 100)}%）`
        )
      }
    }
  }

  return { violations, warnings }
}

export function validateOutline(
  chapters: ChapterOutline[],
  progress: number | OutlineValidationOptions
): ValidationResult {
  const options = normalizeOptions(progress)
  const result: ValidationResult = { passed: true, warnings: [], violations: [] }
  const maxChapterNumber = chapters.reduce((max, chapter) => Math.max(max, chapter.chapterNumber), 0)
  const blueprintConstraints = (options.blueprintConstraints || []).filter(Boolean)
  const openPlotlines = options.openPlotlines || []
  const finaleGuard = finaleGuardValidator(chapters, options)
  result.warnings.push(...finaleGuard.warnings)
  if (finaleGuard.violations.length > 0) {
    result.violations.push(...finaleGuard.violations)
    result.passed = false
  }

  const lastChapterNumbers = chapters.slice(-Math.ceil(chapters.length * 0.3)).map(c => c.chapterNumber)
  if (lastChapterNumbers.length > 0) {
    result.warnings.push(
      `最后30%章节（${lastChapterNumbers[0]}-${lastChapterNumbers[lastChapterNumbers.length - 1]}章）请注意保持推进节奏，避免过早收官`
    )
  }

  if (blueprintConstraints.length > 0) {
    result.warnings.push(`已按 Blueprint 约束校验：${blueprintConstraints.join('；')}`)
  }

  if (openPlotlines.length > 0) {
    result.warnings.push(`本批次校验了 ${openPlotlines.length} 条进行中伏笔，当前批次最高章节号为第${maxChapterNumber}章`)
  }

  return result
}
