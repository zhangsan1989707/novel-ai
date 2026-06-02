import { describe, expect, it } from 'vitest'
import { normalizeCommittedChapterContent } from '@/lib/engine/chapter-projections'

describe('deslop 内容落库解析', () => {
  it('解析 ```json 包裹的 revisedContent', () => {
    const wrapped = '```json\n{"revisedContent":"段落一\\n\\n段落二"}\n```'
    expect(normalizeCommittedChapterContent(wrapped)).toBe('段落一\n\n段落二')
  })

  it('解析 malformed JSON 中未转义换行的 revisedContent', () => {
    const malformed = '{\n  "revisedContent": "第一幕\n\n第二幕"\n}'
    expect(normalizeCommittedChapterContent(malformed)).toBe('第一幕\n\n第二幕')
  })

  it('解析带中文引号和 changes 字段的 fenced JSON 正文', () => {
    const wrapped = '```json\n{\n  "revisedContent": "血味儿。\\n\\n“废物，你也配姓夜？”\\n\\n靴底踩着他后脑勺。",\n  "changes": []\n}\n```'
    expect(normalizeCommittedChapterContent(wrapped)).toBe('血味儿。\n\n“废物，你也配姓夜？”\n\n靴底踩着他后脑勺。')
  })
})
