import { AIService } from '@/lib/ai/service'
import type { AIProvider } from '@/lib/ai/types'
import {
  StyleProfileData,
  StyleExtractInput,
  StyleExtractResult,
  StyleSampleStats,
} from '@/types/style'
import { countChineseWords } from '@/lib/utils'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { logError } from '@/lib/logger'
import { buildStylePromptCard } from '@/lib/prompts/style/style-card'

const STYLE_EXTRACT_SYSTEM_PROMPT = `你是小说风格分析器。请从以下小说样本中提取"抽象写作风格"。

重要原则：
- 不要复述原文，不要引用连续原句，不要输出可替代原文的内容
- 提取的是写作方法论和风格特征，不是具体内容
- 如果来源为现代在世作者，输出抽象商业写法标签（如"热血玄幻成长流"），不要使用作者名

请分析以下8个维度并输出严格JSON：
1. prose 文笔：整体语气、句子长短、描写密度、对话密度、内心独白密度
2. vocabulary 词汇：高频词类、口语化程度、古典/现代/网文程度
3. sentence 句式：常见句式、段落特征、过渡方式
4. rhetoric 修辞：手法、比喻风格、讽刺程度、感官描写
5. narrative 叙事：视角、旁白存在感、信息揭示方式、悬念手法
6. plot 剧情：节奏特征、冲突密度、反转频率、章尾钩子、爽点兑现
7. character 人物：主角塑造、对话风格、情绪外化、关系特征
8. generationGuide 生成指导：必须遵循的要点、必须避免的、生成说明

riskNotes：
- 如果源文本可能涉及在世的非公版作者，标注"MEDIUM"
- 如果是公版古典文本，标注"LOW"
- 如果是用户自写文本，标注"LOW"
- 如果高度关联特定在世作者，标注"HIGH"并注明理由`

