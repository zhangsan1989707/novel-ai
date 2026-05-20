import { prisma } from '@/lib/prisma'
import { createProviderFromConfigId, createProviderFromDefaultConfig } from '@/lib/ai/factory'
import type { AIProvider } from '@/lib/ai/types'
import type { PipelineStep } from '@/types'
import { calculateBatchSize } from './batch-planner'
import { completeJob, failJob, saveCheckpoint, updateJobRuntime, updateJobStep } from './generation-job'
import { validateAndWarn } from './long-novel-controller'
import { toInternalArcStage, toInternalPlatform, toPrismaArcStage } from './production-mapping'
import { runChapterGenerationPipeline } from './orchestrator'
import { parseAiJsonArray, parseAiJsonObject } from './ai-json'
import { buildChapterListPrompt } from '../prompts/novel/chapter-list'
import { archiveChapterRuntime, createPipelineRuntimeState, sanitizePipelineRuntime } from './pipeline-runtime'
import { initStoryState, initWorldState } from './story-state'
import { loadProjectHealthReport } from './project-health'
import { syncProjectHealthNotification } from '@/lib/notifications/project-health'
import type { SSEEvent } from './types'

type ChapterOutline = {
  chapterNumber: number
  title: string
  summary: string
}

type BlueprintOutput = {
  corePitch?: string
  worldDirection?: string
  mainlineDirection?: string
  growthDirection?: string
  endingDirection?: string
  constraints?: string[]
}

type ArcPlanOutput = {
  arcNumber?: number
  name?: string
  stage?: string
  description?: string
  startChapter?: number
  endChapter?: number
  batchSize?: number
  goals?: string[]
  keyEvents?: string[]
}

export async function createProjectProvider(projectId: number): Promise<AIProvider> {
  const project = await prisma.novelProject.findUnique({
    where: { id: projectId },
    select: { aiModelId: true },
  })

  if (project?.aiModelId) {
    const provider = await createProviderFromConfigId(project.aiModelId)
    if (provider) return provider
  }

  return createProviderFromDefaultConfig()
}

export async function ensureBlueprint(projectId: number, provider: AIProvider) {
  const existing = await prisma.bookBlueprint.findUnique({ where: { projectId } })
  if (existing) return existing

  const project = await prisma.novelProject.findUnique({ where: { id: projectId } })
  if (!project) throw new Error('项目不存在')

  const prompt = `你是 AI 网文导演系统的总策划。请生成 Book Blueprint，只定义长篇方向，不要生成完整章节。

项目信息：
- 标题：${project.title}
- 平台：${project.platform || 'QIDIAN'}
- 题材：${project.genre || '未知'}
- 一句话卖点：${project.corePitch || project.description || '暂无'}
- 风格：${project.writingStyle || '默认'}
- 长度类型：${project.lengthType || 'LONG'}

输出 JSON，不要 markdown：
{
  "corePitch": "重新提炼的一句话卖点",
  "worldDirection": "世界扩张方向，包含地图、势力、力量层级",
  "mainlineDirection": "主线推进方向，强调长期矛盾而非提前收束",
  "growthDirection": "主角成长方向",
  "endingDirection": "远景终局可能性，只能作为远景，不决定近期结局",
  "constraints": ["禁止提前大结局", "当前阶段只解决阶段矛盾"]
}`

  const result = await provider.generate(prompt, {
    temperature: 0.2,
    maxTokens: 2000,
    timeoutMs: 120000,
    responseFormat: { type: 'json_object' },
  })
  let blueprint: BlueprintOutput
  try {
    blueprint = parseAiJsonObject<BlueprintOutput>(result.content)
  } catch (error) {
    const retryPrompt = `${prompt}\n\n上一次输出未严格符合 JSON。请只输出一个合法 JSON 对象，不要解释，不要代码块，不要多余文本。`
    const retry = await provider.generate(retryPrompt, {
      temperature: 0.1,
      maxTokens: 1200,
      timeoutMs: 120000,
      responseFormat: { type: 'json_object' },
    })
    try {
      blueprint = parseAiJsonObject<BlueprintOutput>(retry.content)
    } catch {
      throw new Error(`Blueprint 生成失败：${error instanceof Error ? error.message : 'JSON 解析失败'}`)
    }
  }
  const data = {
    corePitch: blueprint.corePitch || project.corePitch || project.description || project.title,
    worldDirection: blueprint.worldDirection || '',
    mainlineDirection: blueprint.mainlineDirection || '',
    growthDirection: blueprint.growthDirection || '',
    endingDirection: blueprint.endingDirection || '',
    constraints: Array.isArray(blueprint.constraints) ? blueprint.constraints : [],
  }

  return prisma.bookBlueprint.create({ data: { projectId, ...data } })
}

