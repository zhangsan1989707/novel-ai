import { describe, expect, it } from 'vitest'
import { calculateBatchSize } from '@/lib/engine/batch-planner'

describe('calculateBatchSize', () => {
  it('returns a value within stage range for opening', () => {
    const result = calculateBatchSize('qidian', 'opening', 0.5, 0.5)
    expect(result).toBeGreaterThanOrEqual(5)
    expect(result).toBeLessThanOrEqual(8)
  })

  it('returns a value within stage range for growth', () => {
    const result = calculateBatchSize('qidian', 'growth', 0.5, 0.5)
    expect(result).toBeGreaterThanOrEqual(8)
    expect(result).toBeLessThanOrEqual(12)
  })

  it('returns a value within stage range for expansion', () => {
    const result = calculateBatchSize('qidian', 'expansion', 0.5, 0.5)
    expect(result).toBeGreaterThanOrEqual(10)
    expect(result).toBeLessThanOrEqual(15)
  })

  it('returns a value within stage range for finale', () => {
    const result = calculateBatchSize('qidian', 'finale', 0.5, 0.5)
    expect(result).toBeGreaterThanOrEqual(3)
    expect(result).toBeLessThanOrEqual(6)
  })

  it('higher worldComplexity yields larger batch', () => {
    const low = calculateBatchSize('qidian', 'growth', 0.1, 0.5)
    const high = calculateBatchSize('qidian', 'growth', 0.9, 0.5)
    expect(high).toBeGreaterThanOrEqual(low)
  })

  it('higher plotDensity yields larger batch', () => {
    const low = calculateBatchSize('qidian', 'growth', 0.5, 0.1)
    const high = calculateBatchSize('qidian', 'growth', 0.5, 1.0)
    expect(high).toBeGreaterThanOrEqual(low)
  })

  it('progressRatio > 0.78 reduces batch size', () => {
    const early = calculateBatchSize('qidian', 'growth', 0.5, 0.5, { progressRatio: 0.3 })
    const late = calculateBatchSize('qidian', 'growth', 0.5, 0.5, { progressRatio: 0.85 })
    expect(late).toBeLessThanOrEqual(early)
  })

  it('openPlotlineCount >= 10 reduces batch size', () => {
    const few = calculateBatchSize('qidian', 'growth', 0.5, 0.5, { openPlotlineCount: 2 })
    const many = calculateBatchSize('qidian', 'growth', 0.5, 0.5, { openPlotlineCount: 12 })
    expect(many).toBeLessThanOrEqual(few)
  })

  it('fast-paced steering increases batch', () => {
    const normal = calculateBatchSize('qidian', 'growth', 0.5, 0.5)
    const fast = calculateBatchSize('qidian', 'growth', 0.5, 0.5, {
      steering: { pace: 0.9 },
    })
    expect(fast).toBeGreaterThanOrEqual(normal)
  })

  it('high mysteryDensity decreases batch', () => {
    const normal = calculateBatchSize('qidian', 'growth', 0.5, 0.5)
    const mystery = calculateBatchSize('qidian', 'growth', 0.5, 0.5, {
      steering: { mysteryDensity: 0.8 },
    })
    expect(mystery).toBeLessThanOrEqual(normal)
  })

  it('result is always clamped within stage range', () => {
    const stages = ['opening', 'growth', 'expansion', 'mid_conflict', 'pre_finale', 'finale'] as const
    const ranges = {
      opening: { min: 5, max: 8 },
      growth: { min: 8, max: 12 },
      expansion: { min: 10, max: 15 },
      mid_conflict: { min: 8, max: 12 },
      pre_finale: { min: 5, max: 8 },
      finale: { min: 3, max: 6 },
    }

    for (const stage of stages) {
      const result = calculateBatchSize('qidian', stage, 1, 1.5, {
        progressRatio: 0.1,
        openPlotlineCount: 0,
        steering: { pace: 0.9, conflictIntensity: 0.9 },
      })
      expect(result).toBeGreaterThanOrEqual(ranges[stage].min)
      expect(result).toBeLessThanOrEqual(ranges[stage].max)
    }
  })
})
