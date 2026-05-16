import { AIService } from '@/lib/ai/service'
import { buildResearchPrompt } from '../prompts/research'

interface ResearchInput {
  projectId: number
  topic: string
  context: string
  genre?: string | null
  worldSetting?: string | null
  chapterNo?: number
  existingResearch?: string[]
}

interface ResearchResult {
  topic: string
  summary: string
  keyFacts: string[]
  creativeMaterials: string[]
  confidence: 'high' | 'medium' | 'low'
  usageSuggestions: string[]
  tokens?: number
}

export async function researcherAgent(input: ResearchInput): Promise<ResearchResult> {
  const { projectId, topic, context, genre, worldSetting, chapterNo, existingResearch } = input

  const provider = await AIService.createProvider({
    projectId,
    usageType: 'RESEARCHER',
  })

  const prompt = buildResearchPrompt({
    topic,
    context,
    genre,
    worldSetting,
    chapterNo,
    existingResearch,
  })

  const result = await provider.generate(prompt, {
    temperature: 0.6,
    maxTokens: 2000,
  })

  const jsonMatch = result.content.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        topic,
        summary: parsed.summary || '',
        keyFacts: Array.isArray(parsed.keyFacts) ? parsed.keyFacts : [],
        creativeMaterials: Array.isArray(parsed.creativeMaterials) ? parsed.creativeMaterials : [],
        confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'medium',
        usageSuggestions: Array.isArray(parsed.usageSuggestions) ? parsed.usageSuggestions : [],
        tokens: result.totalTokens,
      }
    } catch {
      return {
        topic,
        summary: result.content.slice(0, 300),
        keyFacts: [],
        creativeMaterials: [],
        confidence: 'low',
        usageSuggestions: [],
        tokens: result.totalTokens,
      }
    }
  }

  return {
    topic,
    summary: result.content.slice(0, 300),
    keyFacts: [],
    creativeMaterials: [],
    confidence: 'low',
    usageSuggestions: [],
    tokens: result.totalTokens,
  }
}

export type { ResearchInput, ResearchResult }
