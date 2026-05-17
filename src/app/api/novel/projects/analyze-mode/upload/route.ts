import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import JSZip from 'jszip'
import { logError } from '@/lib/logger'

interface EpubChapter {
  title: string
  content: string
}

interface ParsedChapter {
  title: string
  content: string
}

// ============================================
// 工具函数
// ============================================

async function extractTextFromEpub(arrayBuffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(arrayBuffer)
  const chapters: string[] = []

  const contentFiles = Object.keys(zip.files).filter((path) => {
    const lower = path.toLowerCase()
    return (
      lower.endsWith('.xhtml') ||
      lower.endsWith('.html') ||
      lower.endsWith('.htm') ||
      (lower.includes('content') && lower.endsWith('.xml'))
    )
  })

  contentFiles.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0] || '0')
    const numB = parseInt(b.match(/\d+/)?.[0] || '0')
    return numA - numB
  })

  for (const filePath of contentFiles) {
    const content = await zip.file(filePath)?.async('string')
    if (content) {
      const text = content
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&#\d+;/g, '')
        .replace(/\s+/g, ' ')
        .trim()

      if (text.length > 50) {
        chapters.push(text)
      }
    }
  }

  return chapters.join('\n\n')
}

async function extractTextFromTxt(arrayBuffer: ArrayBuffer): Promise<string> {
  let text = new TextDecoder('utf-8').decode(arrayBuffer)
  if (text.includes('�')) {
    text = new TextDecoder('gbk').decode(arrayBuffer)
  }
  return text.trim()
}

// ============================================
// 智能分章
// ============================================

const CHAPTER_PATTERNS = [
  // 第1章 标题 / 第一章 标题
  /^第([一二三四五六七八九十百千零\d]+)\s*[章节回部]\s*(.+)/m,
  // Chapter 1 - Title
  /^Chapter\s+(\d+)\s*[-–—:]\s*(.+)/im,
  // 1. 标题
  /^(\d+)\.\s*(.+)/m,
  // 【第1章】标题
  /^\[?第?([一二三四五六七八九十百千零\d]+)\s*[章节回部]\s*\]?\s*(.+)/m,
]

// 中文数字转阿拉伯数字
function chineseToNumber(cn: string): number {
  const map: Record<string, number> = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    '百': 100, '千': 1000, '零': 0,
  }
  let num = 0
  if (cn.includes('十')) {
    const parts = cn.split('十')
    if (parts[0] === '') {
      num = 10
    } else if (parts[1] === '') {
      num = map[parts[0]] * 10
    } else {
      num = (map[parts[0]] || 0) * 10 + (map[parts[1]] || 0)
    }
  } else {
    for (const char of cn) {
      if (map[char] !== undefined) num = num * 10 + map[char]
    }
  }
  return num || parseInt(cn) || 0
}

function detectChapterNumber(title: string): number {
  for (const pattern of CHAPTER_PATTERNS) {
    const match = title.match(pattern)
    if (match) {
      const numStr = match[1]
      // 尝试直接转数字
      const parsed = parseInt(numStr)
      if (!isNaN(parsed)) return parsed
      // 中文数字
      return chineseToNumber(numStr)
    }
  }
  return 0
}

function extractChapterTitle(content: string): string {
  const lines = content.split('\n').filter(l => l.trim().length > 0)
  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim()
    for (const pattern of CHAPTER_PATTERNS) {
      const match = trimmed.match(pattern)
      if (match) {
        return match[0].slice(0, 100)
      }
    }
  }
  return ''
}

/**
 * 智能分章
 * 优先使用标题检测，失败则使用固定字数分段
 */
