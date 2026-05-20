import { prisma } from '@/lib/prisma'
import type { AgentType, Prisma, NovelChapter } from '@prisma/client'
import { countChineseWords } from '@/lib/utils'
import { saveChapterSummary } from '@/lib/memory/chapter-summary'
import { batchCreatePlotlines, batchResolvePlotlines } from '@/lib/memory/plotline-tracker'
import { batchUpdateCharacterProfiles } from '@/lib/memory/character-memory'
import * as storyState from './story-state'
import type { ChapterCommitPayload } from './chapter-commit'

export type ProjectionStatusMap = Record<string, string>

export interface ChapterProjectionContext {
  projectId: number
  chapterNo: number
  commitId: string
  commitStatus: string
  chapter: Pick<NovelChapter, 'id' | 'generationPrompt' | 'summary'>
  payload: ChapterCommitPayload
}

export interface ChapterProjectionResult {
  projectionStatus: ProjectionStatusMap
  finalWordCount: number
}

function markFailure(status: ProjectionStatusMap, key: string, error: unknown): void {
  status[key] = `failed:${error instanceof Error ? error.message : String(error)}`
}

async function computeProjectWordCount(projectId: number): Promise<number> {
  const totalWordCount = await prisma.novelChapter.aggregate({
    where: { projectId, status: 'COMPLETED' },
    _sum: { wordCount: true },
  })
  return totalWordCount._sum.wordCount || 0
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
  }

  const finalWordCount = countChineseWords(context.payload.content || '')
  const chapterReady = context.payload.qualityStatus === 'completed'

  try {
    await prisma.novelChapter.update({
      where: { id: context.chapter.id },
      data: {
        title: context.payload.chapterTitle,
        content: context.payload.content,
        summary: context.payload.summaryData?.summary || context.chapter.summary || '',
        status: chapterReady ? 'COMPLETED' : 'REVIEWING',
        validationReport: context.payload.validationReport as Prisma.InputJsonValue | undefined,
        chapterOutline: context.payload.outline as Prisma.InputJsonValue | undefined,
        wordCount: finalWordCount,
        lastAgentType: context.payload.agentType as AgentType | undefined,
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
        content: context.payload.content,
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
        context.payload.summaryData.plantedPlotlines.map(description => ({
          description,
          plantedAt: context.chapterNo,
          type: 'FORESHADOW',
        }))
      )
    }
    if (context.payload.summaryData?.resolvedPlotlines?.length) {
      await batchResolvePlotlines(context.payload.summaryData.resolvedPlotlines, context.chapterNo)
    }
    projectionStatus.plotlines = 'done'
  } catch (error) {
    markFailure(projectionStatus, 'plotlines', error)
  }

  try {
    const updates = context.payload.validationReport?.characterUpdates || {}
    if (Object.keys(updates).length > 0) {
      await batchUpdateCharacterProfiles(context.projectId, updates, context.chapterNo)
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
    const currentWordCount = await computeProjectWordCount(context.projectId)
    await prisma.novelProject.update({
      where: { id: context.projectId },
      data: { currentWordCount },
    })
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

  return { projectionStatus, finalWordCount }
}
