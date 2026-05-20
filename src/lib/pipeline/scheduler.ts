import { prisma } from '@/lib/prisma'
import { runChapterGenerationPipeline } from '@/lib/engine/orchestrator'
import { detectAI, rewriteText } from '@/lib/anti-detect'
import type { SSEEvent } from '@/lib/engine/types'

export interface AutoPipelineOptions {
  projectId: number
  startChapter: number
  endChapter: number
  speedMode?: 'fast' | 'balanced' | 'quality'
  qualityGate?: {
    enabled: boolean
    maxAiScore: number
    maxRetries: number
    autoRewrite: boolean
  }
  onProgress?: (progress: PipelineProgress) => void
  onChapterDone?: (result: ChapterResult) => void
  signal?: AbortSignal
}

export interface PipelineProgress {
  jobId: number
  currentChapter: number
  totalChapters: number
  startChapter: number
  endChapter: number
  status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
  completedChapters: number
  failedChapters: number
  startTime: number
  elapsedMs: number
  currentStep: string
  total: number
  completed: number
  failed: number
  chapters: Array<{
    chapterNumber: number
    status: 'completed' | 'failed' | 'pending' | 'generating'
    error?: string
  }>
  startedAt: string
}

interface StoredPipelineOptions extends Omit<AutoPipelineOptions, 'signal' | 'onProgress' | 'onChapterDone'> {
  onProgress?: AutoPipelineOptions['onProgress']
  onChapterDone?: AutoPipelineOptions['onChapterDone']
}

interface AutoPipelineSession {
  options: StoredPipelineOptions
  progress: PipelineProgress
  results: ChapterResult[]
  jobId?: number
}

export interface ChapterResult {
  chapterNo: number
  success: boolean
  content?: string
  wordCount: number
  aiScore?: number
  rewritten?: boolean
  error?: string
  durationMs: number
}

class AutoPipelineScheduler {
  private sessions: Map<number, AutoPipelineSession> = new Map()

  private createProgress(jobId: number, startChapter: number, endChapter: number): PipelineProgress {
    const totalChapters = endChapter - startChapter + 1
    return {
      jobId,
      currentChapter: startChapter,
      totalChapters,
      startChapter,
      endChapter,
      status: 'running',
      completedChapters: 0,
      failedChapters: 0,
      startTime: Date.now(),
      elapsedMs: 0,
      currentStep: 'pending',
      total: totalChapters,
      completed: 0,
      failed: 0,
      chapters: Array.from({ length: totalChapters }, (_, index) => ({
        chapterNumber: startChapter + index,
        status: 'pending' as const,
      })),
      startedAt: new Date().toISOString(),
    }
  }

  private syncProgress(session: AutoPipelineSession, updates: Partial<PipelineProgress> = {}) {
    Object.assign(session.progress, updates)
    session.progress.completed = session.progress.completedChapters
    session.progress.failed = session.progress.failedChapters
    session.progress.total = session.progress.totalChapters
    session.progress.elapsedMs = Date.now() - session.progress.startTime
    session.progress.startedAt = new Date(session.progress.startTime).toISOString()
    session.options.onProgress?.({ ...session.progress })
  }

  async start(options: AutoPipelineOptions): Promise<ChapterResult[]> {
    const { projectId, startChapter, endChapter, speedMode = 'balanced', qualityGate, onProgress, onChapterDone } = options
    const existing = this.sessions.get(projectId)
    if (existing && existing.progress.status === 'running') {
      return existing.results
    }

    const totalChapters = endChapter - startChapter + 1
    const job = await prisma.generationJob.create({
      data: {
        projectId,
        type: 'AUTO_PIPELINE',
        status: 'RUNNING',
        totalChapters,
        currentChapter: startChapter,
        payload: { speedMode, qualityGateEnabled: !!qualityGate?.enabled },
      },
    }).catch(() => null)

    const session: AutoPipelineSession = {
      jobId: job?.id,
      options: { projectId, startChapter, endChapter, speedMode, qualityGate, onProgress, onChapterDone },
      progress: this.createProgress(job?.id || 0, startChapter, endChapter),
      results: [],
    }
    this.sessions.set(projectId, session)
    void this.runSession(session)
    return session.results
  }

