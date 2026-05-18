import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { createProviderFromDefaultConfig, buildPlotAnalysisPrompt } from '@/lib/ai'
import { getVolumeChapterRange } from '@/lib/ai/context-manager'
import { prisma } from '@/lib/prisma'
import { AIVendor, AnalysisDimension, AnalysisType } from '@/types'
import { getChapterSummariesInRange, saveChapterSummary } from '@/lib/memory/chapter-summary'
import { logger, logError } from '@/lib/logger'

// ============================================
// 常量配置
// ============================================

// 超过此阈值启用分层分析
const LAYERED_ANALYSIS_THRESHOLD = 10
// 每批处理的章节数
const BATCH_SIZE = 8

// ============================================
// Schema 验证
// ============================================

const vendorEnum = z.enum(['OPENAI', 'ANTHROPIC', 'ALIBABA', 'DEEPSEEK', 'MINIMAX', 'VOLCENGINE', 'ZHIPU'])

const analyzePlotSchema = z.object({
  projectId: z.number().int().positive('请选择有效的小说项目'),
  // 粒度控制: -1=整书, 0=全卷, 1-N=具体卷
  volumeNumber: z.number().int().min(-1).max(100).default(-1),
  // 分析哪些维度 (默认全部)
  dimensions: z.array(z.enum([
    'CHARACTER_RELATION',
    'PLOT_LINE',
    'FORESHADOWING',
    'CHAPTER_STRUCTURE',
    'WORLD_SETTING'
  ])).default([
    'CHARACTER_RELATION',
    'PLOT_LINE',
    'FORESHADOWING',
    'CHAPTER_STRUCTURE',
    'WORLD_SETTING'
  ]),
  // 上下文: 使用前N章作为上下文
  contextChapterCount: z.number().int().min(1).max(10).default(3),
  // AI配置
  vendor: vendorEnum.default('DEEPSEEK'),
  temperature: z.number().min(0).max(2).default(0.7),
})

// ============================================
// 辅助函数
// ============================================

/**
 * 从 markdown 代码块中提取 JSON
 * 支持两种格式：
 * 1. 【维度】...【/维度】标记格式
 * 2. {"维度": {...}, ...} 直接 JSON 格式（AI 常用输出格式）
 */