export async function ensureArcPlans(projectId: number, provider: AIProvider) {
  const existing = await prisma.arcPlan.findMany({ where: { projectId }, orderBy: { arcNumber: 'asc' } })
  if (existing.length > 0) return existing

  const project = await prisma.novelProject.findUnique({
    where: { id: projectId },
    include: { bookBlueprint: true },
  })
  if (!project || !project.bookBlueprint) throw new Error('Book Blueprint 不存在')

  const totalChapters = Math.max(1, Math.ceil((project.targetWordCount || 300000) / (project.chapterWordCount || 3000)))
  const stages = ['OPENING', 'GROWTH', 'EXPANSION', 'MID_CONFLICT', 'PRE_FINALE', 'FINALE']
  const chaptersPerStage = Math.ceil(totalChapters / stages.length)
  const platform = toInternalPlatform(project.platform)

  const prompt = `你是 AI 网文导演系统的阶段规划 Agent。请基于 Book Blueprint 生成 Arc Plan。

要求：
- 只规划阶段，不要列出全书所有章节
- 前 85% 进度不得出现最终决战、大结局、天下太平、一切结束
- 每个 Arc 都要保留后续扩张空间
- batchSize 范围 10-30

项目信息：
- 标题：${project.title}
- 平台：${project.platform || 'QIDIAN'}
- 题材：${project.genre || '未知'}
- 总章数：约 ${totalChapters} 章
- 每阶段约 ${chaptersPerStage} 章

Book Blueprint：
- 核心卖点：${project.bookBlueprint.corePitch}
- 世界方向：${project.bookBlueprint.worldDirection || ''}
- 主线方向：${project.bookBlueprint.mainlineDirection || ''}
- 成长方向：${project.bookBlueprint.growthDirection || ''}
- 远景终局：${project.bookBlueprint.endingDirection || ''}

输出 JSON 数组，不要 markdown。stage 只能是 OPENING, GROWTH, EXPANSION, MID_CONFLICT, PRE_FINALE, FINALE：
[
  {
    "arcNumber": 1,
    "name": "阶段名称",
    "stage": "OPENING",
    "description": "阶段描述",
    "startChapter": 1,
    "endChapter": ${chaptersPerStage},
    "batchSize": ${calculateBatchSize(platform, 'opening', 0.5, 0.5)},
    "goals": ["阶段目标"],
    "keyEvents": ["关键事件"]
  }
]`

  const result = await provider.generate(prompt, {
    temperature: 0.2,
    maxTokens: 5000,
    timeoutMs: 120000,
    responseFormat: { type: 'json_object' },
  })
  let arcPlans: ArcPlanOutput[]
  try {
    arcPlans = parseAiJsonArray<ArcPlanOutput>(result.content)
  } catch (error) {
    const retryPrompt = `${prompt}\n\n上一次输出未严格符合 JSON 数组。请只输出一个合法 JSON 数组，不要解释，不要代码块，不要多余文本。`
    const retry = await provider.generate(retryPrompt, {
      temperature: 0.1,
      maxTokens: 3000,
      timeoutMs: 120000,
      responseFormat: { type: 'json_object' },
    })
    try {
      arcPlans = parseAiJsonArray<ArcPlanOutput>(retry.content)
    } catch {
      throw new Error(`ArcPlan 生成失败：${error instanceof Error ? error.message : 'JSON 解析失败'}`)
    }
  }
  const created = []

  for (let index = 0; index < arcPlans.length; index++) {
    const item = arcPlans[index]
    const arcNumber = item.arcNumber || index + 1
    const stage = toInternalArcStage(item.stage || stages[index] || 'OPENING')
    const defaultBatchSize = calculateBatchSize(platform, stage, 0.5, 0.5)
    created.push(await prisma.arcPlan.create({
      data: {
        projectId,
        arcNumber,
        name: item.name || `第${arcNumber}阶段`,
        stage: toPrismaArcStage(stage) as any,
        description: item.description || '',
        startChapter: item.startChapter || (index * chaptersPerStage + 1),
        endChapter: item.endChapter || Math.min(totalChapters, (index + 1) * chaptersPerStage),
        batchSize: Math.max(10, Math.min(30, item.batchSize || defaultBatchSize)),
        goals: Array.isArray(item.goals) ? item.goals : [],
        keyEvents: Array.isArray(item.keyEvents) ? item.keyEvents : [],
      },
    }))
  }

  return created
}

