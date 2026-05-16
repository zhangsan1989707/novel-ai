import { AIService } from '@/lib/ai/service'
import { scanForbiddenWords, scanForbiddenPatterns } from '@/lib/knowledge/anti-ai'
import { buildDeslopPrompt } from '../prompts/deslop'

interface DeslopInput {
  projectId: number
  content: string
  genre?: string | null
  writingStyle?: string | null
  strictness?: 'light' | 'medium' | 'heavy'
}

interface DeslopChange {
  type: 'word' | 'pattern' | 'structure'
  original: string
  revised: string
  reason: string
}

interface DeslopResult {
  originalContent: string
  revisedContent: string
  changes: DeslopChange[]
  aiScore: number
  tokens?: number
}

function calculateAiScore(
  content: string,
  wordHits: { word: string; count: number }[],
  patternHits: { pattern: string; matches: string[] }[]
): number {
  let score = 100

  const criticalWords = wordHits.filter(w => {
    const fw = scanForbiddenWords(content).find(h => h.word.word === w.word)
    return fw && fw.word.level === 'critical'
  })
  const warningWords = wordHits.filter(w => {
    const fw = scanForbiddenWords(content).find(h => h.word.word === w.word)
    return fw && fw.word.level === 'warning'
  })

  for (const w of criticalWords) {
    score -= w.count * 5
  }
  for (const w of warningWords) {
    score -= w.count * 2
  }
  for (const p of patternHits) {
    score -= p.matches.length * 8
  }

  const paragraphs = content.split(/\n+/).filter(p => p.trim().length > 0)
  if (paragraphs.length >= 3) {
    const lengths = paragraphs.map(p => p.length)
    const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length
    const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avgLen, 2), 0) / lengths.length
    const cv = Math.sqrt(variance) / (avgLen || 1)
    if (cv < 0.2) {
      score -= 10
    }
  }

  return Math.max(0, Math.min(100, score))
}

export async function deslopperAgent(input: DeslopInput): Promise<DeslopResult> {
  const { projectId, content, genre, writingStyle, strictness = 'medium' } = input

  const wordScan = scanForbiddenWords(content)
  const patternScan = scanForbiddenPatterns(content)

  const detectedIssues = {
    forbiddenWords: wordScan.map(w => ({ word: w.word.word, count: w.count })),
    forbiddenPatterns: patternScan.map(p => ({
      pattern: p.pattern.pattern,
      matches: p.matches,
    })),
  }

  const originalScore = calculateAiScore(content, detectedIssues.forbiddenWords, detectedIssues.forbiddenPatterns)

  const provider = await AIService.createProvider({
    projectId,
    usageType: 'DESLOPPER',
  })

  const prompt = buildDeslopPrompt({
    content,
    genre,
    writingStyle,
    strictness,
    detectedIssues,
  })

  const result = await provider.generate(prompt, {
    temperature: 0.7,
    maxTokens: Math.max(4000, content.length * 2),
  })

  let revisedContent = content
  let changes: DeslopChange[] = []

  const jsonMatch = result.content.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      if (typeof parsed.revisedContent === 'string') {
        revisedContent = parsed.revisedContent
      }
      if (Array.isArray(parsed.changes)) {
        changes = parsed.changes.filter(
          (c: DeslopChange) =>
            c.type && c.original && c.revised && c.reason &&
            ['word', 'pattern', 'structure'].includes(c.type)
        )
      }
    } catch {
      revisedContent = result.content
    }
  } else {
    revisedContent = result.content
  }

  const revisedWordScan = scanForbiddenWords(revisedContent)
  const revisedPatternScan = scanForbiddenPatterns(revisedContent)
  const revisedDetectedIssues = {
    forbiddenWords: revisedWordScan.map(w => ({ word: w.word.word, count: w.count })),
    forbiddenPatterns: revisedPatternScan.map(p => ({
      pattern: p.pattern.pattern,
      matches: p.matches,
    })),
  }
  const revisedScore = calculateAiScore(revisedContent, revisedDetectedIssues.forbiddenWords, revisedDetectedIssues.forbiddenPatterns)

  return {
    originalContent: content,
    revisedContent,
    changes,
    aiScore: revisedScore,
    tokens: result.totalTokens,
  }
}

export function detectAiScore(content: string): {
  score: number
  forbiddenWords: { word: string; count: number; level: string }[]
  forbiddenPatterns: { pattern: string; description: string; matches: string[]; level: string }[]
} {
  const wordScan = scanForbiddenWords(content)
  const patternScan = scanForbiddenPatterns(content)

  const forbiddenWords = wordScan.map(w => ({
    word: w.word.word,
    count: w.count,
    level: w.word.level,
  }))

  const forbiddenPatterns = patternScan.map(p => ({
    pattern: p.pattern.pattern,
    description: p.pattern.description,
    matches: p.matches,
    level: p.pattern.level,
  }))

  const score = calculateAiScore(
    content,
    forbiddenWords.map(w => ({ word: w.word, count: w.count })),
    forbiddenPatterns.map(p => ({ pattern: p.pattern, matches: p.matches }))
  )

  return { score, forbiddenWords, forbiddenPatterns }
}

export type { DeslopInput, DeslopResult, DeslopChange }
