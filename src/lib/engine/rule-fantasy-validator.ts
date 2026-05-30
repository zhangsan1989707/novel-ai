import type { ChapterOutline } from './types'
import type { ValidationReport } from './types'
import type { CheatAbilityUsageEntry } from './cheat-ability-state'
import type { PopularFictionScorecard } from './popular-fiction'

export interface RuleFantasyInput {
  chapterNo: number
  content: string
  outline?: ChapterOutline | null
  validationReport?: ValidationReport | null
  cheatUsage?: CheatAbilityUsageEntry | null
  cheatAbilityUnlockedAbilities?: string[]
  cheatAbilityCooldownUntilChapter?: number | null
  popularFiction?: PopularFictionScorecard | null
  worldSecretRevealedTooEarly?: boolean
}

export interface RuleFantasyFinding {
  code: string
  message: string
  severity: 'critical' | 'major' | 'minor'
}

export interface RuleFantasyResult {
  passed: boolean
  score: number
  findings: RuleFantasyFinding[]
}

export function runRuleFantasyValidator(input: RuleFantasyInput): RuleFantasyResult {
  const findings: RuleFantasyFinding[] = []
  const content = input.content || ''

  if (!input.cheatUsage) {
    findings.push({
      code: 'CHEAT_COST_MISSING',
      message: '本章缺少金手指代价记录，不允许无副作用使用能力。',
      severity: 'major',
    })
  }

  if (input.cheatAbilityCooldownUntilChapter && input.chapterNo <= input.cheatAbilityCooldownUntilChapter) {
    findings.push({
      code: 'CHEAT_COOLDOWN_ACTIVE',
      message: `金手处于冷却期，第${input.chapterNo}章不应继续强用同能力。`,
      severity: 'critical',
    })
  }

  if (input.cheatUsage && Array.isArray(input.cheatAbilityUnlockedAbilities) && input.cheatAbilityUnlockedAbilities.length > 0) {
    const matched = input.cheatAbilityUnlockedAbilities.some(ability => ability && input.cheatUsage!.abilityName.includes(ability))
    if (!matched) {
      findings.push({
        code: 'CHEAT_ABILITY_NOT_UNLOCKED',
        message: `使用了未解锁能力：${input.cheatUsage.abilityName}`,
        severity: 'critical',
      })
    }
  }

  if (input.popularFiction && input.popularFiction.cheatPayoff < 7) {
    findings.push({
      code: 'CHEAT_PAYOFF_WEAK',
      message: '金手指兑现力度不足，规则玄幻必须保证能力使用带来可见回报。',
      severity: 'major',
    })
  }

  const markPenalty = input.cheatUsage ? Math.min(20, Math.abs(input.cheatUsage.markValueChange) * 2) : 10
  if (input.cheatUsage && input.cheatUsage.markValueChange === 0 && input.cheatUsage.backlashValueChange === 0) {
    findings.push({
      code: 'CHEAT_COST_ZERO',
      message: '金手指使用后标记值与反噬值均无变化，代价体系不稳定。',
      severity: 'major',
    })
  }

  const expositionPenalty = (content.match(/规则|境界|修炼体系|等级|天道|宇宙法则|面板/g) || []).length
  if (expositionPenalty > 8) {
    findings.push({
      code: 'RULE_EXPOSITION_HEAVY',
      message: '规则说明过多，容易打断沉浸感。',
      severity: 'major',
    })
  }

  const secretPattern = /(真相|终极秘密|世界本源|最终真相|终极规则)/g
  if (input.worldSecretRevealedTooEarly || (input.chapterNo <= 30 && secretPattern.test(content))) {
    findings.push({
      code: 'SECRET_REVEALED_TOO_EARLY',
      message: '世界核心秘密揭露过早，应延后到中后期。',
      severity: 'critical',
    })
  }

  if (input.validationReport?.result === 'retry' || input.validationReport?.result === 'fail') {
    findings.push({
      code: 'VALIDATION_REPORT_WEAK',
      message: '基础一致性校验未通过，规则玄幻还需要额外稳定。',
      severity: 'major',
    })
  }

  const criticalCount = findings.filter(item => item.severity === 'critical').length
  const majorCount = findings.filter(item => item.severity === 'major').length
  const score = Math.max(0, 100 - criticalCount * 25 - majorCount * 12 - markPenalty)

  return {
    passed: score >= 80 && criticalCount === 0,
    score,
    findings,
  }
}