function splitIntoChapters(text: string, minChapterLength = 500): ParsedChapter[] {
  const chapters: ParsedChapter[] = []

  // 按换行分割段落
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim().length > 0)

  let currentChapter: ParsedChapter | null = null
  let currentContent: string[] = []

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) continue

    // 检测是否为章节标题
    const isChapterTitle = CHAPTER_PATTERNS.some(p => p.test(trimmed))

    if (isChapterTitle && trimmed.length < 100) {
      // 保存当前章节
      if (currentChapter && currentContent.length > 0) {
        currentChapter.content = currentContent.join('\n\n')
        chapters.push(currentChapter)
      }

      // 开始新章节
      currentChapter = {
        title: trimmed.slice(0, 100),
        content: '',
      }
      currentContent = []
    } else {
      // 累积内容
      if (currentChapter) {
        currentContent.push(trimmed)
      } else {
        // 没有检测到章节标题，创建第一个
        currentChapter = {
          title: extractChapterTitle(para) || '序章',
          content: '',
        }
        currentContent.push(trimmed)
      }

      // 如果当前章节内容过长，自动截断并创建新章节
      if (currentContent.join('\n\n').length > 10000) {
        if (currentChapter && currentContent.length > 0) {
          currentChapter.content = currentContent.join('\n\n')
          chapters.push(currentChapter)
        }
        currentChapter = {
          title: extractChapterTitle(currentContent.join('\n\n')) || `第${chapters.length + 1}章`,
          content: '',
        }
        currentContent = []
      }
    }
  }

  // 保存最后一章
  if (currentChapter && currentContent.length > 0) {
    currentChapter.content = currentContent.join('\n\n')
    chapters.push(currentChapter)
  }

  // 如果没有检测到任何章节，使用固定字数分段
  if (chapters.length === 0) {
    const segmentSize = 5000
    for (let i = 0; i < text.length; i += segmentSize) {
      const segNum = Math.floor(i / segmentSize) + 1
      const segment = text.slice(i, i + segmentSize)
      chapters.push({
        title: `第${segNum}段`,
        content: segment,
      })
    }
  }

  // 为没有标题的章节补充标题
  chapters.forEach((ch, idx) => {
    if (ch.title === '序章' || !ch.title || ch.title === `第${idx + 1}段`) {
      ch.title = ch.title || `第${idx + 1}章`
    }
  })

  return chapters
}

// ============================================
// API Handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const projectIdStr = formData.get('projectId') as string | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_FILE', message: '请提供要上传的文件' } },
        { status: 400 }
      )
    }

    const validTypes = ['text/plain', 'application/epub+zip']
    const validExtensions = ['.txt', '.epub']
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))

    if (!validTypes.includes(file.type) && !validExtensions.includes(extension)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TYPE', message: '只支持 .txt 和 .epub 格式' } },
        { status: 400 }
      )
    }

    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: { code: 'FILE_TOO_LARGE', message: '文件大小不能超过 100MB' } },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()

    let originalText: string
    let sourceName: string | null = null

    if (extension === '.epub') {
      originalText = await extractTextFromEpub(arrayBuffer)
      sourceName = file.name.replace(/\.epub$/i, '').replace(/[_-]/g, ' ')
    } else {
      originalText = await extractTextFromTxt(arrayBuffer)
      sourceName = file.name.replace(/\.txt$/i, '').replace(/[_-]/g, ' ')
    }

    originalText = originalText.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()

    if (originalText.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'EMPTY_CONTENT', message: '文件内容为空' } },
        { status: 400 }
      )
    }

    const wordCount = originalText.replace(/\s/g, '').length

    let savedSourceNovel = null
    let chaptersCreated = 0

    if (projectIdStr) {
      const projectId = parseInt(projectIdStr, 10)
      if (!isNaN(projectId)) {
        // 保存原始文本
        savedSourceNovel = await prisma.sourceNovel.upsert({
          where: { projectId },
          update: {
            originalText,
            wordCount,
            sourceName,
          },
          create: {
            projectId,
            originalText,
            wordCount,
            sourceName,
          },
        })

        // 智能分章
        const chapters = splitIntoChapters(originalText)

        // 删除旧的章节（如果有）
        await prisma.novelChapter.deleteMany({
          where: { projectId },
        })

        // 批量创建章节
        const chapterData = chapters.map((ch, idx) => ({
          projectId,
          chapterNumber: idx + 1,
          title: ch.title,
          content: ch.content,
          wordCount: ch.content.replace(/\s/g, '').length,
          status: 'REVIEWING' as const,
        }))

        if (chapterData.length > 0) {
          await prisma.novelChapter.createMany({
            data: chapterData,
          })
          chaptersCreated = chapterData.length
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        fileName: file.name,
        sourceName,
        wordCount,
        previewLength: Math.min(500, originalText.length),
        preview: originalText.slice(0, 500),
        hasProjectId: !!projectIdStr,
        savedId: savedSourceNovel?.id || null,
        chaptersCreated,
      },
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'upload_source_novel' })
    return NextResponse.json(
      { success: false, error: { code: 'UPLOAD_ERROR', message: '文件处理失败' } },
      { status: 500 }
    )
  }
}
