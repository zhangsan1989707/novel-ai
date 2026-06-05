import { describe, expect, it } from 'vitest'
import { calculateVolume, getVolumeChapterRange } from '@/lib/memory/volume-summary'

describe('calculateVolume', () => {
  it('returns volume 1 for chapter 1 with 4 volumes / 100 chapters', () => {
    expect(calculateVolume(1, 4, 100)).toBe(1)
  })

  it('returns volume 1 for chapter 25 (boundary)', () => {
    expect(calculateVolume(25, 4, 100)).toBe(1)
  })

  it('returns volume 2 for chapter 26', () => {
    expect(calculateVolume(26, 4, 100)).toBe(2)
  })

  it('returns volume 4 for chapter 100', () => {
    expect(calculateVolume(100, 4, 100)).toBe(4)
  })

  it('returns volume 1 when totalVolumes is 1', () => {
    expect(calculateVolume(50, 1, 100)).toBe(1)
  })

  it('handles uneven division (10 chapters, 3 volumes)', () => {
    // 10 / 3 = 3.33, ceil = 4 chapters per volume
    // vol1: 1-4, vol2: 5-8, vol3: 9-10
    expect(calculateVolume(1, 3, 10)).toBe(1)
    expect(calculateVolume(4, 3, 10)).toBe(1)
    expect(calculateVolume(5, 3, 10)).toBe(2)
    expect(calculateVolume(9, 3, 10)).toBe(3)
    expect(calculateVolume(10, 3, 10)).toBe(3)
  })
})

describe('getVolumeChapterRange', () => {
  it('returns correct range for volume 1 of 4/100', () => {
    expect(getVolumeChapterRange(1, 4, 100)).toEqual({ start: 1, end: 25 })
  })

  it('returns correct range for volume 4 of 4/100', () => {
    expect(getVolumeChapterRange(4, 4, 100)).toEqual({ start: 76, end: 100 })
  })

  it('returns full range for single volume', () => {
    expect(getVolumeChapterRange(1, 1, 100)).toEqual({ start: 1, end: 100 })
  })

  it('handles uneven division (10 chapters, 3 volumes)', () => {
    expect(getVolumeChapterRange(1, 3, 10)).toEqual({ start: 1, end: 4 })
    expect(getVolumeChapterRange(2, 3, 10)).toEqual({ start: 5, end: 8 })
    expect(getVolumeChapterRange(3, 3, 10)).toEqual({ start: 9, end: 10 })
  })
})
