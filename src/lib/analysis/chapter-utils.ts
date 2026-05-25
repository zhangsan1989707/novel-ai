export interface ParsedChapterDraft {
  title: string
  content: string
}

export interface ChapterDiagnostic {
  code: 'EMPTY_TITLE' | 'SHORT_CHAPTER' | 'LONG_CHAPTER' | 'DUPLICATE_TITLE' | 'SHORT_CONTENT'
  message: string
  severity: 'warning' | 'info'
}

export interface ChapterReviewItem extends ParsedChapterDraft {
  chapterNumber: number
  wordCount: number
  diagnostics: ChapterDiagnostic[]
}

const CHAPTER_PATTERNS = [
  /^第([一二三四五六七八九十百千零两\d]+)\s*[章节回部]\s*(.+)/m,
  /^Chapter\s+(\d+)\s*[-–—:]\s*(.+)/im,
  /^(\d+)\.\s*(.+)/m,
  /^\[?第?([一二三四五六七八九十百千零两\d]+)\s*[章节回部]\s*\]?\s*(.+)/m,
] as const

const CN_NUMBER_MAP: Record<string, number> = {
  '零': 0,
  '一': 1,
  '二': 2,
  '两': 2,
  '三': 3,
  '四': 4,
  '五': 5,
  '六': 6,
  '七': 7,
  '八': 8,
  '九': 9,
}

export function countContentWords(content: string): number {
  return content.replace(/\s/g, '').length
}

function chineseToNumber(raw: string): number {
  if (/^\d+$/.test(raw)) return parseInt(raw, 10)
  if (raw === '十') return 10
  const tenIndex = raw.indexOf('十')
  if (tenIndex !== -1) {
    const tens = tenIndex === 0 ? 1 : (CN_NUMBER_MAP[raw[tenIndex - 1]] || 0)
    const ones = tenIndex === raw.length - 1 ? 0 : (CN_NUMBER_MAP[raw[tenIndex + 1]] || 0)
    return tens * 10 + ones
  }
  return raw.split('').reduce((sum, char) => sum * 10 + (CN_NUMBER_MAP[char] ?? 0), 0)
}

export function extractChapterTitle(content: string): string {
  const lines = content.split('\n').filter(line => line.trim().length > 0)
  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim()
    for (const pattern of CHAPTER_PATTERNS) {
      const match = trimmed.match(pattern)
      if (match) return match[0].slice(0, 100)
    }
  }
  return ''
}

export function splitIntoChapters(text: string): ParsedChapterDraft[] {
  const paragraphs = text.split(/\n{2,}/).filter(Boolean)
  const chapters: ParsedChapterDraft[] = []
  let currentChapter: ParsedChapterDraft | null = null
  let currentContent: string[] = []

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim()
    if (!trimmed) continue

    const isChapterTitle = CHAPTER_PATTERNS.some(pattern => pattern.test(trimmed)) && trimmed.length < 100
    if (isChapterTitle) {
      if (currentChapter && currentContent.length > 0) {
        currentChapter.content = currentContent.join('\n\n').trim()
        chapters.push(currentChapter)
      }
      currentChapter = { title: trimmed.slice(0, 100), content: '' }
      currentContent = []
      continue
    }

    if (!currentChapter) {
      currentChapter = { title: extractChapterTitle(trimmed) || '序章', content: '' }
    }

    currentContent.push(trimmed)

    if (countContentWords(currentContent.join('\n\n')) > 10000) {
      currentChapter.content = currentContent.join('\n\n').trim()
      chapters.push(currentChapter)
      currentChapter = { title: `第${chapters.length + 1}章`, content: '' }
      currentContent = []
    }
  }

  if (currentChapter && currentContent.length > 0) {
    currentChapter.content = currentContent.join('\n\n').trim()
    chapters.push(currentChapter)
  }

  if (chapters.length === 0) {
    const segmentSize = 5000
    for (let index = 0; index < text.length; index += segmentSize) {
      const segmentNo = Math.floor(index / segmentSize) + 1
      chapters.push({
        title: `第${segmentNo}段`,
        content: text.slice(index, index + segmentSize).trim(),
      })
    }
  }

  return chapters.map((chapter, index) => ({
    title: chapter.title && chapter.title !== '序章' ? chapter.title : `第${index + 1}章`,
    content: chapter.content,
  }))
}

