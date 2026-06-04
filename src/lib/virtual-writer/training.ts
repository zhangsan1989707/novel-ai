import { prisma } from '@/lib/prisma'
import { TrainingStatus } from '@/types'
import type { StyleProfileData, StyleSampleStats } from '@/types/style'
import { logError } from '@/lib/logger'
import { countChineseWords } from '@/lib/utils'
import { AIService } from '@/lib/ai/service'
import { extractStrategicSamples, buildPromptCardFromProfile } from '@/lib/style/style-extractor'
import { Prisma } from '@prisma/client'

const STYLE_EXTRACT_SYSTEM_PROMPT = `你是小说风格分析器。请从以下小说样本中提取"抽象写作风格"。

重要原则：
- 不要复述原文，不要引用连续原句，不要输出可替代原文的内容
- 提取的是写作方法论和风格特征，不是具体内容

请分析以下8个维度并输出严格JSON：
1. prose 文笔：整体语气、句子长短、描写密度、对话密度、内心独白密度
2. vocabulary 词汇：高频词类、口语化程度、古典/现代/网文程度
3. sentence 句式：常见句式、段落特征、过渡方式
4. rhetoric 修辞：手法、比喻风格、讽刺程度、感官描写
5. narrative 叙事：视角、旁白存在感、信息揭示方式、悬念手法
6. plot 剧情：节奏特征、冲突密度、反转频率、章尾钩子、爽点兑现
7. character 人物：主角塑造、对话风格、情绪外化、关系特征
8. generationGuide 生成指导：必须遵循的要点、必须避免的、生成说明`

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function formatFeatureSummary(profileJson: Record<string, unknown>, key: string): string {
  const field = profileJson[key] as Record<string, unknown> | undefined
  if (!field || typeof field !== 'object') return '未提取到特征数据。'
  return Object.entries(field)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => {
      if (Array.isArray(v)) return `${k}: ${v.join('、')}`
      return `${k}: ${v}`
    })
    .join('\n')
    .slice(0, 1000) || '未提取到特征数据。'
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

