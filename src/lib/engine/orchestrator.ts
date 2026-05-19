/**
 * Agent 流水线编排器
 * 核心组件，协调多 Agent 协作
 */
import { prisma } from '@/lib/prisma'
import { ChapterStatus } from '@prisma/client'
import { plannerAgent } from '../agents/planner'
import { writerAgent } from '../agents/writer'
import { polisherAgent } from '../agents/polisher'
import { validatorAgent } from '../agents/validator'
import { summarizerAgent } from '../agents/summarizer'
import * as memory from '../memory'
import * as storyState from './story-state'
import { hookRegistry } from '../hooks/registry'
import { directChapter } from '../agents/narrative-director'
import { chapterDeslopper } from '../agents/deslopper'
import type {
  ChapterOutline,
  CharacterProfile,
  PlotlineData,
  ValidationReport,
  SSEEvent,
  AgentType,
} from './types'

const MAX_RETRY_COUNT = 3

type JsonValue = string | number | boolean | null | JsonObject | JsonArray
interface JsonObject { [key: string]: JsonValue }
interface JsonArray extends Array<JsonValue> {}

interface GenerationResult {
  success: boolean
  chapterId: number
  content?: string
  outline?: ChapterOutline
  error?: string
}

type SSEEmitter = (event: SSEEvent) => void

/**
 * 章节生成流水线
 * 依次执行：策划 → 写作 → 润色 → 校验 → 摘要
 */
