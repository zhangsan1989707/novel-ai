/**
 * Agent 流水线编排器
 * 核心组件，协调多 Agent 协作
 */
import { prisma } from '@/lib/prisma'
import { ChapterStatus, type Prisma } from '@prisma/client'
import { countChineseWords } from '@/lib/utils'
import { getMinimumChapterWordCount, buildChapterWordCountWarning } from '@/lib/ai/chapter-quality'
import { AIService } from '@/lib/ai/service'
import { plannerAgent } from '../agents/planner'
import { writerAgent } from '../agents/writer'
import { polisherAgent } from '../agents/polisher'
import { validatorAgent, type ValidatorValidationReport } from '../agents/validator'
import { summarizerAgent } from '../agents/summarizer'
import { reviewerAgent } from '../agents/reviewer'
import { buildChapterMemoryPack } from '../memory'
import * as storyState from './story-state'
import { hookRegistry } from '../hooks/registry'
import { directChapter } from '../agents/narrative-director'
import { chapterDeslopper } from '../agents/deslopper'
import { recordAndApplyChapterCommit } from './chapter-commit'
import { buildRevisionPrompt } from '@/lib/ai'
import { estimateMaxTokensForTargetWordCount, resolveEffectiveChapterWordCount } from '@/lib/ai/speed-mode'
import type { GenerationRole, GenerationSpeedMode } from '@/lib/ai/speed-mode'
import type {
  ChapterOutline,
  ValidationReport as EngineValidationReport,
  ChapterSummaryData,
  SSEEvent,
  AgentType,
} from './types'
import { normalizePopularFictionProfile, scorePopularFictionChapter } from './popular-fiction'

const MAX_RETRY_COUNT = 3

interface GenerationResult {
  success: boolean
  chapterId: number
  content?: string
  outline?: ChapterOutline
  error?: string
}

type SSEEmitter = (event: SSEEvent) => void

function buildReviewSuggestion(review: {
  consensus: string
  criticalIssues: string[]
  improvementPriority: string[]
  overallScore: number
}): string {
  const parts: string[] = []

  if (review.consensus.trim()) {
    parts.push(`审稿共识：${review.consensus.trim()}`)
  }

  if (review.criticalIssues.length > 0) {
    parts.push(`关键问题：${review.criticalIssues.slice(0, 3).join('；')}`)
  }

  if (review.improvementPriority.length > 0) {
    parts.push(`优先改进：${review.improvementPriority.slice(0, 5).join('；')}`)
  }

  if (review.overallScore < 60) {
    parts.push('请优先重构章节冲突、节奏和钩子，再保留人物与世界观连续性。')
  } else {
    parts.push('请保留原有亮点，只修正薄弱表达、节奏拖沓和轻微结构问题。')
  }

  return parts.join('\n')
}

/**
 * 章节生成流水线
 * 依次执行：策划 → 写作 → 润色 → 对抗审稿 → 校验 → 去 AI 味 → 摘要
 */
