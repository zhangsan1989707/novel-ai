import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { analysisTaskManager, AnalysisTaskRecord } from '@/lib/engine/analysis-task-manager'
import { AnalysisDimension, AnalysisType } from '@/types'
import { logError } from '@/lib/logger'
import { Prisma } from '@prisma/client'
import { getChapterSummariesInRange, saveChapterSummary } from '@/lib/memory/chapter-summary'
import { countChineseWords } from '@/lib/utils'
import { buildFallbackAnalysisData, isRefusalContent } from '@/lib/analysis/book-analysis-fallback'
import {
  ANALYSIS_DIMENSION_LABELS,
  ANALYSIS_FORMAT_TEMPLATES,
  DEFAULT_ANALYSIS_DIMENSIONS,
  DEFAULT_CONTEXT_CHAPTER_COUNT,
} from '@/lib/analysis/config'

const createTaskSchema = z.object({
  volumeNumber: z.number().int().min(-1).max(100).default(-1),
  dimensions: z.array(z.nativeEnum(AnalysisDimension)).min(1, '至少选择一个分析维度').default(DEFAULT_ANALYSIS_DIMENSIONS),
  contextChapterCount: z.number().int().min(1).max(10).default(DEFAULT_CONTEXT_CHAPTER_COUNT),
})

/**
 * POST /api/novel/projects/[projectId]/analysis-task
 * 创建并启动拆书分析任务（异步）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  let projectIdNum: number | null = null
  try {
    const { projectId } = await params
    projectIdNum = parseInt(projectId, 10)

    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    const body = await request.json()
    const parsed = createTaskSchema.parse(body)

    // 检查是否有活跃的正在执行的任务
    const existingActive = await analysisTaskManager.getActiveTask(projectIdNum)
    if (existingActive && existingActive.status === 'RUNNING') {
      return NextResponse.json({
        success: true,
        data: {
          task: existingActive,
          message: '已有正在执行的任务',
        },
      })
    }

    // 创建新任务
    const task = await analysisTaskManager.createTask({
      projectId: projectIdNum,
      volumeNumber: parsed.volumeNumber,
      dimensions: parsed.dimensions,
      contextChapterCount: parsed.contextChapterCount,
    })

    // 启动异步执行
    void executeAnalysisAsync(task.id, projectIdNum, {
      volumeNumber: parsed.volumeNumber,
      dimensions: parsed.dimensions,
      contextChapterCount: parsed.contextChapterCount,
    })

    return NextResponse.json({
      success: true,
      data: { task },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message || '验证失败' } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'create_analysis_task', projectId: projectIdNum })
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '创建任务失败' } },
      { status: 500 }
    )
  }
}

/**
 * GET /api/novel/projects/[projectId]/analysis-task
 * 获取项目最新的任务状态
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  let projectIdNum: number | null = null
  try {
    const { projectId } = await params
    projectIdNum = parseInt(projectId, 10)

    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const latest = searchParams.get('latest')

    let task: AnalysisTaskRecord | null
    if (latest === 'true') {
      task = await analysisTaskManager.getLatestTask(projectIdNum)
    } else {
      task = await analysisTaskManager.getActiveTask(projectIdNum)
    }

    return NextResponse.json({
      success: true,
      data: task,
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'get_analysis_task', projectId: projectIdNum })
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '获取任务状态失败' } },
      { status: 500 }
    )
  }
}

/**
 * 异步执行拆书分析
 */