async function planChapterBatch(projectId: number, provider: AIProvider): Promise<ChapterOutline[]> {
  const project = await prisma.novelProject.findUnique({
    where: { id: projectId },
    include: {
      bookBlueprint: true,
      arcPlans: { orderBy: { arcNumber: 'asc' } },
      chapters: { orderBy: { chapterNumber: 'asc' } },
      worldState: true,
    },
  })
  if (!project || !project.bookBlueprint) throw new Error('项目 Blueprint 不完整')

  const existingMaxChapter = project.chapters.reduce((max, chapter) => Math.max(max, chapter.chapterNumber), 0)
  const nextChapterNumber = existingMaxChapter + 1
  const currentArc =
    project.arcPlans.find(arc => {
      const arcEnd = arc.endChapter || Number.MAX_SAFE_INTEGER
      return nextChapterNumber >= arc.startChapter && nextChapterNumber <= arcEnd
    }) ||
    project.arcPlans.find(arc => !arc.isCompleted) ||
    project.arcPlans[0]
  if (!currentArc) throw new Error('Arc Plan 不存在')

  const startChapter = Math.max(nextChapterNumber, currentArc.startChapter)
  const endLimit = currentArc.endChapter || startChapter + currentArc.batchSize - 1
  const endChapter = Math.min(endLimit, startChapter + currentArc.batchSize - 1)
  if (startChapter > endLimit) return []

  const totalChapters = Math.max(1, Math.ceil((project.targetWordCount || 300000) / (project.chapterWordCount || 3000)))
  const progressRatio = startChapter / totalChapters
  const arcStage = toInternalArcStage(currentArc.stage)
  const worldState = project.worldState
    ? `地图层级 ${project.worldState.mapLevel}/10，势力 ${project.worldState.factionCount}，力量上限 ${project.worldState.powerLevel}/10，文明层级 ${project.worldState.civilizationLevel}/10`
    : '世界状态未初始化，需要在当前批次逐步扩张'

  const existingChapters = project.chapters
    .filter(chapter => chapter.chapterNumber < startChapter)
    .map(chapter => ({
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      summary: chapter.summary || chapter.title || `第${chapter.chapterNumber}章`,
    }))

  const prompt = buildChapterListPrompt({
    projectTitle: project.title,
    genre: project.genre || undefined,
    writingStyle: project.writingStyle || undefined,
    worldSetting: [
      project.worldSetting || '',
      `【当前 Arc】${currentArc.name} / ${arcStage}`,
      `【Arc 目标】${currentArc.goals.join('、') || '推进阶段目标'}`,
      `【关键事件】${currentArc.keyEvents.join('、') || '由 AI 决定'}`,
      `【世界状态】${worldState}`,
      `【当前全书进度】${Math.round(progressRatio * 100)}%`,
      `【Book Blueprint】核心卖点：${project.bookBlueprint.corePitch}\n世界方向：${project.bookBlueprint.worldDirection || ''}\n主线方向：${project.bookBlueprint.mainlineDirection || ''}`,
    ].filter(Boolean).join('\n\n'),
    protagonistProfile: project.protagonistProfile || undefined,
    protagonistGoal: project.protagonistGoal || undefined,
    antagonistSetting: project.antagonistSetting || undefined,
    endingPlan: project.endingPlan || undefined,
    totalChapters: endChapter,
    titleStyle: 'webnovel',
    outline: undefined,
    outlineStages: undefined,
    existingChapters,
  })

  const result = await provider.generate(prompt, {
    temperature: 0.2,
    maxTokens: 8000,
    timeoutMs: 120000,
    responseFormat: { type: 'json_object' },
  })
  let outlines: ChapterOutline[]
  try {
    const chapterList = parseAiJsonObject<{ chapters?: ChapterOutline[] }>(result.content)
    outlines = Array.isArray(chapterList.chapters) ? chapterList.chapters : []
  } catch (error) {
    const retryPrompt = `${prompt}\n\n上一次输出未严格符合 JSON 结构。请只输出一个合法 JSON 对象，且其中的 chapters 数组必须严格包含 ${endChapter - startChapter + 1} 章，从第 ${startChapter} 章到第 ${endChapter} 章连续编号，不要解释，不要代码块，不要多余文本。`
    const retry = await provider.generate(retryPrompt, {
      temperature: 0.1,
      maxTokens: 8000,
      timeoutMs: 120000,
      responseFormat: { type: 'json_object' },
    })
    try {
      const chapterList = parseAiJsonObject<{ chapters?: ChapterOutline[] }>(retry.content)
      outlines = Array.isArray(chapterList.chapters) ? chapterList.chapters : []
    } catch {
      throw new Error(`章节目录生成失败：${error instanceof Error ? error.message : 'JSON 解析失败'}`)
    }
  }
  outlines = outlines
    .filter(item => item.chapterNumber >= startChapter && item.chapterNumber <= endChapter)
    .map(item => ({
      chapterNumber: item.chapterNumber,
      title: item.title || `第${item.chapterNumber}章`,
      summary: item.summary || item.title || `第${item.chapterNumber}章剧情推进`,
    }))

  const expectedCount = endChapter - startChapter + 1
  if (outlines.length !== expectedCount) {
    const retryPrompt = `${prompt}\n\n上一次输出章数不匹配。你必须严格输出从第 ${startChapter} 章到第 ${endChapter} 章的连续章节，共 ${expectedCount} 章，且每章都必须有 title 和 summary。`
    const retry = await provider.generate(retryPrompt, {
      temperature: 0.1,
      maxTokens: 8000,
      timeoutMs: 120000,
      responseFormat: { type: 'json_object' },
    })
    try {
      const chapterList = parseAiJsonObject<{ chapters?: ChapterOutline[] }>(retry.content)
      const repaired = Array.isArray(chapterList.chapters) ? chapterList.chapters : []
      const normalized = repaired
        .filter(item => item.chapterNumber >= startChapter && item.chapterNumber <= endChapter)
        .map(item => ({
          chapterNumber: item.chapterNumber,
          title: item.title || `第${item.chapterNumber}章`,
          summary: item.summary || item.title || `第${item.chapterNumber}章剧情推进`,
        }))
      if (normalized.length === expectedCount) {
        outlines = normalized
      }
    } catch {
      // 保留第一次结果，交由后续校验兜底
    }
  }

  const validation = validateAndWarn(outlines, progressRatio)
  if (!validation.passed) {
    throw new Error(`当前批次目录触发防提前结局规则：${validation.violations.join('；')}`)
  }

  for (const outline of outlines) {
    await prisma.novelChapter.upsert({
      where: { projectId_chapterNumber: { projectId, chapterNumber: outline.chapterNumber } },
      update: {
        title: outline.title,
        summary: outline.summary,
        chapterOutline: outline as any,
        sortOrder: outline.chapterNumber,
      },
      create: {
        projectId,
        chapterNumber: outline.chapterNumber,
        title: outline.title,
        summary: outline.summary,
        chapterOutline: outline as any,
        sortOrder: outline.chapterNumber,
        status: 'DRAFT',
      },
    })
  }

  return outlines
}

