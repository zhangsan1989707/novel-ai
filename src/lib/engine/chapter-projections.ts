import { prisma } from '@/lib/prisma'
import type { AgentType, Prisma, NovelChapter } from '@prisma/client'
import { countChapterWords, syncProjectChapterWordCount } from '@/lib/novel/chapter-word-count'
import { saveChapterSummary } from '@/lib/memory/chapter-summary'
import { batchCreatePlotlines, batchResolvePlotlines } from '@/lib/memory/plotline-tracker'
import { batchUpdateCharacterProfiles } from '@/lib/memory/character-memory'
import * as storyState from './story-state'
import type { ChapterCommitPayload } from './chapter-commit'
import { indexChapterContent } from './rag-vector'
import { resolveCommittedChapterTitle } from './chapter-metadata'
import { normalizeChapterContentForUser } from '@/lib/chapter-content-normalizer'

export type ProjectionStatusMap = Record<string, string>

export interface ChapterProjectionContext {
  projectId: number
  chapterNo: number
  commitId: string
  commitStatus: string
  chapter: Pick<NovelChapter, 'id' | 'title' | 'generationPrompt' | 'summary'>
  payload: ChapterCommitPayload
}

export interface ChapterProjectionResult {
  projectionStatus: ProjectionStatusMap
  finalWordCount: number
}

function markFailure(status: ProjectionStatusMap, key: string, error: unknown): void {
  status[key] = `failed:${error instanceof Error ? error.message : String(error)}`
}

export function normalizeCommittedChapterContent(content: string): string {
  return normalizeChapterContentForUser(content)
}

export function normalizePersistedAgentType(agentType?: string): AgentType | undefined {
  switch (agentType) {
    case 'PLANNER':
    case 'WRITER':
    case 'POLISHER':
    case 'VALIDATOR':
    case 'SUMMARIZER':
    case 'RESEARCHER':
      return agentType
    case 'REVIEWER':
    case 'DESLOPPER':
      return 'POLISHER'
    default:
      return undefined
  }
}

function mergeOutlineContinuity(payload: ChapterCommitPayload): Prisma.InputJsonValue | undefined {
  if (!payload.outline) return undefined
  if (!payload.continuityAudit && !payload.continuitySnapshot) {
    return payload.outline as unknown as Prisma.InputJsonValue
  }

  return {
    ...(payload.outline as unknown as Record<string, unknown>),
    continuity: {
      audit: payload.continuityAudit || null,
      snapshot: payload.continuitySnapshot || null,
    },
  } as unknown as Prisma.InputJsonValue
}

export async function runChapterProjectionWriters(
  context: ChapterProjectionContext
): Promise<ChapterProjectionResult> {
  const projectionStatus: ProjectionStatusMap = {
    chapter: 'pending',
    version: 'pending',
    summary: 'pending',
    plotlines: 'pending',
    characters: 'pending',
    story: 'pending',
    project: 'pending',
    audit: 'pending',
    rag: 'pending',
  }

  const normalizedContent = normalizeCommittedChapterContent(context.payload.content)
  const finalWordCount = countChapterWords(normalizedContent)
  const chapterReady = context.payload.qualityStatus === 'completed'

  try {
    await prisma.novelChapter.update({
      where: { id: context.chapter.id },
      data: {
        title: resolveCommittedChapterTitle(context.chapterNo, context.payload.chapterTitle, context.chapter.title),
        content: normalizedContent,
        summary: context.payload.summaryData?.summary || context.chapter.summary || '',
        status: chapterReady ? 'COMPLETED' : 'REVIEWING',
        validationReport: context.payload.validationReport as Prisma.InputJsonValue | undefined,
        chapterOutline: mergeOutlineContinuity(context.payload),
        wordCount: finalWordCount,
        lastAgentType: normalizePersistedAgentType(context.payload.agentType),
      },
    })
    projectionStatus.chapter = 'done'
  } catch (error) {
    markFailure(projectionStatus, 'chapter', error)
    throw error
  }

  try {
    const latestVersion = await prisma.chapterVersion.aggregate({
      where: { chapterId: context.chapter.id },
      _max: { versionNumber: true },
    })
    await prisma.chapterVersion.create({
      data: {
        chapterId: context.chapter.id,
        content: normalizedContent,
        wordCount: finalWordCount,
        prompt: context.chapter.generationPrompt,
        versionNumber: (latestVersion._max.versionNumber || 0) + 1,
      },
    })
    projectionStatus.version = 'done'
  } catch (error) {
    markFailure(projectionStatus, 'version', error)
  }

  try {
    if (context.payload.summaryData) {
      await saveChapterSummary(context.projectId, context.chapterNo, context.payload.summaryData)
      projectionStatus.summary = 'done'
    } else {
      projectionStatus.summary = 'skipped'
    }
  } catch (error) {
    markFailure(projectionStatus, 'summary', error)
  }

  try {
    if (context.payload.summaryData?.plantedPlotlines?.length) {
      await batchCreatePlotlines(
        context.projectId,
        context.payload.summaryData.plantedPlotlines.map((description: unknown) => ({
          description: String(description),
          plantedAt: context.chapterNo,
          type: 'FORESHADOW',
        }))
      )
    }
    if (context.payload.summaryData?.resolvedPlotlines?.length) {
      await batchResolvePlotlines(context.payload.summaryData.resolvedPlotlines.map((id: unknown) => String(id)), context.chapterNo)
    }
    projectionStatus.plotlines = 'done'
  } catch (error) {
    markFailure(projectionStatus, 'plotlines', error)
  }

  try {
    const updates = context.payload.validationReport?.characterUpdates || {}
    if (Object.keys(updates).length > 0) {
      await batchUpdateCharacterProfiles(context.projectId, updates as Record<string, string | Record<string, unknown>>, context.chapterNo)
    }
    projectionStatus.characters = 'done'
  } catch (error) {
    markFailure(projectionStatus, 'characters', error)
  }

  try {
    if (context.payload.emotionalValue !== undefined) {
      await storyState.updateEmotionalArc(context.projectId, context.chapterNo, context.payload.emotionalValue)
    }
    await storyState.updateChapterProgress(context.projectId, context.chapterNo)
    projectionStatus.story = 'done'
  } catch (error) {
    markFailure(projectionStatus, 'story', error)
  }

  try {
    await syncProjectChapterWordCount(prisma, context.projectId)
    projectionStatus.project = 'done'
  } catch (error) {
    markFailure(projectionStatus, 'project', error)
  }

  try {
    await storyState.recordStoryEvent(
      context.projectId,
      'CHAPTER_COMMITTED',
      `第${context.chapterNo}章 commit 已应用：${context.payload.chapterTitle}`,
      context.chapterNo,
      {
        commitId: context.commitId,
        status: context.commitStatus,
        finalWordCount,
        qualityStatus: context.payload.qualityStatus,
      }
    )
    projectionStatus.audit = 'done'
  } catch (error) {
    markFailure(projectionStatus, 'audit', error)
  }

  try {
    const content = normalizedContent || ''
    if (content.trim().length > 0) {
      void indexChapterContent(context.projectId, context.chapterNo, content)
        .catch(err => { /* RAG index failure is non-critical */ })
    }
    projectionStatus.rag = 'queued'
  } catch (error) {
    markFailure(projectionStatus, 'rag', error)
  }

  return { projectionStatus, finalWordCount }
}
