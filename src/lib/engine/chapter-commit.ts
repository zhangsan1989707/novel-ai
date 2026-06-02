import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import type { ChapterOutline, ChapterSummaryData, ValidationReport } from './types'
import type { ChapterContinuitySnapshot, ContinuityAuditResult } from './chapter-continuity'
import { runChapterProjectionWriters } from './chapter-projections'

export interface ChapterCommitPayload {
  chapterNo: number
  chapterTitle: string
  content: string
  summaryData?: ChapterSummaryData | null
  validationReport?: ValidationReport | null
  outline?: ChapterOutline | null
  continuityAudit?: ContinuityAuditResult | null
  continuitySnapshot?: ChapterContinuitySnapshot | null
  phaseTimings?: Record<string, number>
  qualityStatus?: 'completed' | 'reviewing'
  warning?: string
  error?: string
  targetWordCount?: number
  currentWordCount?: number
  emittedAt?: string
  emotionalValue?: number
  agentType?: string
}

export interface ChapterCommitRecord {
  id: string
  projectId: number
  chapterId?: number | null
  chapterNo: number
  source: string
  status: string
  payload: ChapterCommitPayload
  projectionStatus: Record<string, string>
  replayCount: number
  appliedAt?: string | null
  createdAt: string
  updatedAt: string
}

function normalizeJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function normalizeStringRecord(value: unknown): Record<string, string> {
  const source = normalizeJsonObject(value)
  return Object.entries(source).reduce<Record<string, string>>((acc, [key, entry]) => {
    if (typeof entry === 'string') {
      acc[key] = entry
    } else if (entry === undefined || entry === null) {
      acc[key] = ''
    } else if (typeof entry === 'number' || typeof entry === 'boolean') {
      acc[key] = String(entry)
    } else {
      acc[key] = JSON.stringify(entry)
    }
    return acc
  }, {})
}

export async function createChapterCommit(
  projectId: number,
  chapterId: number | null,
  payload: ChapterCommitPayload,
  source: string = 'pipeline'
): Promise<ChapterCommitRecord> {
  const commit = await prisma.chapterCommit.create({
    data: {
      projectId,
      chapterId,
      chapterNo: payload.chapterNo,
      source,
      status: 'accepted',
      payload: payload as unknown as Prisma.InputJsonValue,
      projectionStatus: {
        chapter: 'pending',
        version: 'pending',
        summary: 'pending',
        plotlines: 'pending',
        characters: 'pending',
        story: 'pending',
        project: 'pending',
        audit: 'pending',
      } as unknown as Prisma.InputJsonValue,
    },
  })

  return toCommitRecord(commit)
}

export async function applyChapterCommit(commitId: string): Promise<ChapterCommitRecord> {
  const commit = await prisma.chapterCommit.findUnique({
    where: { id: commitId },
  })
  if (!commit) {
    throw new Error(`Chapter commit ${commitId} not found`)
  }

  const payload = normalizeJsonObject(commit.payload) as unknown as ChapterCommitPayload
  const chapter = await prisma.novelChapter.findFirst({
    where: {
      projectId: commit.projectId,
      chapterNumber: commit.chapterNo,
    },
  })
  if (!chapter) {
    throw new Error(`Chapter ${commit.chapterNo} not found for project ${commit.projectId}`)
  }

  const { projectionStatus: projectionResult } = await runChapterProjectionWriters({
    projectId: commit.projectId,
    chapterNo: commit.chapterNo,
    commitId: commit.id,
    commitStatus: commit.status,
    chapter: {
      id: chapter.id,
      title: chapter.title,
      generationPrompt: chapter.generationPrompt,
      summary: chapter.summary,
    },
    payload,
  })

  const appliedAt = new Date()
  await prisma.chapterCommit.update({
    where: { id: commit.id },
    data: {
      projectionStatus: projectionResult as Prisma.InputJsonValue,
      appliedAt,
    },
  })

  return toCommitRecord(
    await prisma.chapterCommit.findUniqueOrThrow({
      where: { id: commit.id },
    })
  )
}

export async function recordAndApplyChapterCommit(
  projectId: number,
  chapterId: number | null,
  payload: ChapterCommitPayload,
  source: string = 'pipeline'
): Promise<ChapterCommitRecord> {
  const commit = await createChapterCommit(projectId, chapterId, payload, source)
  return applyChapterCommit(commit.id)
}

export async function replayChapterCommit(commitId: string): Promise<ChapterCommitRecord> {
  const commit = await prisma.chapterCommit.update({
    where: { id: commitId },
    data: {
      status: 'replayed',
      replayCount: { increment: 1 },
    },
  })
  return applyChapterCommit(commit.id)
}

export async function listChapterCommits(projectId: number, take: number = 20) {
  const commits = await prisma.chapterCommit.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take,
  })
  return commits.map(toCommitRecord)
}

function toCommitRecord(commit: {
  id: string
  projectId: number
  chapterId: number | null
  chapterNo: number
  source: string
  status: string
  payload: Prisma.JsonValue
  projectionStatus: Prisma.JsonValue
  replayCount: number
  appliedAt: Date | null
  createdAt: Date
  updatedAt: Date
}): ChapterCommitRecord {
  return {
    id: commit.id,
    projectId: commit.projectId,
    chapterId: commit.chapterId,
    chapterNo: commit.chapterNo,
    source: commit.source,
    status: commit.status,
    payload: normalizeJsonObject(commit.payload) as unknown as ChapterCommitPayload,
    projectionStatus: normalizeStringRecord(commit.projectionStatus),
    replayCount: commit.replayCount,
    appliedAt: commit.appliedAt?.toISOString() || null,
    createdAt: commit.createdAt.toISOString(),
    updatedAt: commit.updatedAt.toISOString(),
  }
}
