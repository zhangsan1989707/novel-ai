/**
 * 文风分析器
 * 分析原著风格画像，检测续写时的文风偏差
 */
import { prisma } from '@/lib/prisma'
import { createProviderFromEnv } from '@/lib/ai'
import { AIVendor } from '@/types'

export interface StyleProfile {
  vocabularyFeatures: {
    highFreqWords: string[]        // 高频词
    uniqueExpressions: string[]    // 独特表达
    avgWordLength: number           // 平均用词长度
  }
  sentenceFeatures: {
    avgSentenceLength: number       // 平均句长
    shortSentenceRatio: number      // 短句比例
    dialogueRatio: number           // 对话比例
    descriptionDensity: number      // 描写密度（形容词/副词比例）
  }
  toneFeatures: {
    overall: string                // 整体基调
    emotionalKeywords: string[]    // 情绪关键词
  }
  structureFeatures: {
    paragraphAvgLength: number      // 段落平均长度
    chapterEndingStyle: string      // 章节结尾风格
  }
}

export interface StyleConsistencyResult {
  overall: number                   // 0-100 一致性总分
  vocabulary: number                // 词汇一致性
  sentence: number                  // 句式一致性
  tone: number                      // 基调一致性
  deviations: {
    location: string               // 位置（如"第5章 结尾"）
    type: 'vocabulary' | 'sentence' | 'tone'
    description: string             // 偏差描述
    severity: 'high' | 'medium' | 'low'
  }[]
  suggestions: string[]            // 改进建议
}

/**
 * 分析原文风格
 */
export async function analyzeOriginalStyle(
  projectId: number,
  vendor: AIVendor = AIVendor.DEEPSEEK
): Promise<{ success: boolean; styleProfile?: StyleProfile; error?: string }> {
  try {
    // 获取已完成章节的内容
    const chapters = await prisma.novelChapter.findMany({
      where: { projectId, status: 'COMPLETED', content: { not: null } },
      select: { content: true, chapterNumber: true },
      orderBy: { chapterNumber: 'asc' },
      take: 10, // 分析最近 10 章
    })

    if (chapters.length === 0 || !chapters[0].content) {
      return { success: false, error: '没有足够的原文内容进行分析' }
    }

    // 合并章节内容
    const combinedContent = chapters.map(c => c.content).join('\n\n')

    // 使用 AI 分析风格
    const provider = createProviderFromEnv(vendor)

    const prompt = `请分析以下小说文本的写作风格特征：

【文本内容】
${combinedContent.slice(0, 8000)}

【分析要求】
请分析以下维度并以 JSON 格式输出：

{
  "vocabularyFeatures": {
    "highFreqWords": ["词1", "词2", ...],  // 高频词（10-20个）
    "uniqueExpressions": ["表达1", "表达2", ...],  // 独特表达（5-10个）
    "avgWordLength": 2.5  // 平均用词长度（汉字/词）
  },
  "sentenceFeatures": {
    "avgSentenceLength": 25,  // 平均句子长度（字符数）
    "shortSentenceRatio": 0.3,  // 短句（少于10字）比例
    "dialogueRatio": 0.4,  // 对话比例
    "descriptionDensity": 0.15  // 描写密度
  },
  "toneFeatures": {
    "overall": "整体基调描述",
    "emotionalKeywords": ["关键词1", "关键词2", ...]  // 情绪关键词
  },
  "structureFeatures": {
    "paragraphAvgLength": 100,  // 段落平均长度（字符数）
    "chapterEndingStyle": "章节结尾风格描述"
  }
}`

    const result = await provider.generate(prompt, { temperature: 0.3 })

    // 解析结果
    let styleProfile: StyleProfile | undefined
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        styleProfile = JSON.parse(jsonMatch[0])
      }
    } catch {
      // 解析失败
    }

    if (!styleProfile) {
      return { success: false, error: '无法解析风格分析结果' }
    }

    return { success: true, styleProfile }
  } catch (error) {
    const message = error instanceof Error ? error.message : '分析失败'
    return { success: false, error: message }
  }
}

/**
 * 检查文风一致性
 */
export async function checkStyleConsistency(
  projectId: number,
  newContent: string,
  vendor: AIVendor = AIVendor.DEEPSEEK
): Promise<{ success: boolean; result?: StyleConsistencyResult; error?: string }> {
  try {
    // 获取原文风格（这里应该从缓存或数据库获取，这里简化处理）
    // 实际应该从项目设置或专门的风格配置中获取
    const project = await prisma.novelProject.findUnique({
      where: { id: projectId },
      select: { writingStyle: true },
    })

    // 获取已完成章节的内容作为参考
    const referenceChapters = await prisma.novelChapter.findMany({
      where: { projectId, status: 'COMPLETED', content: { not: null } },
      select: { content: true },
      orderBy: { chapterNumber: 'desc' },
      take: 3,
    })

    if (referenceChapters.length === 0 || !referenceChapters[0].content) {
      return { success: false, error: '没有参考原文' }
    }

    const referenceContent = referenceChapters.map(c => c.content).join('\n\n')

    // 使用 AI 检查一致性
    const provider = createProviderFromEnv(vendor)

    const prompt = `请对比分析两段文本的风格一致性：

【参考原文】
${referenceContent.slice(0, 4000)}

【待检测文本】
${newContent.slice(0, 4000)}

【检测要求】
请分析待检测文本与参考原文的风格一致性，并输出：

{
  "overall": 75,  // 整体一致性 0-100
  "vocabulary": 80,  // 词汇一致性 0-100
  "sentence": 70,  // 句式一致性 0-100
  "tone": 75,  // 基调一致性 0-100
  "deviations": [
    {
      "location": "第3段",
      "type": "vocabulary",  // vocabulary | sentence | tone
      "description": "使用了参考文中未出现的新词汇",
      "severity": "medium"  // high | medium | low
    }
  ],
  "suggestions": [
    "建议使用更符合原著的描写方式",
    "注意控制句子长度"
  ]
}`

    const result = await provider.generate(prompt, { temperature: 0.3 })

    // 解析结果
    let consistencyResult: StyleConsistencyResult | undefined
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        consistencyResult = JSON.parse(jsonMatch[0])
      }
    } catch {
      // 解析失败
    }

    if (!consistencyResult) {
      return { success: false, error: '无法解析一致性检测结果' }
    }

    return { success: true, result: consistencyResult }
  } catch (error) {
    const message = error instanceof Error ? error.message : '检测失败'
    return { success: false, error: message }
  }
}