export async function runChapterGenerationPipeline(
  projectId: number,
  chapterNo: number,
  emit: SSEEmitter,
  options?: {
    speedMode?: GenerationSpeedMode
  }
): Promise<GenerationResult> {
  const speedMode = options?.speedMode || 'balanced'
  const startTime = Date.now()
  let lastReportedWordCount = 0

  const providerCache = new Map<GenerationRole, Awaited<ReturnType<typeof AIService.createProvider>>>()
  const getRoleProvider = async (role: GenerationRole) => {
    const cached = providerCache.get(role)
    if (cached) return cached
    const provider = await AIService.createProvider({
      projectId,
      usageType: `PIPELINE_${role.toUpperCase()}`,
      speedMode,
      generationRole: role,
    })
    providerCache.set(role, provider)
    return provider
  }

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
    include: { aiModelConfig: true, bookBlueprint: true },
  })

  if (!project) {
    return { success: false, chapterId: 0, error: '项目不存在' }
  }
  const chapterTargetWordCount = resolveEffectiveChapterWordCount(project.chapterWordCount || 3000, speedMode)
  const popularFictionProfile = normalizePopularFictionProfile(
    (project.bookBlueprint as unknown as { popularFictionProfile?: unknown } | null)?.popularFictionProfile
  )

  // 初始化故事状态（如果不存在）
  await storyState.initStoryState(projectId, project.totalVolumes * 25)
  const directorContext = await directChapter(chapterNo, projectId).catch(() => null)
  const directorDirective = directorContext?.fullDirective || ''
  const memoryPack = await buildChapterMemoryPack(projectId, chapterNo, {
    recentChapterCount: 3,
    recentVolumeCount: 2,
    characterLimit: 10,
    plotlineLimit: 10,
    researchLimit: 3,
  })
  const emotionalArc = memoryPack.storyState?.emotionalArc || []
  const plannerMemoryContext = [memoryPack.plannerContext, directorDirective ? `## 导演指令\n${directorDirective}` : '']
    .filter(Boolean)
    .join('\n\n')
  const writerMemoryContext = [memoryPack.writerContext, directorDirective ? `## 导演指令\n${directorDirective}` : '']
    .filter(Boolean)
    .join('\n\n')
  const validatorMemoryContext = [memoryPack.validatorContext, directorDirective ? `## 导演指令\n${directorDirective}` : '']
    .filter(Boolean)
    .join('\n\n')
  const summarizerMemoryContext = memoryPack.summarizerContext

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
          writingStyle: project.writingStyle,
          memoryContext: plannerMemoryContext,
          worldSetting: project.worldSetting,
          powerSystem: project.powerSystem,
          protagonistProfile: project.protagonistProfile,
          antagonistSetting: project.antagonistSetting,
          targetWordCount: chapterTargetWordCount,
          characterProfiles: memoryPack.characterProfiles.map(c => ({
            name: c.name,
            role: c.role,
            description: `${c.appearance || ''} ${c.personality || ''}`,
          })),
          openPlotlines: memoryPack.openPlotlines.map(p => ({ id: p.id, description: p.description })),
          emotionalArc,
          recentChapterSummaries: memoryPack.recentChapterSummaries,
          recentChapterCount: memoryPack.recentChapterSummaries.length,
          provider: await getRoleProvider('planner'),
          popularFictionProfile,
        })

        outline = plannerResult.outline

        // 保存章节大纲
        await prisma.novelChapter.update({
          where: { id: chapter.id },
          data: {
            chapterOutline: outline as unknown as Prisma.InputJsonValue,
            lastAgentType: 'PLANNER',
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
          chapterOutline: outline as unknown as Prisma.InputJsonValue,
          lastAgentType: 'WRITER',
        },
      })
    }

    // ========== Phase 1.5: 研究资料 ==========
    if (memoryPack.researchRefs.length > 0) {
      emit({ type: 'research', data: { refsCount: memoryPack.researchRefs.length } })
    }

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
          memoryContext: writerMemoryContext,
          worldSetting: project.worldSetting,
          powerSystem: project.powerSystem,
          protagonistProfile: project.protagonistProfile,
          antagonistSetting: project.antagonistSetting,
          targetWordCount: chapterTargetWordCount,
          outline,
          characterProfiles: memoryPack.characterProfiles,
          recentSummaries: memoryPack.recentChapterSummaries,
          provider: await getRoleProvider('writer'),
          maxTokens: estimateMaxTokensForTargetWordCount(chapterTargetWordCount),
          popularFictionProfile,
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
            provider: await getRoleProvider('polisher'),
          },
          (token) => {
            polishedContent += token
            emit({ type: 'token', data: { content: token } })
          }
        )
      })
    }

    // ========== Phase 4: 对抗审稿 Agent ==========
    let reviewedContent = polishedContent

    if (speedMode === 'quality') {
      await runPhase('reviewer', async () => {
        emit({ type: 'agent_switch', data: { agent: 'reviewer' } })

        try {
          const reviewResult = await reviewerAgent(
            {
              projectId,
              content: polishedContent,
              genre: project.genre,
              targetAudience: project.targetAudience,
              chapterNo,
              worldSetting: project.worldSetting,
              provider: await getRoleProvider('reviewer'),
            },
          )

          await prisma.reviewReport.create({
            data: {
              projectId,
              chapterNo,
              content: polishedContent,
              reviews: reviewResult.reviews as unknown as object[],
              overallScore: reviewResult.overallScore,
              consensus: reviewResult.consensus,
              criticalIssues: reviewResult.criticalIssues,
              improvementPriority: reviewResult.improvementPriority,
            },
          })

          const shouldApplyRevision = reviewResult.overallScore < 85 || reviewResult.criticalIssues.length > 0
          if (shouldApplyRevision) {
            const reviewRevisionType = reviewResult.overallScore < 60 || reviewResult.criticalIssues.length > 0
              ? 'rewrite'
              : 'polish'

            await runPhase('review_revision', async () => {
              emit({ type: 'agent_switch', data: { agent: 'review_revision' } })

              const reviewContext = {
                projectTitle: project.title,
                genre: project.genre || undefined,
                writingStyle: project.writingStyle || undefined,
                worldSetting: project.worldSetting || undefined,
                powerSystem: project.powerSystem || undefined,
                protagonistProfile: project.protagonistProfile || undefined,
                protagonistGoal: project.protagonistGoal || undefined,
                antagonistSetting: project.antagonistSetting || undefined,
                endingPlan: project.endingPlan || undefined,
                writingPrompt: project.writingPrompt || undefined,
                currentChapterNumber: chapterNo,
                currentChapterTitle: outline.chapterTitle,
                currentChapterSummary: [outline.chapterGoal, outline.mainConflict].filter(Boolean).join('；'),
                memoryContext: writerMemoryContext,
              }

              const reviewPrompt = buildRevisionPrompt(
                reviewContext,
                polishedContent,
                reviewRevisionType,
                buildReviewSuggestion(reviewResult)
              )

              const revisionResult = await (await getRoleProvider('revision')).generate(reviewPrompt, {
                temperature: reviewRevisionType === 'rewrite' ? 0.72 : 0.55,
                maxTokens: Math.min(4096, Math.max(2000, Math.ceil(polishedContent.length * 0.75))),
              })

              reviewedContent = revisionResult.content.trim() || polishedContent
            })
          }
        } catch (reviewError) {
          emit({
            type: 'hook_warning',
            data: {
              warnings: [
                `对抗审稿失败，已回退到原润色稿：${reviewError instanceof Error ? reviewError.message : '未知错误'}`,
              ],
            },
          })
        }
      })
    }

    // ========== Phase 5: 校验 Agent ==========
    let validationReport: ValidatorValidationReport | null = null

    if (speedMode === 'quality') {
      await runPhase('validator', async () => {
        emit({ type: 'agent_switch', data: { agent: 'validator' } })

        validationReport = await validatorAgent({
          projectId,
          chapterNo,
          newChapterContent: reviewedContent,
          memoryContext: validatorMemoryContext,
          characterProfiles: memoryPack.characterProfiles,
          recentSummaries: memoryPack.recentChapterSummaries,
          worldSetting: project.worldSetting,
          openPlotlines: memoryPack.openPlotlines,
          chapterTitle: outline.chapterTitle,
          chapterGoal: outline.chapterGoal,
          provider: await getRoleProvider('validator'),
          popularFictionProfile,
        })

        const popularScore = scorePopularFictionChapter({
          content: reviewedContent,
          outline,
          profile: popularFictionProfile,
        })
        validationReport = {
          ...validationReport,
          popularFiction: popularScore,
          result: popularScore.emotion < 7 || popularScore.conflict < 7 || popularScore.hook < 7 || popularScore.character < 7
            ? 'retry'
            : validationReport.result,
          issues: [
            ...validationReport.issues,
            ...popularScore.issues.map(issue => ({
              type: 'emotion' as const,
              severity: 'major' as const,
              description: issue,
              location: '全文',
              reference: '爆款四因子诊断',
            })),
          ],
        }

        emit({
          type: 'validation',
          data: {
          result: validationReport.result,
          score: validationReport.score,
          },
        })
      })

      // 校验失败处理
      const currentValidationReport = validationReport as ValidatorValidationReport | null
      if (currentValidationReport?.result === 'retry') {
        const currentRetry = await prisma.novelChapter.findUnique({
          where: { id: chapter.id },
        })
        const retryCount = (currentRetry?.retryCount || 0) + 1

        if (retryCount >= MAX_RETRY_COUNT) {
          const failedWordCount = countChineseWords(reviewedContent)
          await prisma.novelChapter.update({
            where: { id: chapter.id },
            data: {
              content: reviewedContent,
              status: ChapterStatus.REVIEWING,
              retryCount,
              validationReport: currentValidationReport as unknown as Prisma.InputJsonValue,
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
            content: reviewedContent,
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
      const popularScore = scorePopularFictionChapter({
        content: polishedContent,
        outline,
        profile: popularFictionProfile,
      })
      validationReport = {
        result: 'pass',
        score: 85,
        issues: [],
        characterUpdates: {},
        newPlotlines: [],
        resolvedPlotlines: [],
        popularFiction: popularScore,
        qualityMetrics: {
          logicScore: 85,
          characterScore: 85,
          emotionScore: 85,
          styleScore: 85,
        },
      }
      reviewedContent = polishedContent
    }

    // ========== Phase 6: 去 AI 味 Agent ==========
    let finalContent = reviewedContent

    if (speedMode === 'quality') {
      await runPhase('deslopper', async () => {
        emit({ type: 'agent_switch', data: { agent: 'deslopper' } })

        try {
          const deslopResult = await chapterDeslopper({
            projectId,
            chapterId: chapter.id,
            content: reviewedContent,
            chapterNumber: chapterNo,
            chapterTitle: outline.chapterTitle,
            genre: project.genre,
            writingStyle: project.writingStyle,
            strictness: 'medium',
            provider: await getRoleProvider('deslopper'),
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

    // ========== Phase 7: 摘要 Agent ==========
    let summaryData!: ChapterSummaryData

    if (speedMode !== 'fast') {
      await runPhase('summarizer', async () => {
        emit({ type: 'agent_switch', data: { agent: 'summarizer' } })

        summaryData = await summarizerAgent({
          projectId,
          chapterNo,
          chapterTitle: outline.chapterTitle,
          chapterContent: finalContent,
          memoryContext: summarizerMemoryContext,
          worldSetting: project.worldSetting,
          protagonistProfile: project.protagonistProfile,
          provider: await getRoleProvider('summarizer'),
        })

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
      const emotionalValue = summaryData.emotionalTone === '紧张' ? 80 :
        summaryData.emotionalTone === '温馨' ? 40 :
          summaryData.emotionalTone === '悲伤' ? 30 :
            summaryData.emotionalTone === '高潮' ? 95 : 60

      await recordAndApplyChapterCommit(projectId, chapter.id, {
        chapterNo,
        chapterTitle: outline.chapterTitle,
        content: finalContent,
        summaryData,
        validationReport: validationReport as unknown as EngineValidationReport | null,
        outline,
        qualityStatus: chapterReady ? 'completed' : 'reviewing',
        warning: chapterReady ? undefined : buildChapterWordCountWarning(finalWordCount, project.chapterWordCount || 3000, chapterNo),
        targetWordCount: project.chapterWordCount || 3000,
        currentWordCount: finalWordCount,
        emotionalValue,
        agentType: speedMode === 'quality' ? 'POLISHER' : 'WRITER',
        emittedAt: new Date().toISOString(),
      }, 'pipeline')

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
  validationReport?: EngineValidationReport | null
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
    validationReport: chapter.validationReport as EngineValidationReport | null,
    lastAgentType: chapter.lastAgentType as AgentType | null,
  }
}