function extractJsonFromMarkdownBlock(content: string, dimensionLabel: string): Record<string, unknown> {
  // 方式1: 尝试【维度】标记格式
  const startMarker = `【${dimensionLabel}`
  const startIdx = content.indexOf(startMarker)
  if (startIdx !== -1) {
    const markerEndIdx = content.indexOf('】', startIdx)
    if (markerEndIdx !== -1) {
      const nextMarkerIdx = content.indexOf('【', markerEndIdx + 1)
      const endIdx = nextMarkerIdx === -1 ? content.length : nextMarkerIdx
      const dimContent = content.slice(markerEndIdx + 1, endIdx)

      const codeBlockMatch = dimContent.match(/```json\s*([\s\S]*?)```/)
      if (codeBlockMatch && codeBlockMatch[1]) {
        try {
          return JSON.parse(codeBlockMatch[1].trim())
        } catch { /* 继续尝试 fallback */ }
      }

      const firstBrace = dimContent.indexOf('{')
      const lastBrace = dimContent.lastIndexOf('}')
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
          return JSON.parse(dimContent.slice(firstBrace, lastBrace + 1))
        } catch {
          return {}
        }
      }
    }
  }

  // 方式2: 尝试提取整个 JSON 对象，然后查找对应维度
  const jsonBlockMatch = content.match(/```json\s*([\s\S]*?)```/)
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    try {
      const fullJson = JSON.parse(jsonBlockMatch[1].trim())
      const possibleKeys = [
        dimensionLabel,                    // 人物关系
        dimensionLabel.replace(/ /g, ''),  // 人物关系
      ]
      for (const key of possibleKeys) {
        if (fullJson[key]) {
          return fullJson[key] as Record<string, unknown>
        }
      }
    } catch {}
  }

  // 方式3: 直接解析整个内容为 JSON（内容可能以 ```json 开头或直接是 JSON）
  const contentWithoutFence = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  try {
    const fullJson = JSON.parse(contentWithoutFence)
    const possibleKeys = [dimensionLabel, dimensionLabel.replace(/ /g, '')]
    for (const key of possibleKeys) {
      if (fullJson[key]) {
        return fullJson[key] as Record<string, unknown>
      }
    }
  } catch {}

  // 方式4: 直接查找 "维度名": { 模式并提取配对的 JSON 对象
  const dimensionPattern = `"${dimensionLabel}": {`
  const dimensionPatternNoSpace = `"${dimensionLabel}":{`
  let dimStartIdx = content.indexOf(dimensionPattern)

  if (dimStartIdx === -1) {
    dimStartIdx = content.indexOf(dimensionPatternNoSpace)
  }

  if (dimStartIdx !== -1) {
    // 找到 { 的位置
    const braceIdx = content.indexOf('{', dimStartIdx)
    if (braceIdx !== -1) {
      // 从 { 位置开始找配对的 }
      let braceCount = 0
      let inString = false
      let escapeNext = false
      let dataEnd = -1

      for (let i = braceIdx; i < content.length; i++) {
        const char = content[i]

        if (escapeNext) {
          escapeNext = false
          continue
        }
        if (char === '\\') {
          escapeNext = true
          continue
        }
        if (char === '"') {
          inString = !inString
          continue
        }
        if (inString) continue

        if (char === '{') {
          braceCount++
        } else if (char === '}') {
          braceCount--
          if (braceCount === 0) {
            dataEnd = i + 1
            break
          }
        }
      }

      if (dataEnd !== -1) {
        const jsonStr = content.slice(dimStartIdx, dataEnd)
        try {
          const wrappedJson = '{' + jsonStr + '}'
          const result = JSON.parse(wrappedJson)
          if (result[dimensionLabel]) {
            return result[dimensionLabel] as Record<string, unknown>
          }
        } catch {}
      }
    }
  }

  return {}
}

/**
 * 批量生成章节摘要（L1层）
 * @param persistToDb 是否持久化到数据库
 */
async function generateChapterSummariesBatch(
  chapters: { chapterNumber: number; title: string; content: string }[],
  provider: Awaited<ReturnType<typeof createProviderFromDefaultConfig>>,
  batchSize: number = BATCH_SIZE,
  persistToDb: boolean = false,
  projectId?: number
): Promise<{ chapterNumber: number; summary: string; keyEvents: string[] }[]> {
  const summaries: { chapterNumber: number; summary: string; keyEvents: string[] }[] = []

  // 分批处理
  for (let i = 0; i < chapters.length; i += batchSize) {
    const batch = chapters.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(chapters.length / batchSize)

    logger.debug({ type: 'layered_analysis', batchNum, totalBatches, message: '生成摘要批次' })

    const prompt = `请为以下 ${batch.length} 章小说生成简短摘要。

【输出格式】
对每章输出一行：
第X章: [一句话摘要] | [关键事件1]; [关键事件2]; ...

【章节内容】
${batch.map(ch => `第${ch.chapterNumber}章 "${ch.title}":\n${ch.content.slice(0, 3000)}${ch.content.length > 3000 ? '...(省略)' : ''}`).join('\n\n')}

【要求】
- 每章摘要不超过50字
- 提取2-4个关键事件
- 保持章节号与内容对应`

    try {
      const result = await provider.generate(prompt, { temperature: 0.7 })
      // 解析结果
      const lines = result.content.split('\n').filter((line: string) => line.trim())
      for (const line of lines) {
        const match = line.match(/第(\d+)章[：:]\s*(.+)/)
        if (match) {
          const chapterNum = parseInt(match[1])
          const rest = match[2]
          const [summary, eventsStr] = rest.split('|')
          const keyEvents = eventsStr ? eventsStr.split(';').map((e: string) => e.trim()).filter(Boolean) : []
          summaries.push({
            chapterNumber: chapterNum,
            summary: summary.trim(),
            keyEvents,
          })

          // 持久化到数据库
          if (persistToDb && projectId) {
            await saveChapterSummary(projectId, chapterNum, {
              summary: summary.trim(),
              keyEvents,
              emotionalTone: null,
              plantedPlotlines: [],
              resolvedPlotlines: [],
            })
          }
        }
      }
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), { type: 'batch_summary', batchNum, projectId })
    }
  }

  return summaries
}

