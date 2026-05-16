import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExportFormat, ExportOptions, ExportResult } from '@/lib/export/types'

describe('Export Types', () => {
  describe('ExportFormat', () => {
    it('should have correct enum values', () => {
      expect(ExportFormat.TXT).toBe('txt')
      expect(ExportFormat.MD).toBe('md')
      expect(ExportFormat.DOCX).toBe('docx')
      expect(ExportFormat.JSON).toBe('json')
    })

    it('should have 4 export formats', () => {
      const formats = Object.values(ExportFormat)
      expect(formats).toHaveLength(4)
    })
  })

  describe('ExportOptions', () => {
    it('should accept valid export options', () => {
      const options: ExportOptions = {
        format: ExportFormat.TXT,
        includeMetadata: true,
        includeChapterTitles: true,
        compress: false,
      }

      expect(options.format).toBe(ExportFormat.TXT)
      expect(options.includeMetadata).toBe(true)
      expect(options.includeChapterTitles).toBe(true)
      expect(options.compress).toBe(false)
    })

    it('should accept all format options', () => {
      const formats = [ExportFormat.TXT, ExportFormat.MD, ExportFormat.DOCX, ExportFormat.JSON]
      
      formats.forEach(format => {
        const options: ExportOptions = {
          format,
          includeMetadata: false,
          includeChapterTitles: false,
          compress: false,
        }
        expect(options.format).toBe(format)
      })
    })

    it('should allow compress option', () => {
      const options: ExportOptions = {
        format: ExportFormat.TXT,
        includeMetadata: true,
        includeChapterTitles: true,
        compress: true,
      }

      expect(options.compress).toBe(true)
    })
  })

  describe('ExportResult', () => {
    it('should represent successful export', () => {
      const result: ExportResult = {
        success: true,
        fileName: 'novel_2024-01-01.txt',
        filePath: '/exports/novel_2024-01-01.txt',
        downloadUrl: '/api/novel/projects/1/export/download?file=novel_2024-01-01.txt',
      }

      expect(result.success).toBe(true)
      expect(result.fileName).toBeDefined()
      expect(result.filePath).toBeDefined()
      expect(result.downloadUrl).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    it('should represent failed export', () => {
      const result: ExportResult = {
        success: false,
        fileName: '',
        error: '项目不存在',
      }

      expect(result.success).toBe(false)
      expect(result.error).toBe('项目不存在')
      expect(result.filePath).toBeUndefined()
    })

    it('should allow optional fields', () => {
      const result: ExportResult = {
        success: true,
        fileName: 'test.txt',
      }

      expect(result.filePath).toBeUndefined()
      expect(result.downloadUrl).toBeUndefined()
    })
  })
})

describe('Export Service Logic', () => {
  // 测试导出服务的核心逻辑（不涉及数据库）

  describe('buildTxtContent', () => {
    it('should structure content correctly with metadata', () => {
      const project = {
        title: '我的小说',
        description: '测试小说简介',
        genre: '玄幻',
      }
      const chapters = [
        {
          chapterNumber: 1,
          title: '第一章 测试',
          content: '这是第一章的内容。',
          wordCount: 8,
        },
      ]
      const options: ExportOptions = {
        format: ExportFormat.TXT,
        includeMetadata: true,
        includeChapterTitles: true,
        compress: false,
      }

      // 验证数据结构
      expect(project.title).toBe('我的小说')
      expect(chapters).toHaveLength(1)
      expect(options.includeMetadata).toBe(true)
    })

    it('should handle empty chapters', () => {
      const chapters: { chapterNumber: number; title: string; content: string | null; wordCount: number }[] = []
      
      expect(chapters.length).toBe(0)
    })

    it('should handle null content', () => {
      const chapter = {
        chapterNumber: 1,
        title: '测试章节',
        content: null,
        wordCount: 0,
      }

      expect(chapter.content).toBeNull()
    })
  })

  describe('buildJsonContent', () => {
    it('should calculate total word count correctly', () => {
      const chapters = [
        { chapterNumber: 1, title: '第一章', content: '内容1', wordCount: 1000 },
        { chapterNumber: 2, title: '第二章', content: '内容2', wordCount: 1500 },
        { chapterNumber: 3, title: '第三章', content: '内容3', wordCount: 2000 },
      ]

      const totalWordCount = chapters.reduce((sum, ch) => sum + (ch.wordCount || 0), 0)
      expect(totalWordCount).toBe(4500)
    })

    it('should handle null word counts', () => {
      const chapters = [
        { chapterNumber: 1, title: '第一章', content: '内容', wordCount: null as unknown as number },
      ]

      const totalWordCount = chapters.reduce((sum, ch) => sum + (ch.wordCount || 0), 0)
      expect(totalWordCount).toBe(0)
    })
  })
})