async function executeAnalysisAsync(
  taskId: string,
  projectId: number,
  options: {
    volumeNumber: number
    dimensions: AnalysisDimension[]
    contextChapterCount: number
  }
): Promise<void> {
  try {
    await analysisTaskManager.startTask(taskId)

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
      await analysisTaskManager.failTask(taskId, '项目不存在')
      return
    }

    // 导入分析逻辑
    const { createProviderFromDefaultConfig, buildPlotAnalysisPrompt } = await import('@/lib/ai')
    const { getVolumeChapterRange } = await import('@/lib/ai/context-manager')
    const { buildChapterMemoryPack } = await import('@/lib/memory')

    const provider = await createProviderFromDefaultConfig()

    // 确定分析范围
    let chaptersToAnalyze = project.chapters
    if (options.volumeNumber === -1) {
      chaptersToAnalyze = project.chapters
    } else if (options.volumeNumber === 0) {
      chaptersToAnalyze = project.chapters
    } else {
      const totalChapters = project.chapters.length || 100
      const range = getVolumeChapterRange(options.volumeNumber, project.totalVolumes, totalChapters)
      chaptersToAnalyze = project.chapters.filter(
        ch => ch.chapterNumber >= range.start && ch.chapterNumber <= range.end
      )
    }

    if (chaptersToAnalyze.length === 0 && !project.sourceNovel?.originalText) {
      await analysisTaskManager.failTask(taskId, '没有可分析的章节内容')
      return
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
      await analysisTaskManager.failTask(taskId, '没有可分析的内容')
      return
    }

    // 生成摘要层
    await analysisTaskManager.updateProgress(taskId, 10, '正在生成章节摘要...')

    const LAYERED_ANALYSIS_THRESHOLD = 10
    const BATCH_SIZE = 8

    const targetChapterNo = chaptersToAnalyze.length > 0
      ? chaptersToAnalyze[chaptersToAnalyze.length - 1].chapterNumber
      : (project.chapters[project.chapters.length - 1]?.chapterNumber || 1)

    const memoryPack = await buildChapterMemoryPack(projectId, targetChapterNo, {
      recentChapterCount: Math.max(3, options.contextChapterCount),
      recentVolumeCount: 3,
      characterLimit: 10,
      plotlineLimit: 10,
      researchLimit: 3,
    })

    let summaries: { chapterNumber: number; summary: string; keyEvents: string[] }[] = []
    const useLayered = chapters.length > LAYERED_ANALYSIS_THRESHOLD

    if (useLayered) {
      const minChapter = Math.min(...chapters.map(c => c.chapterNumber))
      const maxChapter = Math.max(...chapters.map(c => c.chapterNumber))
      const existingSummaries = await getChapterSummariesInRange(projectId, minChapter, maxChapter)
      const existingChapterNos = new Set(existingSummaries.map(s => s.chapterNo))

      const chaptersNeedingSummary = chapters.filter(ch => !existingChapterNos.has(ch.chapterNumber))

      summaries = existingSummaries.map(s => ({
        chapterNumber: s.chapterNo,
        summary: s.summary,
        keyEvents: [] as string[],
      }))

      if (chaptersNeedingSummary.length > 0) {
        const newSummaries = await generateChapterSummariesBatch(
          chaptersNeedingSummary,
          provider,
          BATCH_SIZE,
          true,
          projectId
        )
        summaries = [...summaries, ...newSummaries]
      }
    }

    // 逐维度分析
    let resultContent: string

    if (useLayered) {
      // 分层分析
      const recentChapters = chapters.slice(-options.contextChapterCount)
      resultContent = await generateLayeredAnalysisContent(
        project.title,
        project.genre || undefined,
        summaries,
        recentChapters,
        options.dimensions,
        provider,
        0.7,
        memoryPack.summarizerContext
      )
    } else {
      // 直接分析
      const prompt = buildPlotAnalysisPrompt(
        {
          projectTitle: project.title,
          genre: project.genre || undefined,
          worldSetting: project.worldSetting || undefined,
          powerSystem: project.powerSystem || undefined,
          protagonistProfile: project.protagonistProfile || undefined,
          antagonistSetting: project.antagonistSetting || undefined,
          previousChapters: chapters,
          memoryContext: memoryPack.summarizerContext,
        },
        {
          dimensions: options.dimensions,
          volumeNumber: options.volumeNumber,
          contextChapterCount: options.contextChapterCount,
          isFullBookAnalysis: options.volumeNumber === -1,
        }
      )

      const result = await provider.generate(prompt, { temperature: 0.7 })
      resultContent = result.content
    }

    // 解析结果并存储
    for (let i = 0; i < options.dimensions.length; i++) {
      const dim = options.dimensions[i]
      const dimLabel = ANALYSIS_DIMENSION_LABELS[dim] || dim

      await analysisTaskManager.updateProgress(
        taskId,
        Math.round(((i + 1) / (options.dimensions.length + 1)) * 100),
        `正在写入分析结果: ${dimLabel} (${i + 1}/${options.dimensions.length})`,
        {
          completedDimensions: i + 1,
          currentDimension: dimLabel,
        }
      )

      const extractedData = extractJsonFromMarkdownBlock(resultContent, dimLabel)
      const analysisData = Object.keys(extractedData).length > 0 && !isRefusalContent(resultContent)
        ? extractedData
        : buildFallbackAnalysisData({
            title: project.title,
            genre: project.genre || null,
            outline: project.outline || null,
            outlineStages: project.outlineStages || undefined,
            worldSetting: project.worldSetting || null,
            powerSystem: project.powerSystem || null,
            protagonistProfile: project.protagonistProfile || null,
            protagonistGoal: project.protagonistGoal || null,
            antagonistSetting: project.antagonistSetting || null,
            endingPlan: project.endingPlan || null,
            writingPrompt: project.writingPrompt || null,
            chapters: project.chapters.map(ch => ({
              chapterNumber: ch.chapterNumber,
              title: ch.title,
              summary: ch.summary || null,
            })),
          }, dim)

      await prisma.bookAnalysis.upsert({
        where: {
          projectId_volumeNumber_analysisType_dimension: {
            projectId,
            volumeNumber: options.volumeNumber,
            analysisType: AnalysisType.BREAKDOWN,
            dimension: dim,
          },
        },
        update: {
          analysisData: analysisData as Prisma.InputJsonValue,
          rawContent: resultContent,
          wordCount: countChineseWords(resultContent),
        },
        create: {
          projectId,
          volumeNumber: options.volumeNumber,
          analysisType: AnalysisType.BREAKDOWN,
          dimension: dim,
          analysisData: analysisData as Prisma.InputJsonValue,
          rawContent: resultContent,
          wordCount: countChineseWords(resultContent),
        },
      })
    }

    await analysisTaskManager.completeTask(taskId)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    if (error instanceof Error && error.name === 'AbortError') {
      await analysisTaskManager.failTask(taskId, '分析已取消')
    } else {
      await analysisTaskManager.failTask(taskId, errorMessage)
    }
  }
}