/**
 * 基于摘要生成分卷分析（L2层）
 */
async function generateLayeredAnalysis(
  projectTitle: string,
  genre: string | undefined,
  summaries: { chapterNumber: number; summary: string; keyEvents: string[] }[],
  recentChapters: { chapterNumber: number; title: string; content: string }[],
  dimensions: AnalysisDimension[],
  provider: Awaited<ReturnType<typeof createProviderFromDefaultConfig>>,
  temperature: number
): Promise<string> {
  // 构建摘要文本
  const summaryText = summaries
    .sort((a, b) => a.chapterNumber - b.chapterNumber)
    .map(s => `第${s.chapterNumber}章: ${s.summary}`)
    .join('\n')

  const keyEventsText = summaries
    .sort((a, b) => a.chapterNumber - b.chapterNumber)
    .map(s => s.keyEvents.length > 0
      ? `第${s.chapterNumber}章关键事件: ${s.keyEvents.join('; ')}`
      : `第${s.chapterNumber}章: 无关键事件记录`)
    .join('\n')

  // 构建提示词
  const dimensionLabels: Record<string, AnalysisDimension> = {
    '人物关系': AnalysisDimension.CHARACTER_RELATION,
    '剧情线': AnalysisDimension.PLOT_LINE,
    '伏笔': AnalysisDimension.FORESHADOWING,
    '章节结构': AnalysisDimension.CHAPTER_STRUCTURE,
    '世界观': AnalysisDimension.WORLD_SETTING,
  }

  const formatTemplates: Record<AnalysisDimension, string> = {
    [AnalysisDimension.CHARACTER_RELATION]: `{
  "characters": [
    { "name": "角色名", "role": "protagonist|antagonist|supporting|minor", "description": "角色描述", "relationships": [{ "target": "相关角色", "type": "关系类型", "description": "关系描述" }] }
  ],
  "summary": "人物关系整体概述"
}`,
    [AnalysisDimension.PLOT_LINE]: `{
  "mainPlot": [{ "title": "主线标题", "keyEvents": ["关键事件"], "emotionalArc": "情感弧线" }],
  "subPlots": [{ "title": "副线标题", "keyEvents": ["关键事件"], "relationship": "与主线关联" }],
  "timeline": [{ "event": "事件", "chapter": 章节号, "significance": "major|minor" }]
}`,
    [AnalysisDimension.FORESHADOWING]: `{
  "items": [{ "setup": "伏笔内容", "description": "描述", "payoff": "回收情况", "chapter": 章节号, "importance": "major|minor", "type": "plot|character" }],
  "unresolved": ["未解伏笔列表"]
}`,
    [AnalysisDimension.CHAPTER_STRUCTURE]: `{
  "chapters": [{ "number": 章节号, "title": "章节名", "function": "setup|development|climax|resolution", "keyEvents": ["事件"], "emotionalBeat": "情感基调" }],
  "arcAnalysis": "整体结构分析",
  "pacingAssessment": "节奏评估"
}`,
    [AnalysisDimension.WORLD_SETTING]: `{
  "settings": [{ "name": "设定名称", "description": "描述", "rules": ["规则1"], "firstAppear": "首次出现章节" }],
  "locations": [{ "name": "地点", "description": "描述", "significance": "major|minor" }]
}`,
  }

  const prompt = `你是一位专业的小说分析师。请对小说《${projectTitle}》进行全面的拆书分析。

【基础信息】
类型: ${genre || '未知'}

【章节摘要汇总】
${summaryText}

【关键事件汇总】
${keyEventsText}

【最近章节完整内容】（用于补充细节）
${recentChapters.map(ch => `第${ch.chapterNumber}章 "${ch.title}":\n${ch.content.slice(0, 2000)}`).join('\n\n')}

【分析维度要求】
请对以下 ${dimensions.length} 个维度进行深入分析：

${dimensions.map(dim => {
    const label = Object.keys(dimensionLabels).find(k => dimensionLabels[k] === dim) || dim
    return `### 【${label}】\n\`\`\`json\n${formatTemplates[dim]}\n\`\`\``
  }).join('\n\n')}

