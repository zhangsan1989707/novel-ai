/**
 * Agent 流水线编排器
 * 核心组件，协调多 Agent 协作
 */
import { prisma } from '@/lib/prisma'
import { ChapterStatus, type Prisma } from '@prisma/client'
import { countChineseWords } from '@/lib/utils'
import { getMinimumChapterWordCount } from '@/lib/ai/chapter-quality'
import { AIService } from '@/lib/ai/service'
import { plannerAgent } from '../agents/planner'
import { writerAgent } from '../agents/writer'
import { polisherAgent } from '../agents/polisher'
import { validatorAgent, type ValidatorValidationReport } from '../agents/validator'
import { summarizerAgent } from '../agents/summarizer'
import { reviewerAgent, type MultiReviewResult } from '../agents/reviewer'
import { buildChapterMemoryPack } from '../memory'
import * as storyState from './story-state'
import { hookRegistry } from '../hooks/registry'
import { directChapter } from '../agents/narrative-director'
import { chapterDeslopper } from '../agents/deslopper'
import { recordAndApplyChapterCommit } from './chapter-commit'
import { getCharacterVoicesForProject } from '../memory/character-memory'
import { notifyChapterGenerated, notifyPipelineFailed } from '@/lib/notifications/pipeline-events'
import { estimateMaxTokensForTargetWordCount, resolveEffectiveChapterWordCount } from '@/lib/ai/speed-mode'
import type { GenerationRole, GenerationSpeedMode } from '@/lib/ai/speed-mode'
import type {
  ChapterOutline,
  ValidationReport as EngineValidationReport,
  ChapterSummaryData,
  SSEEvent,
  GenerationPhase,
} from './types'
import { normalizePopularFictionProfile, scorePopularFictionChapter } from './popular-fiction'
import type { StyleProfilePromptCard } from '@/types/style'
import { buildSeedOutlineFromChapterState } from './chapter-metadata'
import { createChapterContract } from './chapter-contract'
import { runQualityGate, type QualityGateResult } from './quality-gate'
import { expandChapter, compressChapter, continueChapter, rewriteChapter } from './chapter-repair'
import { buildChapterCompletionReport } from './chapter-completion'
import { getPendingOrStartedArcEvents, buildArcEventPromptContext, advanceArcEvent } from './arc-event-ledger'
import { getCheatAbilityState, appendCheatUsage, buildCheatAbilityPromptContext } from './cheat-ability-state'
import { runRuleFantasyValidator } from './rule-fantasy-validator'
import { validateChapterContent } from './content-validator'
import { getWorldState, getVillains, getWorldExpansionContext, getVillainContext } from './long-novel-integration'
import { updateWorldStateAfterChapter } from './world-state-updater'
import { auditChapterContinuityWithLLM, buildChapterContinuitySnapshot, type ContinuityAuditResult } from './chapter-continuity'
import { emitProgress, startPhaseHeartbeat, type SSEEmitter } from './orchestrator-helpers'

const MAX_RETRY_COUNT = 3
const MAX_REPAIR_ATTEMPTS = 2

interface GenerationResult {
  success: boolean
  chapterId: number
  content?: string
  outline?: ChapterOutline
  error?: string
}

/**
 * 章节生成流水线
 * 依次执行：策划 → 写作 → 润色 → 对抗审稿 → 校验 → 去 AI 味 → 摘要 → Quality Gate
 */