export async function extractStyleProfile(
  input: StyleExtractInput,
  provider?: AIProvider
): Promise<StyleExtractResult> {
  const {
    projectId,
    volumeNumber = -1,
    sampleSize = 50000,
    styleProfileName,
    authorLabel,
    displayLabel,
    sourceType = 'USER_UPLOADED',
  } = input

  const project = await prisma.novelProject.findUnique({
    where: { id: projectId },
    include: {
      chapters: {
        where: {
          status: { in: ['COMPLETED', 'REVIEWING'] },
          content: { not: null },
        },
        orderBy: { chapterNumber: 'asc' },
      },
      sourceNovel: true,
    },
  })

  if (!project) {
    throw new Error('项目不存在')
  }

  const chapters = project.chapters
  let fullText = ''

  if (chapters.length > 0) {
    fullText = chapters.map(ch => ch.content || '').join('\n\n')
  } else if (project.sourceNovel?.originalText) {
    fullText = project.sourceNovel.originalText
  }

  if (!fullText.trim()) {
    throw new Error('没有可分析的文本内容')
  }

  const totalWords = countChineseWords(fullText)
  const effectiveSampleSize = Math.min(sampleSize, fullText.length)
  const sampleText = totalWords > effectiveSampleSize
    ? extractStrategicSamples(fullText, effectiveSampleSize, chapters.length)
    : fullText

  const avgSentenceLength = estimateAvgSentenceLength(sampleText)
  const dialogueRatio = estimateDialogueRatio(sampleText)

  const sampleStats: StyleSampleStats = {
    totalWords: countChineseWords(sampleText),
    chapterCount: chapters.length,
    validParagraphCount: (sampleText.match(/\n\n/g) || []).length + 1,
    dialogueRatio: Math.round(dialogueRatio * 100),
    avgSentenceLength: Math.round(avgSentenceLength),
    sampleExcerpt: sampleText.slice(0, 500),
  }

  const aiProvider = provider || await AIService.createProvider({
    projectId,
    usageType: 'STYLE_EXTRACTOR',
  })

  const userPrompt = buildStyleExtractPrompt(sampleText, project.title, project.genre, sourceType, authorLabel, displayLabel)

  const result = await aiProvider.generate(userPrompt, {
    temperature: 0.6,
    maxTokens: 4000,
  })

  const jsonMatch = result.content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('AI 未返回有效的 JSON 格式风格画像')
  }

  let profileJson: Record<string, unknown>
  try {
    profileJson = JSON.parse(jsonMatch[0])
  } catch {
    throw new Error('风格画像 JSON 解析失败')
  }

  const profileName = styleProfileName || `${project.title}_文风画像`
  const profileDisplayLabel = displayLabel || generateDisplayLabel(project.genre, profileJson)
  const riskLevel = determineRiskLevel(sourceType, authorLabel || null)

  const profileData: StyleProfileData = {
    id: '',
    name: profileName,
    description: `从《${project.title}》提取的文风画像`,
    sourceType,
    riskLevel,
    authorLabel: authorLabel || null,
    displayLabel: profileDisplayLabel,
    tags: buildTags(project.genre, profileJson),
    isPublic: false,
    prose: profileJson.prose as StyleProfileData['prose'],
    vocabulary: profileJson.vocabulary as StyleProfileData['vocabulary'],
    sentence: profileJson.sentence as StyleProfileData['sentence'],
    rhetoric: profileJson.rhetoric as StyleProfileData['rhetoric'],
    narrative: profileJson.narrative as StyleProfileData['narrative'],
    plot: profileJson.plot as StyleProfileData['plot'],
    character: profileJson.character as StyleProfileData['character'],
    generationGuide: (profileJson.generationGuide || {
      mustDo: [],
      avoid: [],
      sampleInstruction: '',
    }) as StyleProfileData['generationGuide'],
    promptCard: null,
    sampleStats,
    sourceNovelId: project.sourceNovel?.id || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const promptCard = buildPromptCardFromProfile(profileData, sourceType)
  const saved = await prisma.styleProfile.create({
    data: {
      name: profileData.name,
      description: profileData.description,
      sourceType: profileData.sourceType,
      riskLevel: profileData.riskLevel,
      authorLabel: profileData.authorLabel,
      displayLabel: profileData.displayLabel,
      profileJson: profileJson as Prisma.InputJsonValue,
      promptCard: promptCard || null,
      sampleStats: sampleStats ? (sampleStats as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      sourceNovelId: profileData.sourceNovelId,
      creatorId: project.creatorId,
      tags: profileData.tags,
    },
  })

  profileData.id = saved.id

  return {
    styleProfileId: saved.id,
    profileData: { ...profileData, promptCard },
    sampleStats,
  }
}

function extractStrategicSamples(fullText: string, maxLength: number, chapterCount: number): string {
  if (fullText.length <= maxLength) return fullText

  const parts: string[] = []
  const headSize = Math.min(Math.floor(maxLength * 0.15), fullText.length)
  parts.push(fullText.slice(0, headSize))

  if (chapterCount > 5) {
    const midStart = Math.floor(fullText.length * 0.4)
    const midSize = Math.min(Math.floor(maxLength * 0.3), fullText.length - midStart)
    parts.push(fullText.slice(midStart, midStart + midSize))

    const climaxStart = Math.floor(fullText.length * 0.7)
    const climaxSize = Math.min(Math.floor(maxLength * 0.3), fullText.length - climaxStart)
    parts.push(fullText.slice(climaxStart, climaxStart + climaxSize))
  }

  const tailSize = Math.min(Math.floor(maxLength * 0.25), fullText.length)
  parts.push(fullText.slice(Math.max(0, fullText.length - tailSize)))

  return parts.join('\n\n...[中间内容省略]...\n\n')
}

function buildStyleExtractPrompt(
  sampleText: string,
  title: string | null,
  genre: string | null,
  sourceType: string,
  authorLabel: string | null | undefined,
  displayLabel: string | null | undefined
): string {
  let prompt = `${STYLE_EXTRACT_SYSTEM_PROMPT}\n\n`
  prompt += `请分析以下小说样本的写作风格。\n\n`

  prompt += `【基本信息】\n`
  prompt += `- 书名：${title || '未知'}\n`
  if (genre) prompt += `- 类型：${genre}\n`
  prompt += `- 来源类型：${sourceType}\n`

  if (displayLabel) {
    prompt += `- 期望风格标签：${displayLabel}\n`
  }

  if (sourceType === 'PUBLIC_DOMAIN' && authorLabel) {
    prompt += `- 原始作者（公版）：${authorLabel}\n`
    prompt += `注意：可以研究风格但避免大段近似表达。\n`
  } else if (sourceType === 'LICENSED') {
    prompt += `- 来源：${authorLabel || '已授权文本'}\n`
  } else if (authorLabel) {
    prompt += `- 参考来源：${authorLabel || '用户上传'}\n`
    prompt += `注意：请使用抽象写作标签（如"热血玄幻成长流"），不要直接使用作者名作为风格标签。\n`
  }

  prompt += `\n【样本文本（${countChineseWords(sampleText)}字）】\n`
  prompt += sampleText.slice(0, 30000)

  prompt += `\n\n【输出要求】\n请严格按照 JSON 格式输出完整的风格画像，包含 prose、vocabulary、sentence、rhetoric、narrative、plot、character、generationGuide、riskNotes 九个字段。`

  return prompt
}

function generateDisplayLabel(genre: string | null, profileJson: Record<string, unknown>): string {
  if (genre) {
    const prose = profileJson.prose as Record<string, unknown> | undefined
    const tone = prose?.overallTone as string | undefined
    if (tone) return `${genre}${tone}流`
    return `${genre}风格`
  }
  return '自定义风格'
}

function determineRiskLevel(sourceType: string, authorLabel: string | null): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (sourceType === 'PUBLIC_DOMAIN' || sourceType === 'USER_UPLOADED') return 'LOW'
  if (sourceType === 'ABSTRACT_TEMPLATE') return 'LOW'
  if (authorLabel) return 'MEDIUM'
  return 'LOW'
}

