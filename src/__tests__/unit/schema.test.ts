import { describe, it, expect } from 'vitest'
import { z } from 'zod'

describe('API Schema Validation', () => {
  describe('createChapterSchema', () => {
    // Replicate the schema from the API route
    const createChapterSchema = z.object({
      title: z.string().min(1, '章节标题不能为空').max(200),
      chapterNumber: z.number().int().positive(),
      summary: z.string().optional(),
      content: z.string().optional(),
    })

    it('should accept valid chapter data', () => {
      const validData = {
        title: '第一章 测试',
        chapterNumber: 1,
        summary: '这是测试章节',
      }

      const result = createChapterSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.title).toBe('第一章 测试')
        expect(result.data.chapterNumber).toBe(1)
      }
    })

    it('should reject empty title', () => {
      const invalidData = {
        title: '',
        chapterNumber: 1,
      }

      const result = createChapterSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should reject non-positive chapter number', () => {
      const invalidData = {
        title: '测试章节',
        chapterNumber: 0,
      }

      const result = createChapterSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should reject negative chapter number', () => {
      const invalidData = {
        title: '测试章节',
        chapterNumber: -1,
      }

      const result = createChapterSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should accept content with word count', () => {
      const data = {
        title: '第一章',
        chapterNumber: 1,
        content: '这是一段测试内容，包含一些中文字符。',
      }

      const result = createChapterSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('should reject title exceeding max length', () => {
      const invalidData = {
        title: 'a'.repeat(201),
        chapterNumber: 1,
      }

      const result = createChapterSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('createProjectSchema', () => {
    const createProjectSchema = z.object({
      title: z.string().min(1, '标题不能为空').max(200),
      description: z.string().optional(),
      genre: z.string().optional(),
      writingStyle: z.string().optional(),
      targetWordCount: z.number().int().positive().optional(),
      chapterWordCount: z.number().int().positive().default(3000),
      worldSetting: z.string().optional(),
      powerSystem: z.string().optional(),
      protagonistProfile: z.string().optional(),
      protagonistGoal: z.string().optional(),
      antagonistSetting: z.string().optional(),
      endingPlan: z.string().optional(),
      writingPrompt: z.string().optional(),
      coverImage: z.string().optional(),
      totalVolumes: z.number().int().min(1).max(10).default(4),
      aiModelId: z.number().int().positive().optional(),
    })

    it('should accept valid project data', () => {
      const validData = {
        title: '我的小说',
        genre: '玄幻',
        writingStyle: '热血激昂',
        targetWordCount: 100000,
        chapterWordCount: 3000,
        totalVolumes: 4,
      }

      const result = createProjectSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should apply default values', () => {
      const minimalData = {
        title: '我的小说',
      }

      const result = createProjectSchema.safeParse(minimalData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.chapterWordCount).toBe(3000)
        expect(result.data.totalVolumes).toBe(4)
      }
    })

    it('should reject empty title', () => {
      const invalidData = {
        title: '',
      }

      const result = createProjectSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should reject totalVolumes exceeding max', () => {
      const invalidData = {
        title: '我的小说',
        totalVolumes: 11,
      }

      const result = createProjectSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should reject aiModelId that is not positive', () => {
      const invalidData = {
        title: '我的小说',
        aiModelId: 0,
      }

      const result = createProjectSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should accept valid aiModelId', () => {
      const validData = {
        title: '我的小说',
        aiModelId: 1,
      }

      const result = createProjectSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })
  })

  describe('updateProjectSchema', () => {
    const updateProjectSchema = z.object({
      title: z.string().min(1).max(200).optional(),
      description: z.string().optional(),
      genre: z.string().optional(),
      writingStyle: z.string().optional(),
      targetWordCount: z.number().int().positive().optional(),
      chapterWordCount: z.number().int().positive().optional(),
      worldSetting: z.string().optional(),
      powerSystem: z.string().optional(),
      protagonistProfile: z.string().optional(),
      protagonistGoal: z.string().optional(),
      antagonistSetting: z.string().optional(),
      endingPlan: z.string().optional(),
      writingPrompt: z.string().optional(),
      coverImage: z.string().optional(),
      totalVolumes: z.number().int().min(1).max(10).optional(),
      aiModelId: z.number().int().positive().nullable().optional(),
    })

    it('should accept partial update', () => {
      const partialData = {
        title: '更新的标题',
      }

      const result = updateProjectSchema.safeParse(partialData)
      expect(result.success).toBe(true)
    })

    it('should accept aiModelId as null', () => {
      const data = {
        aiModelId: null,
      }

      const result = updateProjectSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('should accept valid aiModelId', () => {
      const data = {
        aiModelId: 1,
      }

      const result = updateProjectSchema.safeParse(data)
      expect(result.success).toBe(true)
    })
  })

  describe('generateChapterListSchema', () => {
    const generateChapterListSchema = z.object({
      projectTitle: z.string().min(1, '请输入小说标题'),
      genre: z.string().optional(),
      writingStyle: z.string().optional(),
      worldSetting: z.string().optional(),
      protagonistProfile: z.string().optional(),
      protagonistGoal: z.string().optional(),
      antagonistSetting: z.string().optional(),
      endingPlan: z.string().optional(),
      totalChapters: z.number().int().positive().max(500).default(50),
      titleStyle: z.enum(['webnovel', 'traditional', 'poetry']).default('webnovel'),
      aiModelId: z.number().int().positive().optional(),
      temperature: z.number().min(0).max(2).default(0.7),
    })

    it('should accept valid generation request', () => {
      const validData = {
        projectTitle: '测试小说',
        genre: '玄幻',
        totalChapters: 30,
        titleStyle: 'webnovel',
      }

      const result = generateChapterListSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should apply default values', () => {
      const minimalData = {
        projectTitle: '测试小说',
      }

      const result = generateChapterListSchema.safeParse(minimalData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.totalChapters).toBe(50)
        expect(result.data.titleStyle).toBe('webnovel')
        expect(result.data.temperature).toBe(0.7)
      }
    })

    it('should reject invalid titleStyle', () => {
      const invalidData = {
        projectTitle: '测试小说',
        titleStyle: 'invalid',
      }

      const result = generateChapterListSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should reject totalChapters exceeding max', () => {
      const invalidData = {
        projectTitle: '测试小说',
        totalChapters: 501,
      }

      const result = generateChapterListSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should reject temperature out of range', () => {
      const invalidData = {
        projectTitle: '测试小说',
        temperature: 3,
      }

      const result = generateChapterListSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })
})