  private async runSession(session: AutoPipelineSession): Promise<void> {
    const { projectId } = session.options
    const { speedMode = 'balanced', qualityGate } = session.options
    const { onChapterDone } = session.options
    const jobId = session.jobId

    const updateJob = async (data: Record<string, unknown>) => {
      if (!jobId) return
      await prisma.generationJob.update({ where: { id: jobId }, data: data as never }).catch(() => {})
    }

    let completed = session.progress.completedChapters
    let failed = session.progress.failedChapters

    for (let chapterNo = session.options.startChapter; chapterNo <= session.options.endChapter; chapterNo++) {
      if (session.progress.status === 'paused') {
        await updateJob({ status: 'PAUSED' })
        this.syncProgress(session)
        return
      }

      session.progress.currentChapter = chapterNo
      session.progress.currentStep = 'running'
      const chapterIndex = chapterNo - session.progress.startChapter
      if (chapterIndex >= 0 && chapterIndex < session.progress.chapters.length) {
        session.progress.chapters[chapterIndex] = {
          ...session.progress.chapters[chapterIndex],
          status: 'generating',
        }
      }
      this.syncProgress(session)

      const chapterStart = Date.now()
      try {
        const emit: (event: SSEEvent) => void = () => {}

        const genResult = await runChapterGenerationPipeline(projectId, chapterNo, emit, { speedMode })

        let finalContent = genResult.content || ''
        let aiScore: number | undefined
        let rewritten = false

        if (qualityGate?.enabled && finalContent && genResult.success) {
          const detectionResult = detectAI(finalContent)
          aiScore = detectionResult.overallScore

          let retries = 0
          while (aiScore > qualityGate.maxAiScore && retries < qualityGate.maxRetries) {
            if (!qualityGate.autoRewrite) break

            const rewriteResult = rewriteText(finalContent, { intensity: 'medium' })
            finalContent = rewriteResult.text

            const reDetection = detectAI(finalContent)
            aiScore = reDetection.overallScore
            rewritten = true
            retries++
          }
        }

        const chapterResult: ChapterResult = {
          chapterNo,
          success: genResult.success,
          content: finalContent,
          wordCount: finalContent.replace(/\s/g, '').length,
          aiScore,
          rewritten,
          error: genResult.error,
          durationMs: Date.now() - chapterStart,
        }

        session.results.push(chapterResult)
        onChapterDone?.(chapterResult)

        if (genResult.success) {
          completed++
          session.progress.completedChapters = completed
          if (chapterIndex >= 0 && chapterIndex < session.progress.chapters.length) {
            session.progress.chapters[chapterIndex] = {
              chapterNumber: chapterNo,
              status: 'completed',
            }
          }
          if (jobId) {
            await prisma.generationJob.update({
              where: { id: jobId },
              data: { currentChapter: chapterNo },
            }).catch(() => {})
          }
        } else {
          failed++
          session.progress.failedChapters = failed
          if (chapterIndex >= 0 && chapterIndex < session.progress.chapters.length) {
            session.progress.chapters[chapterIndex] = {
              chapterNumber: chapterNo,
              status: 'failed',
              error: genResult.error || '失败',
            }
          }
        }
        session.progress.currentStep = 'idle'
        this.syncProgress(session)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '未知错误'
        const chapterResult: ChapterResult = {
          chapterNo,
          success: false,
          error: errorMsg,
          wordCount: 0,
          durationMs: Date.now() - chapterStart,
        }
        session.results.push(chapterResult)
        onChapterDone?.(chapterResult)
        failed++
        session.progress.failedChapters = failed
        const chapterIndex = chapterNo - session.progress.startChapter
        if (chapterIndex >= 0 && chapterIndex < session.progress.chapters.length) {
          session.progress.chapters[chapterIndex] = {
            chapterNumber: chapterNo,
            status: 'failed',
            error: errorMsg,
          }
        }
        session.progress.currentStep = 'idle'
        this.syncProgress(session)
      }
    }

    if (session.progress.status === 'paused') {
      await updateJob({ status: 'PAUSED' })
      this.syncProgress(session)
      return
    }

    session.progress.status = 'completed'
    this.syncProgress(session)

    if (jobId) {
      await prisma.generationJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          result: {
            totalChapters: session.results.length,
            successful: session.results.filter(r => r.success).length,
            failed: session.results.filter(r => !r.success).length,
            totalDurationMs: Date.now() - session.progress.startTime,
          },
          completedAt: new Date(),
        },
      }).catch(() => {})
    }
  }

  pause(projectId: number): boolean {
    const session = this.sessions.get(projectId)
    if (!session || session.progress.status !== 'running') {
      return false
    }

    session.progress.status = 'paused'
    if (session.jobId) {
      void prisma.generationJob.update({
        where: { id: session.jobId },
        data: { status: 'PAUSED' },
      }).catch(() => {})
    }
    this.syncProgress(session)
    return true
  }

  resume(projectId: number): boolean {
    const session = this.sessions.get(projectId)
    if (!session || session.progress.status !== 'paused') {
      return false
    }

    const lastProcessedChapter = session.progress.chapters
      .filter(chapter => chapter.status !== 'pending')
      .map(chapter => chapter.chapterNumber)
      .at(-1)
    const nextStartChapter = lastProcessedChapter ? lastProcessedChapter + 1 : session.progress.startChapter
    session.options = {
      ...session.options,
      startChapter: nextStartChapter,
    }
    session.progress.status = 'running'
    if (session.jobId) {
      void prisma.generationJob.update({
        where: { id: session.jobId },
        data: { status: 'RUNNING' },
      }).catch(() => {})
    }
    this.syncProgress(session)
    void this.runSession(session)
    return true
  }

  getProgress(projectId: number): PipelineProgress | undefined {
    return this.sessions.get(projectId)?.progress
  }

  isRunning(projectId: number): boolean {
    return this.sessions.get(projectId)?.progress.status === 'running'
  }

  getActiveJobs(): { projectId: number; progress: PipelineProgress }[] {
    return Array.from(this.sessions.entries()).map(([projectId, session]) => ({
      projectId,
      progress: session.progress,
    }))
  }
}

export const autoPipelineScheduler = new AutoPipelineScheduler()