【重要说明】
1. 章节号必须与【章节摘要汇总】中的编号完全对应
2. 人物关系分析需要覆盖所有主要角色及其关系
3. 剧情线需要区分主线和副线
4. 伏笔需要标注首次出现章节和预计回收章节
5. 章节结构需要分析每章的功能定位（开篇/发展/高潮/结尾）

请严格按照 JSON 格式输出分析结果。`

  const result = await provider.generate(prompt, { temperature })
  return result.content
}

// ============================================
// API Handler
// ============================================

/**
 * POST /api/novel/ai/analyze-plot
 * AI 拆书分析（支持分层分析）
 */
export async function POST(request: NextRequest) {
  let projectId: number | null = null
  try {
    const body = await request.json()
    const parsed = analyzePlotSchema.parse(body)
    projectId = parsed.projectId
    const {
      volumeNumber,
      dimensions,
      contextChapterCount,
      vendor,
      temperature,
    } = parsed

    // 获取项目信息
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
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
        { status: 404 }
      )
    }

    // 确定分析范围
    let chaptersToAnalyze = project.chapters
    if (volumeNumber === -1) {
      chaptersToAnalyze = project.chapters
    } else if (volumeNumber === 0) {
      chaptersToAnalyze = project.chapters
    } else {
      const totalChapters = project.chapters.length || 100
      const range = getVolumeChapterRange(volumeNumber, project.totalVolumes, totalChapters)
      chaptersToAnalyze = project.chapters.filter(
        ch => ch.chapterNumber >= range.start && ch.chapterNumber <= range.end
      )
    }

    if (chaptersToAnalyze.length === 0 && !project.sourceNovel?.originalText) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_CONTENT', message: '没有可分析的章节内容' } },
        { status: 400 }
      )
    }

    // 构建章节列表
    let chapters: { chapterNumber: number; title: string; content: string }[]
    if (chaptersToAnalyze.length > 0) {
      chapters = chaptersToAnalyze.map(ch => ({
        chapterNumber: ch.chapterNumber,
        title: ch.title,
        content: ch.content || '',
      }))
    } else if (project.sourceNovel?.originalText) {
      // 无章节但有原始小说文本，按固定字数分段
      const text = project.sourceNovel.originalText
      const segmentSize = 5000
      const segments: { chapterNumber: number; title: string; content: string }[] = []
      for (let i = 0; i < text.length; i += segmentSize) {
        const segmentNum = Math.floor(i / segmentSize) + 1
        segments.push({
          chapterNumber: segmentNum,
          title: `第${segmentNum}段`,
          content: text.slice(i, i + segmentSize),
        })
      }
      chapters = segments
    } else {
      return NextResponse.json(
        { success: false, error: { code: 'NO_CONTENT', message: '没有可分析的内容' } },
        { status: 400 }
      )
    }

    // 获取 AI Provider - 优先使用数据库默认配置
    const provider = await createProviderFromDefaultConfig()

    // 决定使用哪种分析模式
    const useLayeredAnalysis = chapters.length > LAYERED_ANALYSIS_THRESHOLD

    let resultContent: string

    if (useLayeredAnalysis) {
      logger.info({ type: 'layered_analysis', chapterCount: chapters.length, threshold: LAYERED_ANALYSIS_THRESHOLD, message: '启用分层分析' })

      // L1: 优先从数据库读取已生成的摘要
      const minChapter = Math.min(...chapters.map(c => c.chapterNumber))
      const maxChapter = Math.max(...chapters.map(c => c.chapterNumber))
      const existingSummaries = await getChapterSummariesInRange(projectId, minChapter, maxChapter)
      const existingChapterNos = new Set(existingSummaries.map(s => s.chapterNo))

      // 找出没有摘要的章节
      const chaptersNeedingSummary = chapters.filter(
        ch => !existingChapterNos.has(ch.chapterNumber)
      )

      let summaries = existingSummaries.map(s => ({
        chapterNumber: s.chapterNo,
        summary: s.summary,
        keyEvents: [] as string[],
      }))

      // 如果有没有摘要的章节，批量生成并持久化
      if (chaptersNeedingSummary.length > 0) {
        logger.info({ type: 'layered_analysis', missingChapterCount: chaptersNeedingSummary.length, message: '开始生成缺失摘要' })
        const newSummaries = await generateChapterSummariesBatch(
          chaptersNeedingSummary,
          provider,
          BATCH_SIZE,
          true, // 持久化到数据库
          projectId
        )
        summaries = [...summaries, ...newSummaries]
      }

      // 获取最近几章的完整内容用于补充细节
      const recentChapters = chapters.slice(-contextChapterCount)

      // L2: 基于摘要生成分层分析
      resultContent = await generateLayeredAnalysis(
        project.title,
        project.genre || undefined,
        summaries,
        recentChapters,
        dimensions as AnalysisDimension[],
        provider,
        temperature
      )
    } else {
      // 直接分析（章节数较少时）
      const prompt = buildPlotAnalysisPrompt(
        {
          projectTitle: project.title,
          genre: project.genre || undefined,
          worldSetting: project.worldSetting || undefined,
          powerSystem: project.powerSystem || undefined,
          protagonistProfile: project.protagonistProfile || undefined,
          antagonistSetting: project.antagonistSetting || undefined,
          previousChapters: chapters,
        },
        {
          dimensions: dimensions as AnalysisDimension[],
          volumeNumber,
          contextChapterCount,
          isFullBookAnalysis: volumeNumber === -1,
        }
      )

      const result = await provider.generate(prompt, { temperature })
      resultContent = result.content
    }

    // 解析结果并存储
    const results: {
      dimension: AnalysisDimension
      analysisData: Record<string, unknown>
      rawContent: string
    }[] = []

    const dimensionLabels: Record<string, AnalysisDimension> = {
      '人物关系': AnalysisDimension.CHARACTER_RELATION,
      '剧情线': AnalysisDimension.PLOT_LINE,
      '伏笔': AnalysisDimension.FORESHADOWING,
      '章节结构': AnalysisDimension.CHAPTER_STRUCTURE,
      '世界观': AnalysisDimension.WORLD_SETTING,
    }

    for (const dim of dimensions) {
      const dimLabel = Object.keys(dimensionLabels).find(k => dimensionLabels[k] === dim) || dim
      const analysisData = extractJsonFromMarkdownBlock(resultContent, dimLabel)

      await prisma.bookAnalysis.upsert({
        where: {
          projectId_volumeNumber_analysisType_dimension: {
            projectId,
            volumeNumber,
            analysisType: AnalysisType.BREAKDOWN,
            dimension: dim,
          },
        },
        update: {
          analysisData: analysisData as Prisma.InputJsonValue,
          rawContent: resultContent,
          wordCount: resultContent.length,
        },
        create: {
          projectId,
          volumeNumber,
          analysisType: AnalysisType.BREAKDOWN,
          dimension: dim,
          analysisData: analysisData as Prisma.InputJsonValue,
          rawContent: resultContent,
          wordCount: resultContent.length,
        },
      })

      results.push({
        dimension: dim as AnalysisDimension,
        analysisData,
        rawContent: resultContent,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        analysisId: results[0]?.dimension || 'unknown',
        results,
        layeredAnalysis: useLayeredAnalysis,
      },
    })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'issues' in error) {
      const err = error as { issues: { message: string }[] }
      if (Array.isArray(error.issues) && error.issues.length > 0) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0].message } },
          { status: 400 }
        )
      }
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'analyze_plot', projectId })
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json(
      { success: false, error: { code: 'ANALYZE_ERROR', message: '拆书分析失败: ' + errorMessage } },
      { status: 500 }
    )
  }
}
