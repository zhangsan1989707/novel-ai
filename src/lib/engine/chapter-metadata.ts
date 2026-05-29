import type { ChapterOutline } from './types'

interface ChapterSeedSource {
  title?: string | null
  summary?: string | null
  chapterOutline?: unknown
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readOutlineString(chapterOutline: unknown, keys: string[]): string {
  if (!chapterOutline || typeof chapterOutline !== 'object' || Array.isArray(chapterOutline)) {
    return ''
  }
  const source = chapterOutline as Record<string, unknown>
  for (const key of keys) {
    const value = normalizeString(source[key])
    if (value) return value
  }
  return ''
}

export function normalizeChapterTitle(chapterNo: number, rawTitle?: string | null): string {
  const trimmed = normalizeString(rawTitle)
  if (!trimmed) return ''

  const numberedMatch = trimmed.match(/^第\s*(\d+)\s*章(?:[\s:：·\-—]+)?(.*)$/)
  if (!numberedMatch) return trimmed

  const suffix = numberedMatch[2]?.trim() || ''
  if (suffix) return suffix

  const normalizedChapterNo = Number.parseInt(numberedMatch[1] || `${chapterNo}`, 10)
  return `第${Number.isFinite(normalizedChapterNo) ? normalizedChapterNo : chapterNo}章`
}

export function isPlaceholderChapterTitle(chapterNo: number, rawTitle?: string | null): boolean {
  const normalized = normalizeChapterTitle(chapterNo, rawTitle)
  if (!normalized) return true

  if (normalized === `第${chapterNo}章`) return true
  if (/^第\d+章$/.test(normalized)) return true

  const raw = normalizeString(rawTitle)
  return /^.+推进：第\d+章$/.test(raw)
}

export function extractChapterPlanningSeed(chapterNo: number, source?: ChapterSeedSource | null) {
  const outlineTitle = readOutlineString(source?.chapterOutline, ['chapterTitle', 'title'])
  const outlineSummary = readOutlineString(source?.chapterOutline, ['chapterGoal', 'summary'])
  const titleCandidates = [source?.title, outlineTitle]
    .map(candidate => normalizeChapterTitle(chapterNo, candidate))
    .filter(Boolean)

  const richTitle = titleCandidates.find(candidate => !isPlaceholderChapterTitle(chapterNo, candidate))
  const fallbackTitle = titleCandidates[0] || `第${chapterNo}章`

  return {
    title: richTitle || fallbackTitle,
    summary: normalizeString(source?.summary) || outlineSummary || `第${chapterNo}章剧情推进`,
  }
}

export function buildSeedOutlineFromChapterState(
  chapterNo: number,
  source?: ChapterSeedSource | null
): ChapterOutline {
  const seed = extractChapterPlanningSeed(chapterNo, source)

  return {
    chapterTitle: seed.title,
    chapterGoal: seed.summary,
    mainConflict: seed.summary,
    emotionTarget: '推进',
    conflictTarget: '当前核心矛盾',
    payoffTarget: '给读者明确的阶段推进和回报',
    cliffhanger: '在章节结尾留下新的威胁、承诺或悬念，推动下一章。',
    cheatUsage: '让主角优势在本章至少兑现一次。',
    characterTagProof: '通过一次关键选择或对抗证明主角标签。',
    forbiddenMistakes: ['禁止脱离当前批次规划', '禁止提前结局', '禁止结尾无钩子'],
    keyScenes: [
      { scene: '开场：承接上一章结果，快速进入当前局面。', characters: ['主角'], emotion: '推进' },
      { scene: '发展：围绕本章目标制造阻力，并迫使主角做选择。', characters: ['主角', '关键角色'], emotion: '对抗' },
      { scene: '收尾：兑现阶段推进，同时留下新的悬念。', characters: ['主角'], emotion: '悬念' },
    ],
    ending: '留下新的悬念，为下一章铺垫。',
    foreshadows: [],
    resolvedPlotlines: [],
  }
}

export function resolveCommittedChapterTitle(
  chapterNo: number,
  incomingTitle?: string | null,
  persistedTitle?: string | null
): string {
  const normalizedIncoming = normalizeChapterTitle(chapterNo, incomingTitle)
  const normalizedPersisted = normalizeChapterTitle(chapterNo, persistedTitle)

  if (normalizedIncoming && !isPlaceholderChapterTitle(chapterNo, normalizedIncoming)) {
    return normalizedIncoming
  }
  if (normalizedPersisted && !isPlaceholderChapterTitle(chapterNo, normalizedPersisted)) {
    return normalizedPersisted
  }

  return normalizedIncoming || normalizedPersisted || `第${chapterNo}章`
}
