import { describe, expect, it } from 'vitest'
import { validateOutline } from '@/lib/engine/outline-validator'

describe('validateOutline', () => {
  it('blocks early finale language before late-stage progress', () => {
    const result = validateOutline(
      [
        {
          chapterNumber: 12,
          title: '终局之战',
          summary: '主角在这一章迎来最终决战并让天下太平。',
        },
      ],
      { progressRatio: 0.32 }
    )

    expect(result.passed).toBe(false)
    expect(result.violations.some(item => item.includes('禁止终局内容'))).toBe(true)
  })

  it('blocks final boss death before finale window', () => {
    const result = validateOutline(
      [
        {
          chapterNumber: 48,
          title: '魔尊陨落',
          summary: '主角彻底击败魔尊，至此再无后患。',
        },
      ],
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
      [
        {
          chapterNumber: 26,
          title: '古镜真相',
          summary: '主角提前揭开古镜秘密，谜底就此揭晓。',
        },
      ],
      {
        progressRatio: 0.41,
        openPlotlines: [
          {
            description: '古镜秘密',
            plannedAt: 60,
            plantedAt: 8,
            status: 'OPEN',
          },
        ],
      }
    )

    expect(result.passed).toBe(false)
    expect(result.violations.some(item => item.includes('提前回收伏笔'))).toBe(true)
  })
})
