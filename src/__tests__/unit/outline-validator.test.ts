import { describe, expect, it } from 'vitest'
import { validateOutline, finaleGuardValidator } from '@/lib/engine/outline-validator'

describe('validateOutline', () => {
  it('blocks early finale language before late-stage progress', () => {
    const result = validateOutline(
      [{
        chapterNumber: 12,
        title: '终局之战',
        summary: '主角在这一章迎来最终决战并让天下太平。',
      }],
      { progressRatio: 0.32 }
    )

    expect(result.passed).toBe(false)
    expect(result.violations.some(item => item.includes('禁止终局内容'))).toBe(true)
  })

  it('blocks final boss death before finale window', () => {
    const result = validateOutline(
      [{
        chapterNumber: 48,
        title: '魔尊陨落',
        summary: '主角彻底击败魔尊，至此再无后患。',
      }],
      {
        progressRatio: 0.58,
        currentArcName: '中盘冲突',
        currentArcStage: 'MID_CONFLICT',
        finalBossNames: ['魔尊'],
        protectedVillainNames: ['魔尊'],
      }
    )

    expect(result.passed).toBe(false)
    expect(result.violations.some(item => item.includes('终极反派'))).toBe(true)
  })

  it('blocks plotline payoff before planned chapter', () => {
    const result = validateOutline(
      [{
        chapterNumber: 26,
        title: '古镜真相',
        summary: '主角提前揭开古镜秘密，谜底就此揭晓。',
      }],
      {
        progressRatio: 0.41,
        openPlotlines: [{
          description: '古镜秘密',
          plannedAt: 60,
          plantedAt: 8,
          status: 'OPEN',
        }],
      }
    )

    expect(result.passed).toBe(false)
    expect(result.violations.some(item => item.includes('提前回收伏笔'))).toBe(true)
  })

  it('passes cleanly for normal outline at 50% progress', () => {
    const result = validateOutline(
      [{
        chapterNumber: 50,
        title: '新的征程',
        summary: '主角踏上新的旅途，遇到了新的伙伴。',
      }],
      { progressRatio: 0.5 }
    )

    expect(result.passed).toBe(true)
    expect(result.violations).toHaveLength(0)
  })

  it('adds warnings about last 30% chapters', () => {
    const chapters = Array.from({ length: 10 }, (_, i) => ({
      chapterNumber: 90 + i,
      title: `章节${90 + i}`,
      summary: '正常的内容。',
    }))

    const result = validateOutline(chapters, { progressRatio: 0.92 })
    expect(result.warnings.some(w => w.includes('最后30%章节'))).toBe(true)
  })
})

describe('finaleGuardValidator', () => {
  it('blocks mainline termination keywords before 92% progress', () => {
    const result = finaleGuardValidator(
      [{
        chapterNumber: 60,
        title: '尘埃落定',
        summary: '一切纷争结束，尘埃落定，天下归于平静。',
      }],
      { progressRatio: 0.6, currentArcStage: 'MID_CONFLICT' }
    )

    expect(result.violations.length).toBeGreaterThan(0)
    expect(result.violations.some(v => v.includes('主线终结') || v.includes('主线提前收束'))).toBe(true)
  })

  it('allows finale content after 85% progress (only warnings)', () => {
    const result = finaleGuardValidator(
      [{
        chapterNumber: 90,
        title: '终局之战',
        summary: '主角迎来最终决战。',
      }],
      { progressRatio: 0.92 }
    )

    // after 85%, forbidden keywords are allowed (only warnings about收束感)
    expect(result.warnings.some(w => w.includes('后段'))).toBe(true)
  })

  it('blocks foreshadow resolution before 88% progress', () => {
    const result = finaleGuardValidator(
      [{
        chapterNumber: 70,
        title: '真相大白',
        summary: '所有伏笔回收，真相大白于天下。',
      }],
      { progressRatio: 0.7 }
    )

    expect(result.violations.some(v => v.includes('伏笔') || v.includes('谜团'))).toBe(true)
  })

  it('blocks villain defeat before 90% progress', () => {
    const result = finaleGuardValidator(
      [{
        chapterNumber: 50,
        title: '魔尊陨落',
        summary: '主角彻底击败魔尊，魔尊死亡。',
      }],
      {
        progressRatio: 0.5,
        currentArcStage: 'MID_CONFLICT',
        finalBossNames: ['魔尊'],
        protectedVillainNames: ['魔尊'],
      }
    )

    expect(result.violations.some(v => v.includes('终极反派'))).toBe(true)
  })
})
