export function getMinimumChapterWordCount(targetWordCount: number, chapterNumber?: number): number {
  const safeTarget = Math.max(1000, Math.floor(targetWordCount || 0))
  const baseFloor = Math.max(1500, Math.floor(safeTarget * 0.65))

  if (!chapterNumber) {
    return baseFloor
  }

  if (chapterNumber <= 3) {
    return Math.max(1400, Math.floor(safeTarget * 0.6))
  }

  if (chapterNumber % 10 === 0) {
    return Math.max(baseFloor, Math.floor(safeTarget * 0.7))
  }

  return baseFloor
}

export function isChapterWordCountSufficient(
  wordCount: number,
  targetWordCount: number,
  chapterNumber?: number
): boolean {
  return wordCount >= getMinimumChapterWordCount(targetWordCount, chapterNumber)
}

export function buildChapterWordCountWarning(
  wordCount: number,
  targetWordCount: number,
  chapterNumber?: number
): string {
  const minimum = getMinimumChapterWordCount(targetWordCount, chapterNumber)
  const chapterLabel = chapterNumber ? `第${chapterNumber}章` : '当前章节'
  return `${chapterLabel}字数仅 ${wordCount}，低于最低要求 ${minimum}，已标记为待审稿`
}
