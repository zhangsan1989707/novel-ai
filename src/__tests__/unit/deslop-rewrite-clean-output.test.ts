import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  findUnique: vi.fn(),
}))

vi.mock('@/lib/ai/service', () => ({
  AIService: {
    createProvider: vi.fn().mockResolvedValue({
      generate: mocks.generate,
    }),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    novelProject: {
      findUnique: mocks.findUnique,
    },
  },
}))

describe('deslop rewrite API — 用户看到的正文必须是纯文本', () => {
  beforeEach(() => {
    mocks.generate.mockReset()
    mocks.findUnique.mockReset()
    mocks.findUnique.mockResolvedValue({ id: 1, genre: '玄幻', writingStyle: '爽文' })
  })

  async function callRewrite(content: string) {
    const { POST } = await import('@/app/api/novel/deslop/rewrite/route')
    const req = new NextRequest('http://localhost/api/novel/deslop/rewrite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: 1, content, strictness: 'medium' }),
    })
    const res = await POST(req)
    const body = await res.json()
    return body
  }

  const cleanBody = '晨雾散尽，林家广场上站满了人。'

  it('模型返回标准 JSON 时，data.content 只包含纯正文', async () => {
    mocks.generate.mockResolvedValue({
      content: JSON.stringify({ revisedContent: cleanBody, changes: [] }),
      totalTokens: 100,
    })

    const body = await callRewrite('原文')

    expect(body.success).toBe(true)
    expect(body.data.content).toBe(cleanBody)
    expect(body.data.revisedContent).toBe(cleanBody)
    expect(body.data.content).not.toContain('revisedContent')
    expect(body.data.content).not.toContain('{')
  })

  it('模型返回 ```json 包裹时，data.content 只包含纯正文', async () => {
    mocks.generate.mockResolvedValue({
      content: '```json\n' + JSON.stringify({ revisedContent: cleanBody, changes: [] }) + '\n```',
      totalTokens: 100,
    })

    const body = await callRewrite('原文')

    expect(body.success).toBe(true)
    expect(body.data.content).toBe(cleanBody)
    expect(body.data.content).not.toContain('```')
    expect(body.data.content).not.toContain('revisedContent')
  })

  it('模型返回带说明文字的 JSON 时，data.content 只包含纯正文', async () => {
    mocks.generate.mockResolvedValue({
      content: '好的，这是改写结果：\n' + JSON.stringify({ revisedContent: cleanBody, changes: [] }),
      totalTokens: 100,
    })

    const body = await callRewrite('原文')

    expect(body.success).toBe(true)
    expect(body.data.content).toBe(cleanBody)
    expect(body.data.content).not.toContain('好的')
    expect(body.data.content).not.toContain('revisedContent')
  })

  it('模型返回 malformed JSON（未转义换行）时，data.content 正确还原段落', async () => {
    const paragraphBody = '第一幕\n\n第二幕\n\n第三幕'
    mocks.generate.mockResolvedValue({
      content: '{\n  "revisedContent": "' + paragraphBody + '",\n  "changes": []\n}',
      totalTokens: 100,
    })

    const body = await callRewrite('原文')

    expect(body.success).toBe(true)
    expect(body.data.content).toBe(paragraphBody)
    expect(body.data.content).not.toContain('\\n')
    expect(body.data.content).not.toContain('revisedContent')
  })

  it('用户看到的正文不包含 JSON 键名、花括号、转义符', async () => {
    const messyOutput = '```json\n{"revisedContent":"风吹过山岗，带来远处的烟火气。","changes":[{"type":"word","original":"原文","revised":"改后","reason":"去AI味"}]}\n```'
    mocks.generate.mockResolvedValue({
      content: messyOutput,
      totalTokens: 100,
    })

    const body = await callRewrite('原文')
    const userContent: string = body.data.content

    expect(userContent).toBe('风吹过山岗，带来远处的烟火气。')
    expect(userContent).not.toMatch(/[{}]/)
    expect(userContent).not.toContain('revisedContent')
    expect(userContent).not.toContain('changes')
    expect(userContent).not.toContain('\\n')
    expect(userContent).not.toContain('```')
  })
})
