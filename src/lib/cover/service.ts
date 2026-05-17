import { AIService } from '@/lib/ai/service'
import { buildCoverImagePrompt, buildCoverAnalysisPrompt } from '@/lib/prompts/cover'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { AIVendor } from '@/types'

interface CoverGenerationInput {
  projectId: number
  title: string
  genre?: string
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
    usageType: 'COVER_GENERATION',
  })

  // 1. 分析封面需求
  const analysisPrompt = buildCoverAnalysisPrompt({
    title: input.title,
    genre: input.genre || '',
    synopsis: input.synopsis,
    targetAudience: input.targetAudience,
    style: input.style,
  })

  const analysisResult = await provider.generate(analysisPrompt, {
    temperature: 0.7,
    maxTokens: 1000,
  })

  const analysis = parseAnalysisResult(analysisResult.content)

  // 2. 构建图片生成提示词
  const imagePrompt = buildCoverImagePrompt({
    title: input.title,
    genre: input.genre || '',
    synopsis: input.synopsis,
    targetAudience: input.targetAudience,
    style: input.style,
  })

  // 3. 检查是否支持图片生成
  if (!('generateImage' in provider) || typeof provider.generateImage !== 'function') {
    // 如果不支持，检查是否有 OpenAI 配置可用
    try {
      const openAIProvider = await AIService.createProvider({
        vendor: AIVendor.OPENAI,
        projectId: input.projectId,
        usageType: 'COVER_GENERATION',
      })
      
      if ('generateImage' in openAIProvider && typeof openAIProvider.generateImage === 'function') {
        const imageResult = await (openAIProvider as any).generateImage(imagePrompt, {
          size: '1024x1792',
          quality: 'standard',
          style: 'vivid',
        })

        const imageUrl = imageResult.imageUrls?.[0] || ''

        // 保存封面到项目
        await saveCoverToProject(input.projectId, imageUrl, imagePrompt)

        logger.info(
          { projectId: input.projectId, genre: input.genre },
          'Cover generated successfully with OpenAI DALL-E'
        )

        return {
          imageUrl,
          prompt: imagePrompt,
          analysis,
        }
      }
    } catch {
      // OpenAI 也不可用
    }
    throw new Error('Image generation is not available. Please configure OpenAI API key.')
  }

  // 4. 使用当前 provider 生成图片
  const imageResult = await (provider as any).generateImage(imagePrompt, {
    size: '1024x1792',
    quality: 'standard',
    style: 'vivid',
  })

  const imageUrl = imageResult.imageUrls?.[0] || ''

  // 5. 保存封面到项目
  await saveCoverToProject(input.projectId, imageUrl, imagePrompt)

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

async function saveCoverToProject(projectId: number, imageUrl: string, _prompt: string): Promise<void> {
  try {
    await prisma.novelProject.update({
      where: { id: projectId },
      data: {
        coverImage: imageUrl,
      },
    })
  } catch (err) {
    logger.warn(
      { projectId, error: err },
      'Failed to save cover to project'
    )
  }
}

export type { CoverGenerationInput, CoverGenerationResult, CoverAnalysis }
