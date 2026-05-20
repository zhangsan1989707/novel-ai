/**
 * Agent 流水线编排器
 * 核心组件，协调多 Agent 协作
 */
import { prisma } from '@/lib/prisma'
import { ChapterStatus } from '@prisma/client'
import { countChineseWords } from '@/lib/utils'
import { getMinimumChapterWordCount, buildChapterWordCountWarning } from '@/lib/ai/chapter-quality'
import { AIService } from '@/lib/ai/service'
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
  ValidationReport,
  ChapterSummaryData,
  SSEEvent,
  AgentType,
} from './types'

const MAX_RETRY_COUNT = 3

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
  emit: SSEEmitter,
  options?: {
    speedMode?: 'fast' | 'balanced' | 'quality'
  }
): Promise<GenerationResult> {
  const speedMode = options?.speedMode || 'balanced'
  const startTime = Date.now()
  let lastReportedWordCount = 0

  // 创建共享 AI Provider（避免每个 Agent 重复 DB 查询）
  const sharedProvider = await AIService.createProvider({
    projectId,
    usageType: 'PIPELINE',
  })

  // Phase 计时辅助函数
  const runPhase = async (phase: string, fn: () => Promise<void>) => {
    const phaseStart = Date.now()
    await fn()
    const durationMs = Date.now() - phaseStart
    emit({ type: 'phase_timing', data: { phase, durationMs, speedMode } })
  }

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
      memory.getRecentChapterSummaries(projectId, 2),
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
    let outline!: ChapterOutline

    if (speedMode === 'fast') {
      outline = {
        chapterTitle: `第${chapterNo}章`,
        chapterGoal: '继续推进故事发展',
        mainConflict: '当前核心矛盾',
        keyScenes: [
          { scene: '开场：快速进入本章情节', characters: ['主角'], emotion: '推进' },
          { scene: '发展：推进核心矛盾', characters: ['主角', '关键角色'], emotion: '对抗' },
          { scene: '收尾：留下悬念', characters: ['主角'], emotion: '悬念' },
        ],
        ending: '留下新的悬念，为下一章铺垫',
        foreshadows: [],
        resolvedPlotlines: [],
      }
    } else {
      await runPhase('planner', async () => {
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
          recentChapterCount: 2,
          provider: sharedProvider,
        })

        outline = plannerResult.outline

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
      })
    }

    if (speedMode === 'fast') {
      await prisma.novelChapter.update({
        where: { id: chapter.id },
        data: {
          chapterOutline: outline as any,
          lastAgentType: 'WRITER',
        },
      })
    }

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
    let draftContent = ''

    await runPhase('writer', async () => {
      emit({ type: 'agent_switch', data: { agent: 'writer' } })

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
          provider: sharedProvider,
        },
        (token) => {
          draftContent += token
          emit({ type: 'token', data: { content: token } })
          const currentWordCount = countChineseWords(draftContent)
          if (currentWordCount >= lastReportedWordCount + 120) {
            lastReportedWordCount = currentWordCount
            emit({ type: 'wordCount', data: { count: currentWordCount } })
          }
        }
      )
    })

    // ========== Phase 3: 润色 Agent ==========
    let polishedContent = draftContent

    if (speedMode === 'quality') {
      await runPhase('polisher', async () => {
        emit({ type: 'agent_switch', data: { agent: 'polisher' } })

        polishedContent = ''
        await polisherAgent(
          {
            projectId,
            chapterNo,
            content: draftContent,
            styleGuide: project.writingStyle,
            provider: sharedProvider,
          },
          (token) => {
            polishedContent += token
            emit({ type: 'token', data: { content: token } })
          }
        )
      })
    }

    // ========== Phase 4: 校验 Agent ==========
    let validationReport: any

    if (speedMode === 'quality') {
      await runPhase('validator', async () => {
        emit({ type: 'agent_switch', data: { agent: 'validator' } })

        validationReport = await validatorAgent({
          projectId,
          chapterNo,
          newChapterContent: polishedContent,
          characterProfiles,
          recentSummaries,
          worldSetting: project.worldSetting,
          openPlotlines,
          provider: sharedProvider,
        })

        emit({
          type: 'validation',
          data: {
            result: validationReport.result,
            score: validationReport.score,
          },
        })
      })

      // 校验失败处理
      if (validationReport.result === 'retry') {
        const currentRetry = await prisma.novelChapter.findUnique({
          where: { id: chapter.id },
        })
        const retryCount = (currentRetry?.retryCount || 0) + 1

        if (retryCount >= MAX_RETRY_COUNT) {
          const failedWordCount = countChineseWords(polishedContent)
          await prisma.novelChapter.update({
            where: { id: chapter.id },
            data: {
              content: polishedContent,
              status: ChapterStatus.REVIEWING,
              retryCount,
              validationReport: validationReport as any,
              wordCount: failedWordCount,
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

        await prisma.novelChapter.update({
          where: { id: chapter.id },
          data: { retryCount },
        })

        return runChapterGenerationPipeline(projectId, chapterNo, emit, { speedMode })
      }
    } else {
      validationReport = {
        result: 'pass',
        score: 85,
        issues: [],
        characterUpdates: {},
        newPlotlines: [],
        resolvedPlotlines: [],
        qualityMetrics: {
          logicScore: 85,
          characterScore: 85,
          emotionScore: 85,
          styleScore: 85,
        },
      }
    }

    // ========== Phase 5: 去 AI 味 Agent ==========
    let finalContent = polishedContent

    if (speedMode === 'quality') {
      await runPhase('deslopper', async () => {
        emit({ type: 'agent_switch', data: { agent: 'deslopper' } })

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
            provider: sharedProvider,
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
      })
    }

    // ========== Phase 6: 摘要 Agent ==========
    let summaryData!: ChapterSummaryData

    if (speedMode !== 'fast') {
      await runPhase('summarizer', async () => {
        emit({ type: 'agent_switch', data: { agent: 'summarizer' } })

        summaryData = await summarizerAgent({
          projectId,
          chapterNo,
          chapterTitle: outline.chapterTitle,
          chapterContent: finalContent,
          worldSetting: project.worldSetting,
          protagonistProfile: project.protagonistProfile,
          provider: sharedProvider,
        })

        // 保存摘要
        await memory.saveChapterSummary(projectId, chapterNo, summaryData)

        // 处理伏笔
        if (summaryData.plantedPlotlines.length > 0) {
          await memory.batchCreatePlotlines(
            projectId,
            summaryData.plantedPlotlines.map((desc) => ({
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
      })
    } else {
      summaryData = {
        summary: `第${chapterNo}章（快速模式生成）`,
        keyEvents: [],
        emotionalTone: null,
        plantedPlotlines: [],
        resolvedPlotlines: [],
      }

      await storyState.updateChapterProgress(projectId, chapterNo)
    }

    const finalWordCount = countChineseWords(finalContent)
    const polishedWordCount = countChineseWords(polishedContent)
    const minimumWordCount = getMinimumChapterWordCount(project.chapterWordCount || 3000, chapterNo)
    const chapterReady = finalWordCount >= minimumWordCount
    emit({ type: 'wordCount', data: { count: finalWordCount } })

    await runPhase('db_write', async () => {
      await storyState.recordStoryEvent(
        projectId,
        'CHAPTER_COMPLETED',
        `第${chapterNo}章生成完成，字数${finalWordCount}`,
        chapterNo
      )

      await prisma.novelChapter.update({
        where: { id: chapter.id },
        data: {
          title: outline.chapterTitle,
          content: finalContent,
          summary: summaryData.summary,
          status: chapterReady ? ChapterStatus.COMPLETED : ChapterStatus.REVIEWING,
          validationReport: validationReport as any,
          wordCount: finalWordCount,
          lastAgentType: speedMode === 'quality' ? 'POLISHER' : 'WRITER',
        },
      })

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
    })

    emit({
      type: 'done',
      data: {
        chapterId: chapter.id,
        wordCount: polishedWordCount,
        minimumWordCount,
        qualityStatus: chapterReady ? 'completed' : 'reviewing',
        warning: chapterReady ? undefined : buildChapterWordCountWarning(finalWordCount, project.chapterWordCount || 3000, chapterNo),
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
