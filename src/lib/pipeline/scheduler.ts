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
  currentChapter: number
  totalChapters: number
  status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
  completedChapters: number
  failedChapters: number
  startTime: number
  elapsedMs: number
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
  private activeJobs: Map<number, PipelineProgress> = new Map()

  async start(options: AutoPipelineOptions): Promise<ChapterResult[]> {
    const {
      projectId,
      startChapter,
      endChapter,
      speedMode = 'balanced',
      qualityGate,
      onProgress,
      onChapterDone,
      signal,
    } = options

    const results: ChapterResult[] = []
    const totalChapters = endChapter - startChapter + 1

    const progress: PipelineProgress = {
      currentChapter: startChapter,
      totalChapters,
      status: 'running',
      completedChapters: 0,
      failedChapters: 0,
      startTime: Date.now(),
      elapsedMs: 0,
    }

    this.activeJobs.set(projectId, progress)

    const updateProgress = (updates: Partial<PipelineProgress>) => {
      Object.assign(progress, updates)
      progress.elapsedMs = Date.now() - progress.startTime
      onProgress?.({ ...progress })
    }

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

    for (let chapterNo = startChapter; chapterNo <= endChapter; chapterNo++) {
      if (signal?.aborted) {
        updateProgress({ status: 'cancelled' })
        break
      }

      updateProgress({ currentChapter: chapterNo })

      const chapterStart = Date.now()

      try {
        const events: SSEEvent[] = []
        const emit: (event: SSEEvent) => void = (event) => {
          events.push(event)
        }

        const genResult = await runChapterGenerationPipeline(
          projectId,
          chapterNo,
          emit,
          { speedMode }
        )

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

        results.push(chapterResult)
        onChapterDone?.(chapterResult)

        if (genResult.success) {
          updateProgress({ completedChapters: progress.completedChapters + 1 })

          if (job) {
            await prisma.generationJob.update({
              where: { id: job.id },
              data: { currentChapter: chapterNo },
            }).catch(() => {})
          }
        } else {
          updateProgress({ failedChapters: progress.failedChapters + 1 })
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '未知错误'
        const chapterResult: ChapterResult = {
          chapterNo,
          success: false,
          error: errorMsg,
          wordCount: 0,
          durationMs: Date.now() - chapterStart,
        }
        results.push(chapterResult)
        onChapterDone?.(chapterResult)
        updateProgress({ failedChapters: progress.failedChapters + 1 })
      }
    }

    updateProgress({ status: 'completed' })

    if (job) {
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          result: {
            totalChapters: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            totalDurationMs: Date.now() - progress.startTime,
          },
          completedAt: new Date(),
        },
      }).catch(() => {})
    }

    this.activeJobs.delete(projectId)
    return results
  }

  getProgress(projectId: number): PipelineProgress | undefined {
    return this.activeJobs.get(projectId)
  }

  isRunning(projectId: number): boolean {
    return this.activeJobs.has(projectId)
  }

  getActiveJobs(): { projectId: number; progress: PipelineProgress }[] {
    return Array.from(this.activeJobs.entries()).map(([projectId, progress]) => ({
      projectId,
      progress,
    }))
  }
}

export const autoPipelineScheduler = new AutoPipelineScheduler()