// ============================================
// 辅助函数（从原有 analyze-plot route 中提取）
// ============================================

async function generateChapterSummariesBatch(
  chapters: { chapterNumber: number; title: string; content: string }[],
  provider: Awaited<ReturnType<typeof import('@/lib/ai').createProviderFromDefaultConfig>>,
  batchSize: number,
  persistToDb: boolean,
  projectId?: number
): Promise<{ chapterNumber: number; summary: string; keyEvents: string[] }[]> {
  const summaries: { chapterNumber: number; summary: string; keyEvents: string[] }[] = []

  for (let i = 0; i < chapters.length; i += batchSize) {
    const batch = chapters.slice(i, i + batchSize)

    const prompt = `请为以下 ${batch.length} 章小说生成简短摘要。

【输出格式】
对每章输出一行：
第X章: [一句话摘要] | [情绪基调] | [关键事件1]; [关键事件2]; ...

【章节内容】
${batch.map(ch => `第${ch.chapterNumber}章 "${ch.title}":\n${ch.content.slice(0, 3000)}${ch.content.length > 3000 ? '...(省略)' : ''}`).join('\n\n')}

【要求】
- 每章摘要不超过50字
- 情绪基调从 紧张/温馨/悲伤/高潮/平缓/压抑/轻松 中选择最贴切的一项
- 提取2-4个关键事件
- 保持章节号与内容对应`

    try {
      const result = await provider.generate(prompt, { temperature: 0.7 })
      const lines = result.content.split('\n').filter((line: string) => line.trim())
      for (const line of lines) {
        const match = line.match(/第(\d+)章[：:]\s*(.+)/)
        if (match) {
          const chapterNum = parseInt(match[1])
          const rest = match[2]
          const [summary, emotionalTone, eventsStr] = rest.split('|').map(part => part?.trim() || '')
          const keyEvents = eventsStr ? eventsStr.split(';').map((e: string) => e.trim()).filter(Boolean) : []
          summaries.push({ chapterNumber: chapterNum, summary: summary.trim(), keyEvents })

          if (persistToDb && projectId) {
            await saveChapterSummary(projectId, chapterNum, {
              summary: summary.trim(),
              keyEvents,
              emotionalTone: emotionalTone || null,
              plantedPlotlines: [],
              resolvedPlotlines: [],
            })
          }
        }
      }
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), { type: 'batch_summary' })
    }
  }

  return summaries
}

