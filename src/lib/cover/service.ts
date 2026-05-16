import { AIService } from '@/lib/ai/service'
import { buildCoverImagePrompt, buildCoverAnalysisPrompt } from '@/lib/prompts/cover'
import { logger } from '@/lib/logger'

interface CoverGenerationInput {
  projectId: number
  title: string
  genre: string
  synopsis?: string
  targetAudience?: string
  style?: string
}

interface CoverAnalysis {
  colorScheme: string[]
  composition: string
  elements: string[]
  mood: string
}

interface CoverGenerationResult {
  imageUrl: string
  prompt: string
  analysis: CoverAnalysis
}

const IMAGE_GEN_BASE_URL = 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image'

function parseAnalysisResult(content: string): CoverAnalysis {
  const defaultAnalysis: CoverAnalysis = {
    colorScheme: [],
    composition: '',
    elements: [],
    mood: '',
  }

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return defaultAnalysis

    const parsed = JSON.parse(jsonMatch[0])

    return {
      colorScheme: Array.isArray(parsed.colorScheme) ? parsed.colorScheme : [],
      composition: typeof parsed.composition === 'string' ? parsed.composition : '',
      elements: Array.isArray(parsed.elements) ? parsed.elements : [],
      mood: typeof parsed.mood === 'string' ? parsed.mood : '',
    }
  } catch {
    logger.warn('Failed to parse cover analysis result, using defaults')
    return defaultAnalysis
  }
}

export async function generateCover(input: CoverGenerationInput): Promise<CoverGenerationResult> {
  const provider = await AIService.createProvider({
    projectId: input.projectId,
    usageType: 'COVER_ANALYSIS',
  })

  const analysisPrompt = buildCoverAnalysisPrompt({
    title: input.title,
    genre: input.genre,
    synopsis: input.synopsis,
    targetAudience: input.targetAudience,
    style: input.style,
  })

  const analysisResult = await provider.generate(analysisPrompt, {
    temperature: 0.7,
    maxTokens: 1000,
  })

  const analysis = parseAnalysisResult(analysisResult.content)

  const imagePrompt = buildCoverImagePrompt({
    title: input.title,
    genre: input.genre,
    synopsis: input.synopsis,
    targetAudience: input.targetAudience,
    style: input.style,
  })

  const imageUrl = `${IMAGE_GEN_BASE_URL}?prompt=${encodeURIComponent(imagePrompt)}&image_size=portrait_4_3`

  logger.info(
    { projectId: input.projectId, genre: input.genre },
    'Cover generated successfully'
  )

  return {
    imageUrl,
    prompt: imagePrompt,
    analysis,
  }
}

export type { CoverGenerationInput, CoverGenerationResult, CoverAnalysis }