export async function runChapterGenerationPipeline(
  projectId: number,
  chapterNo: number,
  emit: SSEEmitter,
  options?: {
    speedMode?: GenerationSpeedMode
    forceRegenerate?: boolean
    _retryMemoryPack?: Awaited<ReturnType<typeof buildChapterMemoryPack>>
  }
): Promise<GenerationResult> {
  const speedMode = options?.speedMode || 'FINAL_POLISH'
  const isRetry = !!options?._retryMemoryPack
  const forceRegenerate = Boolean(options?.forceRegenerate || isRetry)
  const startTime = Date.now()
  let lastReportedWordCount = 0

  // 获取项目总章节数
  const projectInfo = await prisma.novelProject.findUnique({
    where: { id: projectId },
    select: { totalVolumes: true },
  })
  const totalChapters = (projectInfo?.totalVolumes || 12) * 25 || 300
  
  // 获取已完成章节数
  const completedChaptersCount = await prisma.novelChapter.count({
    where: { projectId, status: 'COMPLETED' },
  })

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
  const runPhase = async <T>(phase: string, fn: () => Promise<T>): Promise<T> => {
    const phaseStart = Date.now()
    const result = await fn()
    const durationMs = Date.now() - phaseStart
    emit({ type: 'phase_timing', data: { phase, durationMs, speedMode } })
    return result
  }

  // 获取项目信息
  const project = await prisma.novelProject.findUnique({
    where: { id: projectId },
    include: { aiModelConfig: true, bookBlueprint: true, styleProfile: true },
  })

  if (!project) {
    return { success: false, chapterId: 0, error: '项目不存在' }
  }
  const chapterTargetWordCount = resolveEffectiveChapterWordCount(project.chapterWordCount || 3000, speedMode)
  const popularFictionProfile = normalizePopularFictionProfile(
    (project.bookBlueprint as unknown as { popularFictionProfile?: unknown } | null)?.popularFictionProfile
  )

  // 加载风格画像
  let styleProfilePromptCard: StyleProfilePromptCard | null = null
  if (project.styleProfile && project.styleProfile.promptCard) {
    const sp = project.styleProfile
    const profileData = sp.profileJson as Record<string, unknown>
    styleProfilePromptCard = {
      displayLabel: sp.displayLabel,
      prose: formatStyleSection(profileData, 'prose'),
      vocabulary: formatStyleSection(profileData, 'vocabulary'),
      sentence: formatStyleSection(profileData, 'sentence'),
      rhetoric: formatStyleSection(profileData, 'rhetoric'),
      narrative: formatStyleSection(profileData, 'narrative'),
      plot: formatStyleSection(profileData, 'plot'),
      character: formatStyleSection(profileData, 'character'),
      mustDo: ((profileData.generationGuide as Record<string, unknown> | undefined)?.mustDo as string[]) || [],
      avoid: ((profileData.generationGuide as Record<string, unknown> | undefined)?.avoid as string[]) || [],
      riskLevel: (sp.riskLevel as 'LOW' | 'MEDIUM' | 'HIGH') || 'LOW',
      safetyMode: (project.styleSafetyMode as 'SAFE_ABSTRACT' | 'STRICT_PUBLIC_DOMAIN' | 'USER_LICENSED') || 'SAFE_ABSTRACT',
    }
  }

  const state = await storyState.getStoryState(projectId)
  if (!state) {
    await storyState.initStoryState(projectId, project.totalVolumes * 25)
  }
  const directorContext = isRetry ? null : await directChapter(chapterNo, projectId).catch(() => null)
  const directorDirective = directorContext?.fullDirective || ''
  const dynamicRecentCount = chapterNo <= 10 ? 3 : chapterNo <= 30 ? 5 : 7
  const memoryPack = isRetry
    ? options!._retryMemoryPack!
    : await buildChapterMemoryPack(projectId, chapterNo, {
        recentChapterCount: dynamicRecentCount,
        recentVolumeCount: chapterNo <= 50 ? 2 : 3,
        characterLimit: 10,
        plotlineLimit: 10,
        researchLimit: 3,
        speedMode,
      })

  const cheatState = await getCheatAbilityState(projectId)
  const arcEvents = await getPendingOrStartedArcEvents(projectId)
  const cheatPromptContext = buildCheatAbilityPromptContext(cheatState)
  const arcEventPromptContext = buildArcEventPromptContext(arcEvents)
  const characterVoices = await getCharacterVoicesForProject(projectId)

  const worldState = await getWorldState(projectId)
  const villains = await getVillains(projectId)
  const worldExpansionContext = getWorldExpansionContext(worldState, chapterNo, totalChapters)
  const villainPromptContext = getVillainContext(villains, chapterNo, totalChapters)

  const emotionalArc = memoryPack.storyState?.emotionalArc || []
  const plannerMemoryContext = [memoryPack.plannerContext, cheatPromptContext, arcEventPromptContext, directorDirective ? `## 导演指令\n${directorDirective}` : '', worldExpansionContext, villainPromptContext]
    .filter(Boolean)
    .join('\n\n')
  const writerMemoryContext = [memoryPack.writerContext, cheatPromptContext, directorDirective ? `## 导演指令\n${directorDirective}` : '', worldExpansionContext, villainPromptContext]
    .filter(Boolean)
    .join('\n\n')
  const validatorMemoryContext = [memoryPack.validatorContext, cheatPromptContext, directorDirective ? `## 导演指令\n${directorDirective}` : '']
    .filter(Boolean)
    .join('\n\n')
  const summarizerMemoryContext = memoryPack.summarizerContext

  // 创建章节生成契约
  const contract = createChapterContract({
    projectId,
    chapterNo,
    targetWordCount: chapterTargetWordCount,
    mode: speedMode,
  })

  // 上报进度：开始生成
  emitProgress(emit, 'chapter_contract', chapterNo, totalChapters, completedChaptersCount, 0, chapterTargetWordCount, `开始生成第 ${chapterNo} 章`)

  const existingChapter = await prisma.novelChapter.findUnique({
    where: { projectId_chapterNumber: { projectId, chapterNumber: chapterNo } },
    select: { id: true, status: true, content: true, wordCount: true },
  })

  if (
    existingChapter &&
    !forceRegenerate &&
    (
      existingChapter.status === ChapterStatus.COMPLETED ||
      (
        existingChapter.status === ChapterStatus.REVIEWING &&
        (Boolean(existingChapter.content?.trim()) || (existingChapter.wordCount || 0) > 0)
      )
    )
  ) {
    return {
      success: true,
      chapterId: existingChapter.id,
      content: existingChapter.content || '',
    }
  }

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
      emitProgress(emit, 'failed', chapterNo, totalChapters, completedChaptersCount, 0, chapterTargetWordCount, blocked.message || 'Hook 阻断了生成流程')
      return { success: false, chapterId: chapter.id, error: blocked.message || 'Hook 阻断了生成流程' }
    }
    const warnings = startResults.filter(r => r.action === 'warn')
    if (warnings.length > 0) {
      emit({ type: 'hook_warning', data: { warnings: warnings.map(w => w.message) } })
    }

    // ========== Phase 1: 策划 Agent ==========
    let outline!: ChapterOutline

    if (isRetry) {
      const retryChapter = await prisma.novelChapter.findUnique({
        where: { id: chapter.id },
        select: { title: true, summary: true, chapterOutline: true },
      })
      outline = buildSeedOutlineFromChapterState(chapterNo, retryChapter)
    } else if (speedMode === 'FAST_ACCEPTANCE') {
      outline = buildSeedOutlineFromChapterState(chapterNo, chapter)
    } else {
      await runPhase('planner', async () => {
        emitProgress(emit, 'planning', chapterNo, totalChapters, completedChaptersCount, 0, chapterTargetWordCount, '正在构建章节大纲')
        emit({ type: 'start', data: { chapterId: chapter.id, agent: 'planner' } })

        const plannerHeartbeat = startPhaseHeartbeat(emit, 'planning', chapterNo, totalChapters, completedChaptersCount, 0, chapterTargetWordCount, '正在构建章节大纲…')
        const plannerResult = await plannerAgent({
          projectId,
          chapterNo,
          projectTitle: project.title,
          genre: project.genre || undefined,
          writingStyle: project.writingStyle || undefined,
          memoryContext: plannerMemoryContext,
          worldSetting: project.worldSetting || undefined,
          powerSystem: project.powerSystem || undefined,
          protagonistProfile: project.protagonistProfile || undefined,
          antagonistSetting: project.antagonistSetting || undefined,
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

        plannerHeartbeat.stop()
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

    if (speedMode === 'FAST_ACCEPTANCE') {
      await prisma.novelChapter.update({
        where: { id: chapter.id },
        data: {
          chapterOutline: outline as unknown as Prisma.InputJsonValue,
          lastAgentType: 'WRITER',
        },
      })
    }

    // 更新契约标题和摘要
    if (outline.chapterTitle) {
      contract.expectedTitle = outline.chapterTitle
    }
    if (outline.chapterGoal) {
      contract.expectedSummary = outline.chapterGoal
    }

    // ========== Phase 1.5: 研究资料 ==========
    if (memoryPack.researchRefs.length > 0) {
      emit({ type: 'research', data: { refsCount: memoryPack.researchRefs.length } })
    }

    // ========== Phase 2: 写作 Agent ==========
    let draftContent = ''

    await runPhase('writer', async () => {
      emitProgress(emit, 'writing', chapterNo, totalChapters, completedChaptersCount, 0, chapterTargetWordCount, '正在生成正文内容')
      emit({ type: 'agent_switch', data: { agent: 'writer' } })

      await writerAgent(
        {
          projectId,
          chapterNo,
          projectTitle: project.title,
          genre: project.genre || undefined,
          writingStyle: project.writingStyle || undefined,
          memoryContext: writerMemoryContext,
          worldSetting: project.worldSetting || undefined,
          powerSystem: project.powerSystem || undefined,
          protagonistProfile: project.protagonistProfile || undefined,
          antagonistSetting: project.antagonistSetting || undefined,
          targetWordCount: chapterTargetWordCount,
          outline,
          characterProfiles: memoryPack.characterProfiles,
          recentSummaries: memoryPack.recentChapterSummaries,
          provider: await getRoleProvider('writer'),
          maxTokens: estimateMaxTokensForTargetWordCount(chapterTargetWordCount),
          popularFictionProfile,
          styleProfilePromptCard,
          styleStrength: project.styleStrength,
          styleSafetyMode: (project.styleSafetyMode as 'SAFE_ABSTRACT' | 'STRICT_PUBLIC_DOMAIN' | 'USER_LICENSED') || 'SAFE_ABSTRACT',
          characterVoices,
        },
        (token) => {
          draftContent += token
          emit({ type: 'token', data: { content: token } })
          const currentWordCount = countChineseWords(draftContent)
          if (currentWordCount >= lastReportedWordCount + 120) {
            lastReportedWordCount = currentWordCount
            emit({ type: 'wordCount', data: { count: currentWordCount } })
            // 上报实时字数进度
            emitProgress(emit, 'writing', chapterNo, totalChapters, completedChaptersCount, currentWordCount, chapterTargetWordCount, `正在生成正文：${currentWordCount} 字`)
          }
        }
      )
    })

    const draftWordCount = countChineseWords(draftContent)
    // 启发式推断 finishReason：字数不足预期 80% 则认为被截断
    const inferredFinishReason: 'stop' | 'length' = draftWordCount < chapterTargetWordCount * 0.8 ? 'length' : 'stop'
    emitProgress(emit, 'writing', chapterNo, totalChapters, completedChaptersCount, draftWordCount, chapterTargetWordCount, `正文生成完成：${draftWordCount} 字`)

    // ========== Phase 3 + 7: 润色 + 摘要 并行 ==========
    let polishedContent = draftContent
    let summaryData!: ChapterSummaryData

    if (speedMode === 'FINAL_POLISH') {
      emit({ type: 'agent_switch', data: { agent: 'polisher_summarizer' } })
      emitProgress(emit, 'polishing', chapterNo, totalChapters, completedChaptersCount, draftWordCount, chapterTargetWordCount, '正在润色和生成摘要')

      polishedContent = ''
      const [, sd] = await Promise.all([
        runPhase('polisher', async () => {
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
        }),
        runPhase('summarizer', async () => {
          const summarizerHeartbeat = startPhaseHeartbeat(emit, 'summarizing', chapterNo, totalChapters, completedChaptersCount, draftWordCount, chapterTargetWordCount, '正在生成摘要…')
          const sd = await summarizerAgent({
            projectId,
            chapterNo,
            chapterTitle: outline.chapterTitle,
            chapterContent: draftContent,
            memoryContext: summarizerMemoryContext,
            worldSetting: project.worldSetting || undefined,
            protagonistProfile: project.protagonistProfile || undefined,
            provider: await getRoleProvider('summarizer'),
          })
          summarizerHeartbeat.stop()
          await storyState.updateChapterProgress(projectId, chapterNo)
          return sd
        }),
      ])
      summaryData = sd
    } else {
      // FAST_ACCEPTANCE 模式只生成摘要
      await runPhase('summarizer', async () => {
        emit({ type: 'agent_switch', data: { agent: 'summarizer' } })

        const summarizerHeartbeat = startPhaseHeartbeat(emit, 'summarizing', chapterNo, totalChapters, completedChaptersCount, 0, chapterTargetWordCount, '正在生成摘要…')
        summaryData = await summarizerAgent({
          projectId,
          chapterNo,
          chapterTitle: outline.chapterTitle,
          chapterContent: draftContent,
          memoryContext: summarizerMemoryContext,
          worldSetting: project.worldSetting || undefined,
          protagonistProfile: project.protagonistProfile || undefined,
          provider: await getRoleProvider('summarizer'),
        })
        summarizerHeartbeat.stop()

        await storyState.updateChapterProgress(projectId, chapterNo)
      })
    }

    // ========== Phase 4: 对抗审稿 Agent ==========
    let reviewedContent = polishedContent
    let reviewResult: MultiReviewResult | null = null

    if (speedMode === 'FINAL_POLISH') {
      await runPhase('reviewer', async () => {
        const polishedWordCount = countChineseWords(polishedContent)
        emitProgress(emit, 'reviewing', chapterNo, totalChapters, completedChaptersCount, polishedWordCount, chapterTargetWordCount, '正在对抗审稿')
        emit({ type: 'agent_switch', data: { agent: 'reviewer' } })

        const reviewerHeartbeat = startPhaseHeartbeat(emit, 'reviewing', chapterNo, totalChapters, completedChaptersCount, polishedWordCount, chapterTargetWordCount, '正在对抗审稿…')
        try {
          reviewResult = await reviewerAgent(
            {
              projectId,
              content: polishedContent,
              genre: project.genre || undefined,
              targetAudience: project.targetAudience,
              chapterNo,
              worldSetting: project.worldSetting || undefined,
              provider: await getRoleProvider('reviewer'),
            }
          )

          if (reviewResult.criticalIssues.length > 0) {
            emit({
              type: 'hook_warning',
              data: {
                warnings: reviewResult.criticalIssues.map(issue => `[审稿] ${issue}`),
              },
            })
          }
        } catch (reviewError) {
          emit({
            type: 'hook_warning',
            data: {
              warnings: [`对抗审稿失败，已保留润色稿：${reviewError instanceof Error ? reviewError.message : '未知错误'}`],
            },
          })
          reviewedContent = polishedContent
        } finally {
          reviewerHeartbeat.stop()
        }
      })
    }

    // ========== Phase 5 + 6: 校验 + 去 AI 味 ==========
    let validationReport!: ValidatorValidationReport
    let finalContent = reviewedContent

    if (speedMode === 'FINAL_POLISH') {
      emitProgress(emit, 'validating', chapterNo, totalChapters, completedChaptersCount, countChineseWords(reviewedContent), chapterTargetWordCount, '正在校验和去 AI 味')
      emit({ type: 'agent_switch', data: { agent: 'validator_deslopper' } })

      const reviewedWordCount = countChineseWords(reviewedContent)
      const validatorHeartbeat = startPhaseHeartbeat(emit, 'validating', chapterNo, totalChapters, completedChaptersCount, reviewedWordCount, chapterTargetWordCount, '正在校验和去 AI 味…')

      const [validReport, deslopContent] = await Promise.all([
        runPhase('validator', async () => {
          return validatorAgent({
            projectId,
            chapterNo,
            newChapterContent: reviewedContent,
            characterProfiles: memoryPack.characterProfiles,
            recentSummaries: memoryPack.recentChapterSummaries,
            memoryContext: validatorMemoryContext,
            worldSetting: project.worldSetting || undefined,
            openPlotlines: memoryPack.openPlotlines,
            chapterTitle: outline.chapterTitle,
            chapterGoal: outline.chapterGoal,
            provider: await getRoleProvider('validator'),
            popularFictionProfile,
            characterVoices,
          })
        }),
        runPhase('deslopper', async () => {
          try {
            return await chapterDeslopper({
              projectId,
              chapterId: chapter.id,
              content: reviewedContent,
              provider: await getRoleProvider('deslopper'),
            })
          } catch (deslopError) {
            emit({
              type: 'hook_warning',
              data: {
                warnings: [
                  `去 AI 味失败，已保留润色稿：${deslopError instanceof Error ? deslopError.message : '未知错误'}`,
                ],
              },
            })
            return reviewedContent
          }
        }),
      ])

      validatorHeartbeat.stop()

      validationReport = validReport
      finalContent = typeof deslopContent === 'string' ? deslopContent : deslopContent.revisedContent

      if (validReport?.result === 'retry') {
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
              validationReport: validReport as unknown as Prisma.InputJsonValue,
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
          emitProgress(emit, 'failed', chapterNo, totalChapters, completedChaptersCount, failedWordCount, chapterTargetWordCount, `校验失败超过${MAX_RETRY_COUNT}次，已标记人工审核`)

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

        return runChapterGenerationPipeline(projectId, chapterNo, emit, { speedMode, _retryMemoryPack: memoryPack })
      }
    } else {
      validationReport = {
        result: 'skipped',
        score: -1,
        issues: [],
        characterUpdates: {},
        newPlotlines: [],
        resolvedPlotlines: [],
        qualityMetrics: {
          logicScore: -1,
          characterScore: -1,
          emotionScore: -1,
          styleScore: -1,
        },
      }
      reviewedContent = polishedContent
    }

    // ========== Phase 8: Quality Gate 质量门禁 ==========
    const qgWordCount = countChineseWords(finalContent)
    emitProgress(emit, 'quality_gate', chapterNo, totalChapters, completedChaptersCount, qgWordCount, chapterTargetWordCount, '正在运行质量门禁检查')
    const qualityGateHeartbeat = startPhaseHeartbeat(emit, 'quality_gate', chapterNo, totalChapters, completedChaptersCount, qgWordCount, chapterTargetWordCount, '正在运行质量门禁检查…')
    
    let qualityGateResult: QualityGateResult
    let continuityAuditResult: ContinuityAuditResult | null = null
    let repairAttempts = 0
    let contentToCheck = finalContent

    // 获取 writer provider 用于修复
    const writerProvider = await getRoleProvider('writer')

    while (repairAttempts <= MAX_REPAIR_ATTEMPTS) {
      continuityAuditResult = await auditChapterContinuityWithLLM({
        chapterNo,
        content: contentToCheck,
        anchor: memoryPack.continuityAnchor,
        provider: writerProvider,
        ragContext: memoryPack.ragContext?.context,
      })
      qualityGateResult = runQualityGate({
        content: contentToCheck,
        contract,
        finishReason: inferredFinishReason,
        continuityAudit: continuityAuditResult,
      })

      if (qualityGateResult.canSave) {
        emitProgress(emit, 'quality_gate', chapterNo, totalChapters, completedChaptersCount, countChineseWords(contentToCheck), chapterTargetWordCount, '质量门禁检查通过')
        break
      }

      if (repairAttempts >= MAX_REPAIR_ATTEMPTS || !qualityGateResult.needsRepair) {
        // 修复次数用尽，标记为待审核
        emit({
          type: 'quality_gate_failed',
          data: {
            errors: qualityGateResult.errors,
            message: `质量门禁未通过，已标记人工审核`,
          },
        })
        emitProgress(emit, 'failed', chapterNo, totalChapters, completedChaptersCount, countChineseWords(contentToCheck), chapterTargetWordCount, '质量门禁未通过，已标记人工审核')

        await prisma.novelChapter.update({
          where: { id: chapter.id },
          data: {
            content: contentToCheck,
            status: ChapterStatus.REVIEWING,
            wordCount: countChineseWords(contentToCheck),
            validationReport: {
              validationReport,
              continuityAudit: continuityAuditResult,
            } as unknown as Prisma.InputJsonValue,
            lastAgentType: 'VALIDATOR',
          },
        })

        return {
          success: true,
          chapterId: chapter.id,
          content: contentToCheck,
          error: '质量门禁未通过，已标记人工审核',
        }
      }

      // 需要修复
      const repairTypeLabel = qualityGateResult.needsRepair === 'expand' ? '扩写'
        : qualityGateResult.needsRepair === 'compress' ? '压缩'
        : qualityGateResult.needsRepair === 'continue' ? '续写'
        : '连续性修复'
      emitProgress(emit, 'repairing', chapterNo, totalChapters, completedChaptersCount, countChineseWords(contentToCheck), chapterTargetWordCount, `正在修复：${repairTypeLabel}`)

      let repairResult
      if (qualityGateResult.needsRepair === 'expand') {
        repairResult = await expandChapter({
          content: contentToCheck,
          targetWordCount: contract.targetWordCount,
          currentWordCount: countChineseWords(contentToCheck),
          chapterTitle: outline.chapterTitle,
          chapterNo,
          provider: writerProvider,
        })
      } else if (qualityGateResult.needsRepair === 'compress') {
        repairResult = await compressChapter({
          content: contentToCheck,
          targetWordCount: contract.targetWordCount,
          currentWordCount: countChineseWords(contentToCheck),
          chapterTitle: outline.chapterTitle,
          chapterNo,
          provider: writerProvider,
        })
      } else if (qualityGateResult.needsRepair === 'continue') {
        repairResult = await continueChapter({
          content: contentToCheck,
          targetWordCount: contract.targetWordCount,
          currentWordCount: countChineseWords(contentToCheck),
          chapterTitle: outline.chapterTitle,
          chapterNo,
          provider: writerProvider,
          // 传递完整上下文以便高质量续写
          chapterOutline: outline
            ? `章节目标：${outline.chapterGoal}\n主要冲突：${outline.mainConflict}\n结尾设计：${outline.ending || '无特定设计'}`
            : undefined,
          characterProfiles: memoryPack.characterProfiles
            .map(c => `【${c.name}】${c.role}: ${c.appearance || ''} ${c.personality || ''}`)
            .join('\n'),
          recentSummaries: memoryPack.recentChapterSummaries
            .map(s => `第${s.chapterNo}章：${s.summary}`)
            .join('\n'),
          previousChapterEnding: memoryPack.previousChapterEnding || undefined,
        })
      } else if (qualityGateResult.needsRepair === 'rewrite' && continuityAuditResult?.rewriteInstruction) {
        // 合并连续性问题和审稿意见
        const rewriteParts = [continuityAuditResult.rewriteInstruction]
        const currentReview = reviewResult as MultiReviewResult | null

        if (currentReview && currentReview.criticalIssues.length > 0) {
          rewriteParts.push('\n## 审稿发现的严重问题')
          rewriteParts.push(currentReview.criticalIssues.map(issue => `- ${issue}`).join('\n'))
        }

        if (currentReview && currentReview.improvementPriority.length > 0) {
          const topSuggestions = currentReview.improvementPriority.slice(0, 5)
          rewriteParts.push('\n## 审稿改进建议（按优先级）')
          rewriteParts.push(topSuggestions.map(s => `- ${s}`).join('\n'))
        }

        repairResult = await rewriteChapter({
          content: contentToCheck,
          rewriteInstruction: rewriteParts.join('\n'),
          chapterTitle: outline.chapterTitle,
          chapterNo,
          provider: writerProvider,
          previousChapterEnding: memoryPack.previousChapterEnding || undefined,
          chapterOutline: outline
            ? `章节目标：${outline.chapterGoal}\n主要冲突：${outline.mainConflict}\n结尾设计：${outline.ending || '无特定设计'}`
            : undefined,
          characterProfiles: memoryPack.characterProfiles
            .map(c => `【${c.name}】${c.role}: ${c.appearance || ''} ${c.personality || ''}`)
            .join('\n'),
        })
      }

      if (repairResult?.success) {
        contentToCheck = repairResult.content
        finalContent = repairResult.content
        emitProgress(emit, 'repairing', chapterNo, totalChapters, completedChaptersCount, countChineseWords(contentToCheck), chapterTargetWordCount, `修复完成：${countChineseWords(contentToCheck)} 字`)
      }

      repairAttempts++
    }

    qualityGateHeartbeat.stop()
    finalContent = contentToCheck
    const continuitySnapshot = buildChapterContinuitySnapshot({
      chapterNo,
      content: finalContent,
      anchor: memoryPack.continuityAnchor,
    })

    const completionReport = buildChapterCompletionReport({
      content: finalContent,
      targetWordCount: contract.targetWordCount,
      outline,
      mainConflict: outline.mainConflict || memoryPack.storyState?.mainConflict,
      previousMainConflict: undefined,
    })

    const progressRatio = totalChapters > 0 ? chapterNo / totalChapters : 0
    const contentValidationResult = validateChapterContent({
      chapterNumber: chapterNo,
      title: outline.chapterTitle,
      content: finalContent,
      progressRatio,
      finalBossNames: villains.filter(v => v.isFinalBoss).map(v => v.name),
      protectedVillainNames: villains.filter(v => v.tier === 'arc' && v.lifecycle === 'active').map(v => v.name),
      openPlotlines: memoryPack.openPlotlines.map(p => ({
        description: p.description,
        plannedAt: null,
        plantedAt: null,
        status: 'OPEN',
      })),
    })

    if (contentValidationResult.shouldReroll) {
      emit({
        type: 'quality_gate_failed',
        data: {
          errors: [contentValidationResult.violations.join('; ')],
          message: '正文内容稳定性校验未通过，疑似过早收束',
        },
      })

      await prisma.novelChapter.update({
        where: { id: chapter.id },
        data: {
          content: finalContent,
          status: ChapterStatus.REVIEWING,
          wordCount: countChineseWords(finalContent),
          lastAgentType: 'VALIDATOR',
        },
      })

      emitProgress(emit, 'failed', chapterNo, totalChapters, completedChaptersCount, countChineseWords(finalContent), chapterTargetWordCount, '正文稳定性校验未通过，已标记人工审核')

      return {
        success: true,
        chapterId: chapter.id,
        content: finalContent,
        error: '正文稳定性校验未通过，疑似过早收束，已标记人工审核',
      }
    }

    if (!contentValidationResult.passed) {
      emit({
        type: 'hook_warning',
        data: {
          warnings: [...contentValidationResult.warnings, ...contentValidationResult.violations.slice(0, 3)],
        },
      })
    }

    const ruleFantasyResult = runRuleFantasyValidator({
      chapterNo,
      content: finalContent,
      outline,
      validationReport: validationReport as unknown as EngineValidationReport,
      cheatUsage: outline.cheatUsage ? {
        chapterNo,
        abilityName: outline.cheatUsage,
        costDescription: outline.forbiddenMistakes?.[0] ?? '未记录具体代价',
        markValueChange: 5,
        backlashValueChange: 2,
        cooldownUntilChapter: null,
      } : null,
      cheatAbilityUnlockedAbilities: cheatState ? (Array.isArray(cheatState.unlockedAbilities) ? (cheatState.unlockedAbilities as unknown as string[]) : []) : [],
      cheatAbilityCooldownUntilChapter: cheatState?.cooldownActiveUntilChapter ?? null,
      popularFiction: popularFictionProfile ? scorePopularFictionChapter({ content: finalContent, outline, profile: popularFictionProfile }) : null,
    })

    if (completionReport.completionScore < 80 || !ruleFantasyResult.passed) {
      const completionIssues = completionReport.issues.map(issue => issue.message)
      const ruleIssues = ruleFantasyResult.findings.map(finding => finding.message)

      await prisma.novelChapter.update({
        where: { id: chapter.id },
        data: {
          content: finalContent,
          status: ChapterStatus.REVIEWING,
          wordCount: countChineseWords(finalContent),
          completionReport: {
            completionReport,
            ruleFantasyResult,
          } as unknown as Prisma.InputJsonValue,
          lastAgentType: 'VALIDATOR',
        },
      })

      await prisma.chapterCompletionReport.upsert({
        where: {
          projectId_chapterNo: {
            projectId,
            chapterNo,
          },
        },
        update: {
          actualWordCount: completionReport.actualWordCount,
          targetWordCount: completionReport.targetWordCount,
          chapterGoalCompleted: completionReport.chapterGoalCompleted,
          mainConflictProgressed: completionReport.mainConflictProgressed,
          mainConflictResolved: completionReport.mainConflictResolved,
          endingHookExists: completionReport.endingHookExists,
          abruptTruncationDetected: completionReport.abruptTruncationDetected,
          completionScore: completionReport.completionScore,
          issues: completionReport.issues as unknown as Prisma.InputJsonValue,
        },
        create: {
          projectId,
          chapterNo,
          actualWordCount: completionReport.actualWordCount,
          targetWordCount: completionReport.targetWordCount,
          chapterGoalCompleted: completionReport.chapterGoalCompleted,
          mainConflictProgressed: completionReport.mainConflictProgressed,
          mainConflictResolved: completionReport.mainConflictResolved,
          endingHookExists: completionReport.endingHookExists,
          abruptTruncationDetected: completionReport.abruptTruncationDetected,
          completionScore: completionReport.completionScore,
          issues: completionReport.issues as unknown as Prisma.InputJsonValue,
        },
      })

      emit({
        type: 'quality_gate_failed',
        data: {
          message: '章节完成度或规则玄幻校验未通过，不允许自动进入下一章',
          completionReport,
          ruleFantasyResult,
          errors: [...completionIssues, ...ruleIssues],
        },
      })

      emitProgress(emit, 'failed', chapterNo, totalChapters, completedChaptersCount, completionReport.actualWordCount, chapterTargetWordCount, '章节完成度或规则玄幻校验未通过，已标记人工审核')

      return {
        success: true,
        chapterId: chapter.id,
        content: finalContent,
        error: '章节完成度或规则玄幻校验未通过，已标记人工审核',
      }
    }

    // Quality Gate 通过，保存章节
    emitProgress(emit, 'committing', chapterNo, totalChapters, completedChaptersCount, countChineseWords(finalContent), chapterTargetWordCount, '正在保存章节到数据库')
    
    const finalWordCount = countChineseWords(finalContent)
    const minimumWordCount = getMinimumChapterWordCount(project.chapterWordCount || 3000, chapterNo)
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
        continuityAudit: continuityAuditResult,
        continuitySnapshot,
        qualityStatus: 'completed',
        warning: undefined,
        targetWordCount: project.chapterWordCount || 3000,
        currentWordCount: finalWordCount,
        emotionalValue,
        agentType: speedMode === 'FINAL_POLISH' ? 'POLISHER' : 'WRITER',
        emittedAt: new Date().toISOString(),
      }, 'pipeline')

      // 章节生成完成通知（fire-and-forget）
      notifyChapterGenerated(projectId, project.title, chapterNo, outline.chapterTitle).catch(() => {})

      await prisma.chapterCompletionReport.upsert({
        where: {
          projectId_chapterNo: {
            projectId,
            chapterNo,
          },
        },
        update: {
          actualWordCount: completionReport.actualWordCount,
          targetWordCount: completionReport.targetWordCount,
          chapterGoalCompleted: completionReport.chapterGoalCompleted,
          mainConflictProgressed: completionReport.mainConflictProgressed,
          mainConflictResolved: completionReport.mainConflictResolved,
          endingHookExists: completionReport.endingHookExists,
          abruptTruncationDetected: completionReport.abruptTruncationDetected,
          completionScore: completionReport.completionScore,
          issues: completionReport.issues as unknown as Prisma.InputJsonValue,
        },
        create: {
          projectId,
          chapterNo,
          actualWordCount: completionReport.actualWordCount,
          targetWordCount: completionReport.targetWordCount,
          chapterGoalCompleted: completionReport.chapterGoalCompleted,
          mainConflictProgressed: completionReport.mainConflictProgressed,
          mainConflictResolved: completionReport.mainConflictResolved,
          endingHookExists: completionReport.endingHookExists,
          abruptTruncationDetected: completionReport.abruptTruncationDetected,
          completionScore: completionReport.completionScore,
          issues: completionReport.issues as unknown as Prisma.InputJsonValue,
        },
      })

      if (outline.cheatUsage) {
        await appendCheatUsage(projectId, {
          chapterNo,
          abilityName: outline.cheatUsage,
          costDescription: outline.forbiddenMistakes?.[0] ?? '未记录具体代价',
          markValueChange: 5,
          backlashValueChange: 2,
          cooldownUntilChapter: null,
        })
      }

      const matchedArcEvent = arcEvents.find(event => finalContent.includes(event.eventDescription.slice(0, 8)))
      if (matchedArcEvent) {
        await advanceArcEvent(projectId, matchedArcEvent.eventKey, 'completed', chapterNo, `在第${chapterNo}章推进完成`)
      }

      await hookRegistry.execute('chapter_generate_end', {
        projectId,
        chapterNo,
        content: finalContent,
      })

      await updateWorldStateAfterChapter(projectId, finalContent).catch(() => {})
    })

    // 章节完成
    const newCompletedCount = completedChaptersCount + 1
    emitProgress(emit, 'completed', chapterNo, totalChapters, newCompletedCount, finalWordCount, chapterTargetWordCount, `第 ${chapterNo} 章生成完成`)
    emit({
      type: 'chapter_completed',
      data: {
        chapterId: chapter.id,
        chapterNo,
        wordCount: finalWordCount,
        completedChapters: newCompletedCount,
        totalChapters,
      },
    })

    emit({
      type: 'done',
      data: {
        chapterId: chapter.id,
        wordCount: finalWordCount,
        minimumWordCount,
        qualityStatus: 'completed',
        duration: Date.now() - startTime,
      },
    })

    return {
      success: true,
      chapterId: chapter.id,
      content: finalContent,
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

    // 流水线失败通知（fire-and-forget）
    notifyPipelineFailed(projectId, project.title, errorMessage).catch(() => {})
    emitProgress(emit, 'failed', chapterNo, totalChapters, completedChaptersCount, 0, chapterTargetWordCount, `生成失败：${errorMessage}`)

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
export async function getChapterGenerationStatus(projectId: number, chapterNo: number) {
  const chapter = await prisma.novelChapter.findUnique({
    where: { projectId_chapterNumber: { projectId, chapterNumber: chapterNo } },
  })

  return {
    chapterNo,
    status: chapter?.status || 'DRAFT',
    wordCount: chapter?.wordCount || 0,
    title: chapter?.title || `第${chapterNo}章`,
    summary: chapter?.summary || '',
    lastAgentType: chapter?.lastAgentType || null,
    updatedAt: chapter?.updatedAt || null,
  }
}

function formatStyleSection(data: Record<string, unknown>, key: string): string {
  const value = data[key]
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.filter(item => typeof item === 'string').join('\n')
  return ''
}
