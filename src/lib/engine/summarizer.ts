/**
 * 分层摘要生成引擎
 * 解决 760 章大文本 token 超限问题
 *
 * 数据流: 章节完成 → L1 章节摘要 → 卷内全完成 → L2 卷摘要 → 全卷完成 → L3 全书摘要
 */
import { prisma } from '@/lib/prisma'
import { createProviderFromEnv } from '@/lib/ai'
import { getVolumeSummary, saveVolumeSummary, buildVolumeSummaryFromChapterSummaries, calculateVolume } from '@/lib/memory/volume-summary'
import { getBookSummary, saveBookSummary, buildBookSummaryFromVolumeSummaries } from '@/lib/memory/book-summary'
import { AIVendor } from '@/types'
import { getChapterSummariesInRange } from '@/lib/memory/chapter-summary'

export interface HierarchicalSummaryResult {
  level: 'chapter' | 'volume' | 'book'
  success: boolean
  summary?: string
  error?: string
}

/**
 * 检查指定卷的所有章节是否都完成了摘要
 */
async function isVolumeReadyForSummary(
  projectId: number,
  volumeNumber: number,
  totalVolumes: number,
  totalChapters: number
): Promise<boolean> {
  const chaptersPerVolume = Math.ceil(totalChapters / totalVolumes)
  const startChapter = (volumeNumber - 1) * chaptersPerVolume + 1
  const endChapter = Math.min(volumeNumber * chaptersPerVolume, totalChapters)

  const summaries = await prisma.chapterSummary.findMany({
    where: {
      projectId,
      chapterNo: { gte: startChapter, lte: endChapter },
    },
  })

  return summaries.length >= (endChapter - startChapter + 1) * 0.8 // 80% 章节完成即可
}

/**
 * 生成卷摘要 (L2)
 */
export async function generateVolumeSummary(
  projectId: number,
  volumeNumber: number,
  vendor: AIVendor = AIVendor.DEEPSEEK
): Promise<HierarchicalSummaryResult> {
  try {
    // 获取项目信息
    const project = await prisma.novelProject.findUnique({
      where: { id: projectId },
      select: { totalVolumes: true, title: true, genre: true },
    })

    if (!project) {
      return { level: 'volume', success: false, error: '项目不存在' }
    }

    const totalChapters = await prisma.novelChapter.count({
      where: { projectId, status: 'COMPLETED' },
    })

    if (totalChapters === 0) {
      return { level: 'volume', success: false, error: '没有已完成的章节' }
    }

    // 构建卷摘要基础数据
    const volumeData = await buildVolumeSummaryFromChapterSummaries(
      projectId,
      volumeNumber,
      project.totalVolumes,
      totalChapters
    )

    // 获取该卷所有章节摘要文本
    const chaptersPerVolume = Math.ceil(totalChapters / project.totalVolumes)
    const startChapter = (volumeNumber - 1) * chaptersPerVolume + 1
    const endChapter = Math.min(volumeNumber * chaptersPerVolume, totalChapters)

    const summaries = await getChapterSummariesInRange(projectId, startChapter, endChapter)

    // 构建 AI 提示词
    const provider = createProviderFromEnv(vendor)

    const prompt = `请为小说《${project.title}》第${volumeNumber}卷生成卷摘要。

【卷信息】
- 总卷数: ${project.totalVolumes}
- 本卷章节范围: 第${startChapter}-${endChapter}章

【章节摘要汇总】
${summaries.map(s => `第${s.chapterNo}章: ${s.summary}`).join('\n')}

【本卷关键事件】
${volumeData.keyEvents.join('\n') || '暂无记录'}

【输出要求】
请生成一段 500-800 字的卷摘要，包含：
1. 本卷核心剧情概述
2. 主要冲突和发展
3. 重要角色在本卷的表现

以 JSON 格式输出：
{
  "summary": "卷摘要内容（500-800字）"
}`

    const result = await provider.generate(prompt, { temperature: 0.7 })

    // 解析结果
    let summaryText = result.content
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        summaryText = parsed.summary || result.content
      }
    } catch {
      // 使用原始内容
    }

    // 保存卷摘要
    volumeData.summary = summaryText
    await saveVolumeSummary(projectId, volumeData)

    return { level: 'volume', success: true, summary: summaryText }
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成失败'
    return { level: 'volume', success: false, error: message }
  }
}

/**
 * 生成全书摘要 (L3)
 */