async function generateLayeredAnalysisContent(
  projectTitle: string,
  genre: string | undefined,
  summaries: { chapterNumber: number; summary: string; keyEvents: string[] }[],
  recentChapters: { chapterNumber: number; title: string; content: string }[],
  dimensions: AnalysisDimension[],
  provider: Awaited<ReturnType<typeof import('@/lib/ai').createProviderFromDefaultConfig>>,
  temperature: number,
  memoryContext?: string
): Promise<string> {
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

  const prompt = `你是一位专业的小说分析师。请对小说《${projectTitle}》进行全面的拆书分析。

【基础信息】
类型: ${genre || '未知'}

${memoryContext ? `【记忆编排上下文】\n${memoryContext}\n` : ''}

【章节摘要汇总】
${summaryText}

【关键事件汇总】
${keyEventsText}

【最近章节完整内容】（用于补充细节）
${recentChapters.map(ch => `第${ch.chapterNumber}章 "${ch.title}":\n${ch.content.slice(0, 2000)}`).join('\n\n')}

【分析维度要求】
请对以下 ${dimensions.length} 个维度进行深入分析：

${dimensions.map(dim => {
    const label = ANALYSIS_DIMENSION_LABELS[dim] || dim
    return `### 【${label}】\n\`\`\`json\n${ANALYSIS_FORMAT_TEMPLATES[dim]}\n\`\`\``
  }).join('\n\n')}

【重要说明】
1. 章节号必须与【章节摘要汇总】中的编号完全对应
2. 人物关系分析需要覆盖所有主要角色及其关系
3. 剧情线需要区分主线和副线
4. 伏笔需要标注首次出现章节和预计回收章节
5. 章节结构需要分析每章的功能定位（开篇/发展/高潮/结尾）
6. 故事总览需要输出阶段大纲骨架和卖点判断
7. 阅读体验需要指出高点章节、疲劳章节和章尾留钩强弱
8. 角色成长需要交代主角弧线、配角功能和反派压迫感

请严格按照 JSON 格式输出分析结果。`

  const result = await provider.generate(prompt, { temperature })
  return result.content
}

function extractJsonFromMarkdownBlock(content: string, dimensionLabel: string): Record<string, unknown> {
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
        } catch { /* continue */ }
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

  const jsonBlockMatch = content.match(/```json\s*([\s\S]*?)```/)
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    try {
      const fullJson = JSON.parse(jsonBlockMatch[1].trim())
      const possibleKeys = [dimensionLabel, dimensionLabel.replace(/ /g, '')]
      for (const key of possibleKeys) {
        if (fullJson[key]) {
          return fullJson[key] as Record<string, unknown>
        }
      }
    } catch {}
  }

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

  const dimensionPattern = `"${dimensionLabel}": {`
  const dimensionPatternNoSpace = `"${dimensionLabel}":{`
  let dimStartIdx = content.indexOf(dimensionPattern)

  if (dimStartIdx === -1) {
    dimStartIdx = content.indexOf(dimensionPatternNoSpace)
  }

  if (dimStartIdx !== -1) {
    const braceIdx = content.indexOf('{', dimStartIdx)
    if (braceIdx !== -1) {
      let braceCount = 0
      let inString = false
      let escapeNext = false
      let dataEnd = -1

      for (let i = braceIdx; i < content.length; i++) {
        const char = content[i]
        if (escapeNext) { escapeNext = false; continue }
        if (char === '\\') { escapeNext = true; continue }
        if (char === '"') { inString = !inString; continue }
        if (inString) continue

        if (char === '{') braceCount++
        else if (char === '}') {
          braceCount--
          if (braceCount === 0) { dataEnd = i + 1; break }
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