function buildTags(genre: string | null, profileJson: Record<string, unknown>): string[] {
  const tags: string[] = []
  if (genre) tags.push(genre)

  const prose = profileJson.prose as Record<string, unknown> | undefined
  if (prose?.overallTone) tags.push(prose.overallTone as string)
  if (prose?.sentenceLength) tags.push(prose.sentenceLength as string)

  const plot = profileJson.plot as Record<string, unknown> | undefined
  if (plot?.pacing) tags.push(plot.pacing as string)

  return [...new Set(tags)]
}

function estimateAvgSentenceLength(text: string): number {
  const sentences = text.split(/[。！？.!?]/).filter(s => s.trim().length > 0)
  if (sentences.length === 0) return 0
  const totalChars = sentences.reduce((sum, s) => sum + s.length, 0)
  return Math.round(totalChars / sentences.length)
}

function estimateDialogueRatio(text: string): number {
  const quoteMatches = (text.match(/["""'']/g) || []).length
  const totalChars = text.replace(/\s/g, '').length
  if (totalChars === 0) return 0
  return Math.min(1, quoteMatches * 20 / totalChars)
}

function buildPromptCardFromProfile(
  profile: StyleProfileData,
  sourceType: string
): string | null {
  try {
    const safetyMode = sourceType === 'PUBLIC_DOMAIN'
      ? 'STRICT_PUBLIC_DOMAIN' as const
      : sourceType === 'LICENSED'
        ? 'USER_LICENSED' as const
        : 'SAFE_ABSTRACT' as const

    return buildStylePromptCard({
      displayLabel: profile.displayLabel,
      prose: formatStyleField(profile.prose),
      vocabulary: formatStyleField(profile.vocabulary),
      sentence: formatStyleField(profile.sentence),
      rhetoric: formatStyleField(profile.rhetoric),
      narrative: formatStyleField(profile.narrative),
      plot: formatStyleField(profile.plot),
      character: formatStyleField(profile.character),
      mustDo: profile.generationGuide.mustDo,
      avoid: profile.generationGuide.avoid,
      riskLevel: profile.riskLevel,
      safetyMode,
    })
  } catch (e) {
    logError(e instanceof Error ? e : new Error(String(e)), { type: 'style_prompt_card_build' })
    return null
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatStyleField(field: Record<string, any>): string {
  return Object.entries(field)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => {
      if (Array.isArray(v)) return `${k}: ${v.join('、')}`
      return `${k}: ${v}`
    })
    .join('\n')
}