export async function generateBookSummary(
  projectId: number,
  vendor: AIVendor = AIVendor.DEEPSEEK
): Promise<HierarchicalSummaryResult> {
  try {
    // 获取项目信息
    const project = await prisma.novelProject.findUnique({
      where: { id: projectId },
      select: { totalVolumes: true, title: true, genre: true, targetWordCount: true },
    })

    if (!project) {
      return { level: 'book', success: false, error: '项目不存在' }
    }

    // 获取所有卷摘要
    const volumeSummaries = await prisma.volumeSummary.findMany({
      where: { projectId },
      orderBy: { volumeNumber: 'asc' },
    })

    if (volumeSummaries.length === 0) {
      return { level: 'book', success: false, error: '请先生成卷摘要' }
    }

    // 构建全书摘要基础数据
    const bookData = await buildBookSummaryFromVolumeSummaries(projectId, project.totalVolumes)

    // 构建 AI 提示词
    const provider = createProviderFromEnv(vendor)

    const prompt = `请为小说《${project.title}》生成全书摘要。

【小说信息】
- 类型: ${project.genre || '未知'}
- 目标字数: ${project.targetWordCount || '未知'}
- 总卷数: ${project.totalVolumes}

【各卷摘要】
${volumeSummaries.map(v => `第${v.volumeNumber}卷:\n${v.summary}`).join('\n\n')}

【伏笔统计】
- 总伏笔数: ${bookData.totalPlotlines}
- 已回收: ${bookData.resolvedPlotlines}
- 未回收: ${bookData.openPlotlines}

【输出要求】
请生成 1000-1500 字的全书摘要，包含：
1. 主线剧情概述
2. 核心人物成长弧线
3. 主题元素分析
4. 伏笔回收情况

以 JSON 格式输出：
{
  "summary": "全书摘要（1000-1500字）",
  "mainPlot": "主线概述",
  "characterArcs": [{"name": "角色名", "arcDescription": "成长弧线描述"}]
}`

    const result = await provider.generate(prompt, { temperature: 0.7 })

    // 解析结果
    let summaryData = bookData
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        summaryData = {
          ...summaryData,
          summary: parsed.summary || result.content,
          mainPlot: parsed.mainPlot || '',
          characterArcs: parsed.characterArcs || [],
        }
      }
    } catch {
      // 使用基础数据
    }

    // 保存全书摘要
    await saveBookSummary(projectId, summaryData as Parameters<typeof saveBookSummary>[1])

    return { level: 'book', success: true, summary: summaryData.summary }
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成失败'
    return { level: 'book', success: false, error: message }
  }
}

/**
 * 检查并自动触发分层摘要生成
 * 应该在章节生成完成后调用
 */
export async function checkAndGenerateLayeredSummary(
  projectId: number,
  completedChapterNo: number
): Promise<{ volumeTriggered: boolean; bookTriggered: boolean }> {
  const project = await prisma.novelProject.findUnique({
    where: { id: projectId },
    select: { totalVolumes: true },
  })

  if (!project) {
    return { volumeTriggered: false, bookTriggered: false }
  }

  const totalChapters = await prisma.novelChapter.count({
    where: { projectId, status: 'COMPLETED' },
  })

  let volumeTriggered = false
  let bookTriggered = false

  // 检查当前卷是否准备好生成摘要
  const currentVolume = calculateVolume(completedChapterNo, project.totalVolumes, totalChapters)
  const isReady = await isVolumeReadyForSummary(projectId, currentVolume, project.totalVolumes, totalChapters)

  if (isReady) {
    const existing = await getVolumeSummary(projectId, currentVolume)
    if (!existing?.summary || existing.summary.includes('...')) {
      await generateVolumeSummary(projectId, currentVolume)
      volumeTriggered = true
    }
  }

  // 检查全书是否准备好生成摘要（所有卷都完成）
  if (currentVolume === project.totalVolumes && volumeTriggered) {
    const allVolumesComplete = await Promise.all(
      Array.from({ length: project.totalVolumes }, (_, i) =>
        isVolumeReadyForSummary(projectId, i + 1, project.totalVolumes, totalChapters)
      )
    )

    if (allVolumesComplete.every(Boolean)) {
      const existing = await getBookSummary(projectId)
      if (!existing?.summary) {
        await generateBookSummary(projectId)
        bookTriggered = true
      }
    }
  }

  return { volumeTriggered, bookTriggered }
}

/**
 * 获取分层摘要上下文（用于 AI 生成时的上下文压缩）
 */
export async function getHierarchicalContext(
  projectId: number,
  currentChapter: number,
  options: {
    maxTokens: number
    includeVolumeSummary: boolean
    includeBookSummary: boolean
  }
): Promise<{
  chapterSummaries: { chapterNo: number; summary: string }[]
  volumeSummary: string | null
  bookSummary: string | null
}> {
  const project = await prisma.novelProject.findUnique({
    where: { id: projectId },
    select: { totalVolumes: true },
  })

  if (!project) {
    return { chapterSummaries: [], volumeSummary: null, bookSummary: null }
  }

  // 1. 获取最近章节摘要（最近 3-5 章）
  const recentSummaries = await prisma.chapterSummary.findMany({
    where: { projectId },
    orderBy: { chapterNo: 'desc' },
    take: 5,
  })
  recentSummaries.sort((a, b) => a.chapterNo - b.chapterNo)

  // 2. 获取卷摘要
  let volumeSummary: string | null = null
  if (options.includeVolumeSummary) {
    const currentVolume = calculateVolume(currentChapter, project.totalVolumes, 100)
    const volSummary = await getVolumeSummary(projectId, currentVolume)
    volumeSummary = volSummary?.summary || null
  }

  // 3. 获取全书摘要
  let bookSummary: string | null = null
  if (options.includeBookSummary) {
    const book = await getBookSummary(projectId)
    bookSummary = book?.summary || null
  }

  return {
    chapterSummaries: recentSummaries.map(s => ({ chapterNo: s.chapterNo, summary: s.summary })),
    volumeSummary,
    bookSummary,
  }
}