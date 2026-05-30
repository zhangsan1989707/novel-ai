import { NextRequest, NextResponse } from 'next/server'
import {
  buildTitleFactoryPrompt,
  rankCandidates,
  scoreTitle,
  totalScore,
  type TitleCandidate,
  type TitleStrategyInput,
} from '@/lib/title-strategy'
import { normalizeNovelTitle } from '@/lib/novel-title'
import { createProviderFromEnv, createProviderFromConfigId, createProviderFromDefaultConfig } from '@/lib/ai'
import { AIVendor } from '@/types'
import { logError } from '@/lib/logger'

interface RequestBody {
  platform?: string
  channel?: string
  genre?: string
  subGenres?: string[]
  targetStyle?: string
  coreHook: string
  protagonistIdentity?: string
  conflict?: string
  emotionalPromise?: string
  forbiddenWords?: string[]
  vendor?: string
  aiModelId?: number
  /** 已有的标题，用于评估 */
  currentTitle?: string
}

function parseCandidates(raw: string, sourceText?: string): TitleCandidate[] {
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return []

  try {
    const parsed = JSON.parse(jsonMatch[0])
    const candidates = Array.isArray(parsed.candidates) ? parsed.candidates : []
    return candidates
      .filter((c: unknown): c is Record<string, unknown> => typeof c === 'object' && c !== null)
      .map((c: Record<string, unknown>) => ({
        title: normalizeNovelTitle(String(c.title || '')),
        subtitle: typeof c.subtitle === 'string' ? c.subtitle : undefined,
        style: (['hot', 'stable', 'literary', 'short_drama', 'platform'].includes(String(c.style))
          ? c.style
          : 'hot') as TitleCandidate['style'],
        score: typeof c.score === 'number' ? c.score : 50,
        tags: Array.isArray(c.tags) ? c.tags.map(String) : [],
        reason: String(c.reason || ''),
        risk: String(c.risk || ''),
      }))
      .filter((c: TitleCandidate) => c.title.length >= 2 && c.title.length <= 30)
  } catch {
    return []
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json()

    if (!body.coreHook) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: '核心卖点不能为空' } },
        { status: 400 }
      )
    }

    // 构建输入
    const input: TitleStrategyInput = {
      platform: (['qidian', 'fanqie', 'qimao', 'jjwxc', 'general'].includes(body.platform || '')
        ? body.platform
        : 'general') as TitleStrategyInput['platform'],
      channel: (['male', 'female'].includes(body.channel || '') ? body.channel : 'female') as TitleStrategyInput['channel'],
      genre: body.genre || '言情',
      subGenres: body.subGenres,
      targetStyle: (['market', 'quality', 'short_drama', 'literary'].includes(body.targetStyle || '')
        ? body.targetStyle
        : 'market') as TitleStrategyInput['targetStyle'],
      coreHook: body.coreHook,
      protagonistIdentity: body.protagonistIdentity,
      conflict: body.conflict,
      emotionalPromise: body.emotionalPromise,
      forbiddenWords: body.forbiddenWords,
    }

    // 获取 AI provider
    let provider
    if (body.aiModelId) {
      const dbProvider = await createProviderFromConfigId(body.aiModelId)
      if (dbProvider) provider = dbProvider
    }
    if (!provider) {
      provider = body.vendor
        ? createProviderFromEnv(body.vendor as AIVendor)
        : await createProviderFromDefaultConfig()
    }

    // 生成候选标题
    const prompt = buildTitleFactoryPrompt(input)
    const result = await provider.generate(prompt, {
      temperature: 0.95,
      maxTokens: 4000,
    })

    const sourceText = [body.coreHook, body.protagonistIdentity, body.conflict].filter(Boolean).join(' ')
    const rawCandidates = parseCandidates(result.content, sourceText)

    if (rawCandidates.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'PARSE_ERROR', message: 'AI 未返回有效候选标题' } },
        { status: 502 }
      )
    }

    // 评分排序
    const ranked = rankCandidates(rawCandidates, input.platform, input.genre)

    // 去重：移除重复标题
    const seen = new Set<string>()
    const deduped = ranked.filter(candidate => {
      const normalized = candidate.title.toLowerCase().trim()
      if (seen.has(normalized)) return false
      seen.add(normalized)
      return true
    })

    // 当前标题评估
    let currentTitleScore = null
    if (body.currentTitle) {
      const breakdown = scoreTitle(body.currentTitle, input.platform, input.genre)
      currentTitleScore = {
        title: body.currentTitle,
        score: totalScore(breakdown),
        breakdown,
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        candidates: deduped.slice(0, 10),
        workingTitle: deduped[deduped.length - 1]?.title || '',
        recommendation: deduped[0],
        currentTitleScore,
      },
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'generate_titles' })
    return NextResponse.json(
      { success: false, error: { code: 'GENERATION_ERROR', message: '标题生成失败' } },
      { status: 500 }
    )
  }
}