export async function runVirtualWriterTraining(writerId: number): Promise<void> {
  try {
    const writer = await prisma.virtualWriter.findUnique({
      where: { id: writerId },
      include: {
        documents: {
          where: { status: 'COMPLETED' },
          orderBy: { createdAt: 'asc' },
          select: { id: true, fileName: true, filePath: true, wordCount: true },
        },
      },
    })

    if (!writer) return

    await prisma.virtualWriter.update({
      where: { id: writerId },
      data: { trainingStatus: TrainingStatus.TRAINING, trainingProgress: 10 },
    })

    // 读取所有文档的实际内容
    const fs = await import('fs/promises')
    const textParts: string[] = []
    for (const doc of writer.documents) {
      try {
        const text = await fs.readFile(doc.filePath, 'utf-8')
        textParts.push(text)
      } catch {
        logError(new Error(`无法读取文档: ${doc.filePath}`), { type: 'training_read', writerId })
      }
    }

    const fullText = textParts.join('\n\n')
    if (!fullText.trim()) {
      throw new Error('文档内容为空，无法训练')
    }

    await prisma.virtualWriter.update({
      where: { id: writerId },
      data: { trainingProgress: 30 },
    })

    // 采样
    const totalWords = countChineseWords(fullText)
    const sampleSize = Math.min(50000, fullText.length)
    const sampleText = totalWords > sampleSize
      ? extractStrategicSamples(fullText, sampleSize, writer.documents.length)
      : fullText

    const sampleStats: StyleSampleStats = {
      totalWords: countChineseWords(sampleText),
      chapterCount: writer.documents.length,
      validParagraphCount: (sampleText.match(/\n\n/g) || []).length + 1,
      dialogueRatio: Math.round(estimateDialogueRatio(sampleText) * 100),
      avgSentenceLength: Math.round(estimateAvgSentenceLength(sampleText)),
      sampleExcerpt: sampleText.slice(0, 500),
    }

    await prisma.virtualWriter.update({
      where: { id: writerId },
      data: { trainingProgress: 40 },
    })

    // 调用 AI 分析风格
    const aiProvider = await AIService.createProvider({})

    let prompt = `${STYLE_EXTRACT_SYSTEM_PROMPT}\n\n`
    prompt += `请分析以下小说样本的写作风格。\n\n`
    prompt += `【基本信息】\n`
    prompt += `- 来源：虚拟作家"${writer.name}"的文档\n`
    prompt += `- 文档数：${writer.documents.length}\n`
    prompt += `- 总字数：${totalWords}\n`
    prompt += `\n【样本文本（${countChineseWords(sampleText)}字）】\n`
    prompt += sampleText.slice(0, 30000)
    prompt += `\n\n【输出要求】\n请严格按照 JSON 格式输出完整的风格画像，包含 prose、vocabulary、sentence、rhetoric、narrative、plot、character、generationGuide 八个字段。`

    const result = await aiProvider.generate(prompt, {
      temperature: 0.6,
      maxTokens: 4000,
    })

    await prisma.virtualWriter.update({
      where: { id: writerId },
      data: { trainingProgress: 70 },
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

    const profileData: StyleProfileData = {
      id: '',
      name: `${writer.name}_文风画像`,
      description: `从虚拟作家"${writer.name}"的文档中提取的文风画像`,
      sourceType: 'USER_UPLOADED',
      riskLevel: 'LOW',
      displayLabel: '自定义风格',
      tags: [],
      isPublic: false,
      prose: profileJson.prose as StyleProfileData['prose'],
      vocabulary: profileJson.vocabulary as StyleProfileData['vocabulary'],
      sentence: profileJson.sentence as StyleProfileData['sentence'],
      rhetoric: profileJson.rhetoric as StyleProfileData['rhetoric'],
      narrative: profileJson.narrative as StyleProfileData['narrative'],
      plot: profileJson.plot as StyleProfileData['plot'],
      character: profileJson.character as StyleProfileData['character'],
      generationGuide: (profileJson.generationGuide || { mustDo: [], avoid: [], sampleInstruction: '' }) as StyleProfileData['generationGuide'],
      promptCard: null,
      sampleStats,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const promptCard = buildPromptCardFromProfile(profileData, 'USER_UPLOADED')

    await prisma.virtualWriter.update({
      where: { id: writerId },
      data: { trainingProgress: 90 },
    })

    // 创建 StyleProfile 记录
    await prisma.styleProfile.create({
      data: {
        name: profileData.name,
        description: profileData.description,
        sourceType: profileData.sourceType,
        riskLevel: profileData.riskLevel,
        displayLabel: profileData.displayLabel,
        profileJson: profileJson as Prisma.InputJsonValue,
        promptCard: promptCard || null,
        sampleStats: sampleStats as unknown as Prisma.InputJsonValue,
        virtualWriterId: writerId,
        creatorId: writer.creatorId,
        tags: profileData.tags,
      },
    })

    // 更新 5 个 feature 字段（向后兼容）
    await prisma.virtualWriter.update({
      where: { id: writerId },
      data: {
        styleFeatures: formatFeatureSummary(profileJson, 'prose'),
        vocabularyFeatures: formatFeatureSummary(profileJson, 'vocabulary'),
        sentenceFeatures: formatFeatureSummary(profileJson, 'sentence'),
        rhetoricFeatures: formatFeatureSummary(profileJson, 'rhetoric'),
        themeFeatures: formatFeatureSummary(profileJson, 'generationGuide'),
        trainingStatus: TrainingStatus.TRAINED,
        trainingProgress: 100,
        trainedAt: new Date(),
      },
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'virtual_writer_training', writerId })
    await prisma.virtualWriter.update({
      where: { id: writerId },
      data: {
        trainingStatus: TrainingStatus.FAILED,
        trainingProgress: 0,
      },
    }).catch(() => {})
  }
}