export async function runChapterGenerationPipeline(
  projectId: number,
  chapterNo: number,
  emit: SSEEmitter
): Promise<GenerationResult> {
  const startTime = Date.now()

  // 获取项目信息
  const project = await prisma.novelProject.findUnique({
    where: { id: projectId },
    include: { aiModelConfig: true },
  })

  if (!project) {
    return { success: false, chapterId: 0, error: '项目不存在' }
  }

  // 初始化故事状态（如果不存在）
  await storyState.initStoryState(projectId, project.totalVolumes * 25)
  const directorContext = await directChapter(chapterNo, projectId).catch(() => null)
  const directorDirective = directorContext?.fullDirective || ''

  // 获取上下文数据（并行查询）
  const [characterProfiles, openPlotlines, recentSummaries, currentState] = await Promise.all([
    memory.getCharacterProfilesForChapter(projectId, chapterNo),
    memory.getOpenPlotlines(projectId),
    memory.getRecentChapterSummaries(projectId, 3),
    storyState.getStoryState(projectId),
  ])
  const emotionalArc = currentState?.emotionalArc || []

  // 更新章节状态
  const chapter = await prisma.novelChapter.upsert({
    where: { projectId_chapterNumber: { projectId, chapterNumber: chapterNo } },
    update: { status: ChapterStatus.GENERATING },
    create: {
      projectId,
      chapterNumber: chapterNo,
      title: `第${chapterNo}章`,
      status: ChapterStatus.GENERATING,
    },
  })

  try {
    const startResults = await hookRegistry.execute('chapter_generate_start', {
      projectId,
      chapterNo,
    })
    const blocked = startResults.find(r => r.action === 'block')
    if (blocked) {
      await prisma.novelChapter.update({
        where: { id: chapter.id },
        data: { status: ChapterStatus.REVIEWING },
      })
      emit({ type: 'error', data: { message: blocked.message || 'Hook 阻断了生成流程' } })
      return { success: false, chapterId: chapter.id, error: blocked.message || 'Hook 阻断了生成流程' }
    }
    const warnings = startResults.filter(r => r.action === 'warn')
    if (warnings.length > 0) {
      emit({ type: 'hook_warning', data: { warnings: warnings.map(w => w.message) } })
    }

    // ========== Phase 1: 策划 Agent ==========
    emit({ type: 'start', data: { chapterId: chapter.id, agent: 'planner' } })

    const plannerResult = await plannerAgent({
      projectId,
      chapterNo,
      projectTitle: project.title,
      genre: project.genre,
      writingStyle: [project.writingStyle, directorDirective].filter(Boolean).join('\n\n'),
      worldSetting: [project.worldSetting, directorDirective].filter(Boolean).join('\n\n'),
      powerSystem: project.powerSystem,
      protagonistProfile: project.protagonistProfile,
      antagonistSetting: project.antagonistSetting,
      targetWordCount: project.chapterWordCount || 3000,
      characterProfiles: characterProfiles.map(c => ({
        name: c.name,
        role: c.role,
        description: `${c.appearance || ''} ${c.personality || ''}`,
      })),
      openPlotlines: openPlotlines.map(p => ({ id: p.id, description: p.description })),
      emotionalArc,
      recentChapterCount: 3,
    })

    const outline = plannerResult.outline

    // 保存章节大纲
    await prisma.novelChapter.update({
      where: { id: chapter.id },
      data: {
        chapterOutline: outline as any,
        lastAgentType: 'VALIDATOR',
      },
    })

    // 记录策划事件
    await storyState.recordStoryEvent(
      projectId,
      'PLANNER_DONE',
      `第${chapterNo}章大纲生成完成：${outline.chapterTitle}`,
      chapterNo
    )

    // ========== Phase 1.5: 研究 Agent (可选) ==========
    const existingRefs = await prisma.researchRef.findMany({
      where: { projectId },
      select: { topic: true, summary: true, keyFacts: true, creativeMaterials: true },
    })

    if (existingRefs.length > 0) {
      emit({ type: 'research', data: { refsCount: existingRefs.length } })
    }

    const researchContext = existingRefs
      .map(r => `【${r.topic}】${r.summary}\n关键事实: ${r.keyFacts.join('; ')}\n创作素材: ${r.creativeMaterials.join('; ')}`)
      .join('\n\n')

    // ========== Phase 2: 写作 Agent ==========
    emit({ type: 'agent_switch', data: { agent: 'writer' } })

    let draftContent = ''
    await writerAgent(
      {
        projectId,
        chapterNo,
        projectTitle: project.title,
        genre: project.genre,
        writingStyle: project.writingStyle,
        worldSetting: [
          project.worldSetting,
          directorDirective,
          researchContext ? `【研究参考资料】\n${researchContext}` : '',
        ].filter(Boolean).join('\n\n'),
        powerSystem: project.powerSystem,
        protagonistProfile: project.protagonistProfile,
        antagonistSetting: project.antagonistSetting,
        targetWordCount: project.chapterWordCount || 3000,
        outline,
        characterProfiles,
        recentSummaries,
      },
      (token) => {
        draftContent += token
        emit({ type: 'token', data: { content: token } })
      }
    )

    // ========== Phase 3: 润色 Agent ==========
    emit({ type: 'agent_switch', data: { agent: 'polisher' } })

    let polishedContent = ''
    await polisherAgent(
      {
        projectId,
        chapterNo,
        content: draftContent,
        styleGuide: project.writingStyle,
      },
      (token) => {
        polishedContent += token
        emit({ type: 'token', data: { content: token } })
      }
    )

    // ========== Phase 4: 校验 Agent ==========
    emit({ type: 'agent_switch', data: { agent: 'validator' } })

    const validationReport = await validatorAgent({
      projectId,
      chapterNo,
      newChapterContent: polishedContent,
      characterProfiles,
      recentSummaries,
      worldSetting: project.worldSetting,
      openPlotlines,
    })

    emit({
      type: 'validation',
      data: {
        result: validationReport.result,
        score: validationReport.score,
      },
    })

    // 校验失败处理
    if (validationReport.result === 'retry') {
      const currentRetry = await prisma.novelChapter.findUnique({
        where: { id: chapter.id },
      })
      const retryCount = (currentRetry?.retryCount || 0) + 1

      if (retryCount >= MAX_RETRY_COUNT) {
        // 超限降级输出，标记人工审核
        await prisma.novelChapter.update({
          where: { id: chapter.id },
          data: {
            content: polishedContent,
            status: ChapterStatus.REVIEWING,
            retryCount,
            validationReport: validationReport as any,
            wordCount: polishedContent.length,
            lastAgentType: 'VALIDATOR',
          },
        })

        emit({
          type: 'error',
          data: {
            message: `校验失败超过${MAX_RETRY_COUNT}次，已标记人工审核`,
          },
        })

        return {
          success: true,
          chapterId: chapter.id,
          content: polishedContent,
          error: '校验失败，已标记人工审核',
        }
      }

      // 重试写作
      await prisma.novelChapter.update({
        where: { id: chapter.id },
        data: { retryCount },
      })

      // 递归重试（但限制次数）
      return runChapterGenerationPipeline(projectId, chapterNo, emit)
    }

    // ========== Phase 5: 去 AI 味 Agent ==========
    emit({ type: 'agent_switch', data: { agent: 'deslopper' } })

    let finalContent = polishedContent
    try {
      const deslopResult = await chapterDeslopper({
        projectId,
        chapterId: chapter.id,
        content: polishedContent,
        chapterNumber: chapterNo,
        chapterTitle: outline.chapterTitle,
        genre: project.genre,
        writingStyle: project.writingStyle,
        strictness: 'medium',
      })
      finalContent = deslopResult.revisedContent
    } catch (deslopError) {
      emit({
        type: 'hook_warning',
        data: {
          warnings: [
            `去 AI 味失败，已保留润色稿：${deslopError instanceof Error ? deslopError.message : '未知错误'}`,
          ],
        },
      })
    }

    // ========== Phase 6: 摘要 Agent ==========
    emit({ type: 'agent_switch', data: { agent: 'summarizer' } })

    const summaryData = await summarizerAgent({
      projectId,
      chapterNo,
      chapterTitle: outline.chapterTitle,
      chapterContent: finalContent,
      worldSetting: project.worldSetting,
      protagonistProfile: project.protagonistProfile,
    })

    // 保存摘要
    await memory.saveChapterSummary(projectId, chapterNo, summaryData)

    // 处理伏笔
    if (summaryData.plantedPlotlines.length > 0) {
      await memory.batchCreatePlotlines(
        projectId,
        summaryData.plantedPlotlines.map((desc, i) => ({
          description: desc,
          plantedAt: chapterNo,
          type: 'FORESHADOW',
        }))
      )
    }

    if (summaryData.resolvedPlotlines.length > 0) {
      await memory.batchResolvePlotlines(summaryData.resolvedPlotlines, chapterNo)
    }

    // 更新角色档案
    if (Object.keys(validationReport.characterUpdates).length > 0) {
      await memory.batchUpdateCharacterProfiles(
        projectId,
        validationReport.characterUpdates,
        chapterNo
      )
    }

    // 更新故事状态
    const emotionalValue = summaryData.emotionalTone === '紧张' ? 80 :
      summaryData.emotionalTone === '温馨' ? 40 :
        summaryData.emotionalTone === '悲伤' ? 30 :
          summaryData.emotionalTone === '高潮' ? 95 : 60

    await storyState.updateEmotionalArc(projectId, chapterNo, emotionalValue)
    await storyState.updateChapterProgress(projectId, chapterNo)

    // 记录完成事件
    await storyState.recordStoryEvent(
      projectId,
      'CHAPTER_COMPLETED',
      `第${chapterNo}章生成完成，字数${finalContent.length}`,
      chapterNo
    )

    // ========== 保存最终结果 ==========
    await prisma.novelChapter.update({
      where: { id: chapter.id },
      data: {
        title: outline.chapterTitle,
        content: finalContent,
        summary: summaryData.summary,
        status: ChapterStatus.COMPLETED,
        validationReport: validationReport as any,
        wordCount: finalContent.length,
        lastAgentType: 'POLISHER',
      },
    })

    // 更新项目总字数
    const totalWordCount = await prisma.novelChapter.aggregate({
      where: { projectId, status: ChapterStatus.COMPLETED },
      _sum: { wordCount: true },
    })

    await prisma.novelProject.update({
      where: { id: projectId },
      data: { currentWordCount: totalWordCount._sum.wordCount || 0 },
    })

    await hookRegistry.execute('chapter_generate_end', {
      projectId,
      chapterNo,
      content: finalContent,
    })

    emit({
      type: 'done',
      data: {
        chapterId: chapter.id,
        wordCount: polishedContent.length,
        duration: Date.now() - startTime,
      },
    })

    return {
      success: true,
      chapterId: chapter.id,
      content: polishedContent,
      outline,
    }

  } catch (error) {
    // 发生错误，更新章节状态
    await prisma.novelChapter.update({
      where: { id: chapter.id },
      data: { status: ChapterStatus.REVIEWING },
    })

    const errorMessage = error instanceof Error ? error.message : '未知错误'
    emit({ type: 'error', data: { message: errorMessage } })

    return {
      success: false,
      chapterId: chapter.id,
      error: errorMessage,
    }
  }
}

/**
 * 获取章节生成状态
 */
export async function getChapterGenerationStatus(
  projectId: number,
  chapterNo: number
): Promise<{
  status: string
  retryCount: number
  validationReport?: ValidationReport | null
  lastAgentType?: AgentType | null
}> {
  const chapter = await prisma.novelChapter.findUnique({
    where: { projectId_chapterNumber: { projectId, chapterNumber: chapterNo } },
  })

  if (!chapter) {
    return { status: 'NOT_FOUND', retryCount: 0 }
  }

  return {
    status: chapter.status,
    retryCount: chapter.retryCount,
    validationReport: chapter.validationReport as ValidationReport | null,
    lastAgentType: chapter.lastAgentType as AgentType | null,
  }
}