export function buildChapterDiagnostics(chapters: ParsedChapterDraft[]): ChapterReviewItem[] {
  const titleCount = new Map<string, number>()
  chapters.forEach(chapter => {
    const normalized = chapter.title.trim()
    if (normalized) titleCount.set(normalized, (titleCount.get(normalized) || 0) + 1)
  })

  return chapters.map((chapter, index) => {
    const wordCount = countContentWords(chapter.content)
    const diagnostics: ChapterDiagnostic[] = []
    const title = chapter.title.trim()

    if (!title) {
      diagnostics.push({ code: 'EMPTY_TITLE', message: '标题为空，建议手动补充。', severity: 'warning' })
    }
    if (title && (titleCount.get(title) || 0) > 1) {
      diagnostics.push({ code: 'DUPLICATE_TITLE', message: '标题重复，可能切章不准。', severity: 'warning' })
    }
    if (wordCount < 800) {
      diagnostics.push({ code: 'SHORT_CHAPTER', message: '篇幅偏短，可能被错误拆分。', severity: 'warning' })
    } else if (wordCount < 1500) {
      diagnostics.push({ code: 'SHORT_CONTENT', message: '篇幅略短，建议确认是否需要合并。', severity: 'info' })
    }
    if (wordCount > 9000) {
      diagnostics.push({ code: 'LONG_CHAPTER', message: '篇幅过长，建议拆分后再分析。', severity: 'warning' })
    }

    return {
      chapterNumber: index + 1,
      title: title || `第${index + 1}章`,
      content: chapter.content,
      wordCount,
      diagnostics,
    }
  })
}

export function normalizeChapterReviewItems(items: ParsedChapterDraft[]): ChapterReviewItem[] {
  return buildChapterDiagnostics(items.map(item => ({
    title: item.title.trim() || '未命名章节',
    content: item.content.trim(),
  })))
}

export function mergeChapterItems(items: ChapterReviewItem[], index: number): ChapterReviewItem[] {
  if (index < 0 || index >= items.length - 1) return items
  const current = items[index]
  const next = items[index + 1]
  const merged = [
    ...items.slice(0, index),
    {
      ...current,
      title: current.title,
      content: `${current.content}\n\n${next.content}`.trim(),
      wordCount: 0,
      diagnostics: [],
      chapterNumber: current.chapterNumber,
    },
    ...items.slice(index + 2),
  ].map(({ title, content }) => ({ title, content }))
  return normalizeChapterReviewItems(merged)
}

export function splitChapterItem(items: ChapterReviewItem[], index: number): ChapterReviewItem[] {
  const target = items[index]
  if (!target) return items
  const paragraphs = target.content.split(/\n{2,}/).filter(Boolean)
  if (paragraphs.length < 2) return items
  const mid = Math.max(1, Math.floor(paragraphs.length / 2))
  const first = paragraphs.slice(0, mid).join('\n\n').trim()
  const second = paragraphs.slice(mid).join('\n\n').trim()
  const drafts = [
    ...items.slice(0, index).map(({ title, content }) => ({ title, content })),
    { title: `${target.title}（上）`, content: first },
    { title: `${target.title}（下）`, content: second },
    ...items.slice(index + 1).map(({ title, content }) => ({ title, content })),
  ]
  return normalizeChapterReviewItems(drafts)
}

export function moveChapterItem(items: ChapterReviewItem[], index: number, direction: -1 | 1): ChapterReviewItem[] {
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= items.length) return items
  const draft = items.map(({ title, content }) => ({ title, content }))
  ;[draft[index], draft[nextIndex]] = [draft[nextIndex], draft[index]]
  return normalizeChapterReviewItems(draft)
}

export function inferVolumeNumberFromChapter(chapterNumber: number, totalVolumes: number, totalChapters: number): number {
  if (totalVolumes <= 1 || totalChapters <= 0) return 1
  const chapterPerVolume = Math.max(1, Math.ceil(totalChapters / totalVolumes))
  return Math.min(totalVolumes, Math.max(1, Math.ceil(chapterNumber / chapterPerVolume)))
}

export function detectChapterNumber(title: string): number {
  for (const pattern of CHAPTER_PATTERNS) {
    const match = title.match(pattern)
    if (!match) continue
    return chineseToNumber(match[1])
  }
  return 0
}
