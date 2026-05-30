import { describe, expect, it } from 'vitest'
import { buildArcEventPromptContext } from '@/lib/engine/arc-event-ledger'

describe('buildArcEventPromptContext', () => {
  it('returns placeholder text when no events exist', () => {
    expect(buildArcEventPromptContext([])).toContain('暂无待推进')
  })

  it('lists pending events with chapter hints', () => {
    const text = buildArcEventPromptContext([
      { eventKey: 'arc-1-event-1', eventDescription: '主角觉醒', status: 'pending', plannedChapterNo: 5, actualChapterNo: null },
      { eventKey: 'arc-1-event-2', eventDescription: '初次试炼', status: 'started', plannedChapterNo: 8, actualChapterNo: 7 },
    ])

    expect(text).toContain('arc-1-event-1')
    expect(text).toContain('plan=5')
    expect(text).toContain('actual=7')
    expect(text).toContain('不得重复已发生事件')
  })
})