async function markCompletedArcIfNeeded(projectId: number) {
  const arcs = await prisma.arcPlan.findMany({ where: { projectId }, orderBy: { arcNumber: 'asc' } })
  for (const arc of arcs) {
    if (!arc.endChapter || arc.isCompleted) continue
    const incomplete = await prisma.novelChapter.count({
      where: {
        projectId,
        chapterNumber: { gte: arc.startChapter, lte: arc.endChapter },
        status: { not: 'COMPLETED' },
      },
    })
    if (incomplete === 0) {
      await prisma.arcPlan.update({ where: { id: arc.id }, data: { isCompleted: true } })
    }
  }
}

export async function runProductionPipeline(jobId: number): Promise<void> {
  const job = await prisma.generationJob.findUnique({ where: { id: jobId } })
  if (!job) return

  const projectId = job.projectId
  const project = await prisma.novelProject.findUnique({
    where: { id: projectId },
    select: { chapterWordCount: true },
  })
  const targetWordCount = project?.chapterWordCount || 3000
  let runtime = sanitizePipelineRuntime(
    job.payload && typeof job.payload === 'object'
      ? (job.payload as Record<string, unknown>).runtime
      : undefined
  )
  if (runtime.streamRevision === 0 && runtime.currentChapter === null && runtime.recentChapters.length === 0) {
    runtime = createPipelineRuntimeState()
  }
  let lastPersistAt = 0
  let persistChain = Promise.resolve()

  const queuePersist = (force: boolean = false) => {
    const now = Date.now()
    if (!force && now - lastPersistAt < 900) return
    runtime = {
      ...runtime,
      lastEventAt: new Date(now).toISOString(),
      streamRevision: runtime.streamRevision + 1,
    }
    lastPersistAt = now
    persistChain = persistChain
      .then(() => updateJobRuntime(jobId, runtime))
      .catch(() => undefined)
  }

  const setCurrentChapter = (chapterNumber: number, title?: string) => {
    const now = new Date().toISOString()
    runtime = {
      ...runtime,
      currentChapter: {
        chapterNumber,
        title,
        status: 'RUNNING',
        currentAgent: 'planner',
        currentPhase: 'planner',
        currentWordCount: 0,
        targetWordCount,
        startedAt: now,
        updatedAt: now,
        phaseTimings: {},
      },
    }
    queuePersist(true)
  }

  const handlePipelineEvent = (event: SSEEvent) => {
    if (!runtime.currentChapter) return

    const now = new Date().toISOString()
    const current = { ...runtime.currentChapter, updatedAt: now }

    switch (event.type) {
      case 'start': {
        const agent = typeof event.data.agent === 'string' ? event.data.agent : current.currentAgent
        current.currentAgent = agent
        current.currentPhase = agent
        break
      }
      case 'agent_switch': {
        const agent = typeof event.data.agent === 'string' ? event.data.agent : current.currentAgent
        current.currentAgent = agent
        current.currentPhase = agent
        break
      }
      case 'research': {
        current.currentAgent = 'research'
        current.currentPhase = 'research'
        current.lastMessage = `已加载 ${Number(event.data.refsCount || 0)} 条研究资料`
        break
      }
      case 'wordCount': {
        const count = Number(event.data.count || 0)
        if (Number.isFinite(count)) {
          current.currentWordCount = count
          current.lastTokenAt = now
        }
        break
      }
      case 'phase_timing': {
        const phase = String(event.data.phase || '')
        const durationMs = Number(event.data.durationMs || 0)
        if (phase) {
          current.phaseTimings = {
            ...current.phaseTimings,
            [phase]: durationMs,
          }
          runtime.lastPhase = phase
          runtime.lastPhaseDurationMs = durationMs
          current.currentPhase = phase
          current.lastMessage = `${phase} 完成，用时 ${durationMs}ms`
        }
        break
      }
      case 'validation': {
        current.currentAgent = 'validator'
        current.currentPhase = 'validator'
        current.lastMessage = `校验结果：${String(event.data.result || 'unknown')} / ${Number(event.data.score || 0)}分`
        break
      }
      case 'hook_warning': {
        const warnings = Array.isArray(event.data.warnings) ? event.data.warnings.filter(item => typeof item === 'string') : []
        current.lastMessage = warnings.join('；')
        break
      }
      case 'done': {
        current.status = 'COMPLETED'
        current.currentWordCount = Number(event.data.wordCount || current.currentWordCount || 0)
        current.qualityStatus = typeof event.data.qualityStatus === 'string' ? event.data.qualityStatus : undefined
        current.warning = typeof event.data.warning === 'string' ? event.data.warning : undefined
        current.totalDurationMs = Number(event.data.duration || 0) || current.totalDurationMs
        current.completedAt = now
        current.currentPhase = 'completed'
        current.lastMessage = current.warning || '章节生成完成'
        break
      }
      case 'error': {
        current.status = 'FAILED'
        current.error = typeof event.data.message === 'string' ? event.data.message : '生成失败'
        current.currentPhase = 'failed'
        current.lastMessage = current.error
        break
      }
      default:
        break
    }

    runtime = {
      ...runtime,
      currentChapter: current,
    }

    const forcePersist = event.type === 'done' || event.type === 'error' || event.type === 'phase_timing'
    queuePersist(forcePersist)
  }

  try {
    const provider = await createProjectProvider(projectId)

    const project = await prisma.novelProject.findUnique({
      where: { id: projectId },
      select: { totalVolumes: true },
    })
    if (project) {
      await initWorldState(projectId)
      await initStoryState(projectId, project.totalVolumes * 25)
    }

    await updateJobStep(jobId, 'blueprint' as PipelineStep, 1)
    const blueprint = await ensureBlueprint(projectId, provider)
    await saveCheckpoint(jobId, 'blueprint' as PipelineStep, { projectId }, { blueprintId: blueprint.id })

    await updateJobStep(jobId, 'arc_plan' as PipelineStep, 2)
    const arcPlans = await ensureArcPlans(projectId, provider)
    await saveCheckpoint(jobId, 'arc_plan' as PipelineStep, { projectId }, { arcCount: arcPlans.length })

    await updateJobStep(jobId, 'chapter_list' as PipelineStep, 3)
    const outlines = await planChapterBatch(projectId, provider)
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { totalChapters: outlines.length },
    })
    await saveCheckpoint(jobId, 'chapter_list' as PipelineStep, { projectId }, { chapters: outlines })

    let completed = 0
    for (const outline of outlines) {
      await updateJobStep(jobId, 'write' as PipelineStep, 4, outlines.length, completed + 1)
      setCurrentChapter(outline.chapterNumber, outline.title)
      const result = await runChapterGenerationPipeline(projectId, outline.chapterNumber, handlePipelineEvent)
      await persistChain
      if (!result.success) {
        throw new Error(result.error || `第 ${outline.chapterNumber} 章生成失败`)
      }
      if (runtime.currentChapter) {
        runtime = archiveChapterRuntime(runtime, {
          ...runtime.currentChapter,
          title: runtime.currentChapter.title || outline.title,
        })
        queuePersist(true)
      }
      completed++
      await saveCheckpoint(
        jobId,
        'write' as PipelineStep,
        { chapterNumber: outline.chapterNumber },
        { chapterId: result.chapterId, completed }
      )
    }

    await updateJobStep(jobId, 'summarize' as PipelineStep, 8, outlines.length, completed)
    await markCompletedArcIfNeeded(projectId)
    await saveCheckpoint(jobId, 'summarize' as PipelineStep, { projectId }, { completedChapters: completed })
    await persistChain
    await completeJob(jobId)

    const report = await loadProjectHealthReport(projectId)
    if (report) {
      const project = await prisma.novelProject.findUnique({
        where: { id: projectId },
        select: { title: true },
      })
      if (project) {
        await syncProjectHealthNotification(projectId, project.title, report)
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await persistChain
    await failJob(jobId, message)

    const report = await loadProjectHealthReport(projectId)
    if (report) {
      const project = await prisma.novelProject.findUnique({
        where: { id: projectId },
        select: { title: true },
      })
      if (project) {
        await syncProjectHealthNotification(projectId, project.title, report)
      }
    }
  }
}
