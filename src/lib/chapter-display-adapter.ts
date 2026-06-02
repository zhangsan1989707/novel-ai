/**
 * 章节显示适配器 - 统一目录页、详情页、抽屉的数据来源
 * 解决正文不显示、字数为0、数据不一致的问题
 */

import { countChineseWords } from '@/lib/utils'
import { normalizeChapterContentForUser } from '@/lib/chapter-content-normalizer'

// 章节原始数据接口（来自 API）
export interface ChapterRawData {
  id: number
  chapterNumber: number
  title: string
  content?: string | null
  summary?: string | null
  wordCount?: number | null
  status?: string | null
  generationCount?: number | null
  lastAgentType?: string | null
  chapterOutline?: Record<string, any> | null
  createdAt?: string | null
  updatedAt?: string | null
  // 以下字段可能从 runtime 获取
  liveContent?: string | null
  draftContent?: string | null
}

// 标准化后的章节显示数据
export interface ChapterDisplayData {
  id: number
  chapterNo: number
  title: string
  summary: string
  content: string
  wordCount: number
  status: string
  generationCount: number
  lastAgentType: string | null
  isDraft: boolean
  isEmpty: boolean
  hasLiveContent: boolean
  createdAt: string | null
  updatedAt: string | null
}

/**
 * 标准化章节显示数据
 * 统一目录页、详情页、抽屉的数据来源
 */
export function normalizeChapterDisplay(chapter: ChapterRawData): ChapterDisplayData {
  // 内容优先级：content > liveContent > draftContent
  const rawContent = chapter.content
    || chapter.liveContent
    || chapter.draftContent
    || ''
  const content = normalizeChapterContentForUser(rawContent)

  // 摘要优先级：summary > chapterOutline.chapterGoal > content 前120字
  const summary = chapter.summary 
    || chapter.chapterOutline?.chapterGoal 
    || (content ? content.slice(0, 120) + (content.length > 120 ? '...' : '') : '')

  // 字数：优先使用数据库值，若为0且有内容则重新计算
  const wordCount = (chapter.wordCount && chapter.wordCount > 0) 
    ? chapter.wordCount 
    : (content ? countChineseWords(content) : 0)

  // 状态标准化
  const status = chapter.status || 'DRAFT'

  // 是否为草稿（没有正式 content，但有实时/草稿内容）
  const isDraft = !chapter.content && (!!chapter.liveContent || !!chapter.draftContent)

  // 是否为空
  const isEmpty = !content

  // 是否有实时内容
  const hasLiveContent = !!chapter.liveContent

  return {
    id: chapter.id,
    chapterNo: chapter.chapterNumber,
    title: chapter.title || '无标题',
    summary,
    content,
    wordCount,
    status,
    generationCount: chapter.generationCount || 0,
    lastAgentType: chapter.lastAgentType || null,
    isDraft,
    isEmpty,
    hasLiveContent,
    createdAt: chapter.createdAt || null,
    updatedAt: chapter.updatedAt || null,
  }
}

/**
 * 获取章节摘要预览（用于目录页列表）
 */
export function getChapterSummaryPreview(chapter: ChapterRawData, maxLength: number = 120): string {
  const summary = chapter.summary 
    || chapter.chapterOutline?.chapterGoal 
    || ''
  
  if (summary.length <= maxLength) return summary
  return summary.slice(0, maxLength) + '...'
}

/**
 * 批量标准化章节列表
 */
export function normalizeChapterList(chapters: ChapterRawData[]): ChapterDisplayData[] {
  return chapters.map(normalizeChapterDisplay)
}
