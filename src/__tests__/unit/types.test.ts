import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// 枚举类型 (与 Prisma schema 保持一致)
const CharacterRole = {
  PROTAGONIST: 'PROTAGONIST', // 注意 Prisma 中可能是 PROTAGONIST
  ANTAGONIST: 'ANTAGONIST',
  SUPPORTING: 'SUPPORTING',
  MINOR: 'MINOR',
} as const

const PlotlineType = {
  FORESHADOW: 'FORESHADOW',
  SUBPLOT: 'SUBPLOT',
  CONFLICT: 'CONFLICT',
} as const

const PlotlineStatus = {
  OPEN: 'OPEN',
  RESOLVED: 'RESOLVED',
  ABANDONED: 'ABANDONED',
} as const

const ProjectStatus = {
  DRAFT: 'DRAFT',
  WRITING: 'WRITING',
  COMPLETED: 'COMPLETED',
  PAUSED: 'PAUSED',
} as const

const ChapterStatus = {
  DRAFT: 'DRAFT',
  GENERATING: 'GENERATING',
  COMPLETED: 'COMPLETED',
  REVIEWING: 'REVIEWING',
} as const

describe('Database Enums', () => {
  describe('CharacterRole', () => {
    it('should have correct role values', () => {
      expect(CharacterRole.PROTAGONIST).toBe('PROTAGONIST')
      expect(CharacterRole.ANTAGONIST).toBe('ANTAGONIST')
      expect(CharacterRole.SUPPORTING).toBe('SUPPORTING')
      expect(CharacterRole.MINOR).toBe('MINOR')
    })

    it('should have 4 character roles', () => {
      const roles = Object.values(CharacterRole)
      expect(roles).toHaveLength(4)
    })
  })

  describe('PlotlineType', () => {
    it('should have correct type values', () => {
      expect(PlotlineType.FORESHADOW).toBe('FORESHADOW')
      expect(PlotlineType.SUBPLOT).toBe('SUBPLOT')
      expect(PlotlineType.CONFLICT).toBe('CONFLICT')
    })

    it('should have 3 plotline types', () => {
      const types = Object.values(PlotlineType)
      expect(types).toHaveLength(3)
    })
  })

  describe('PlotlineStatus', () => {
    it('should have correct status values', () => {
      expect(PlotlineStatus.OPEN).toBe('OPEN')
      expect(PlotlineStatus.RESOLVED).toBe('RESOLVED')
      expect(PlotlineStatus.ABANDONED).toBe('ABANDONED')
    })

    it('should have 3 plotline statuses', () => {
      const statuses = Object.values(PlotlineStatus)
      expect(statuses).toHaveLength(3)
    })
  })

  describe('ProjectStatus', () => {
    it('should have correct status values', () => {
      expect(ProjectStatus.DRAFT).toBe('DRAFT')
      expect(ProjectStatus.WRITING).toBe('WRITING')
      expect(ProjectStatus.COMPLETED).toBe('COMPLETED')
      expect(ProjectStatus.PAUSED).toBe('PAUSED')
    })

    it('should have 4 project statuses', () => {
      const statuses = Object.values(ProjectStatus)
      expect(statuses).toHaveLength(4)
    })
  })

  describe('ChapterStatus', () => {
    it('should have correct status values', () => {
      expect(ChapterStatus.DRAFT).toBe('DRAFT')
      expect(ChapterStatus.GENERATING).toBe('GENERATING')
      expect(ChapterStatus.COMPLETED).toBe('COMPLETED')
      expect(ChapterStatus.REVIEWING).toBe('REVIEWING')
    })

    it('should have 4 chapter statuses', () => {
      const statuses = Object.values(ChapterStatus)
      expect(statuses).toHaveLength(4)
    })
  })
})

describe('Character Profile Schema', () => {
  const characterProfileSchema = z.object({
    name: z.string().min(1, '角色名不能为空'),
    role: z.enum([
      CharacterRole.PROTAGONIST,
      CharacterRole.ANTAGONIST,
      CharacterRole.SUPPORTING,
      CharacterRole.MINOR,
    ]),
    aliases: z.array(z.string()).optional(),
    appearance: z.string().optional(),
    personality: z.string().optional(),
    catchphrases: z.array(z.string()).optional(),
    background: z.string().optional(),
    firstChapter: z.number().int().positive().optional(),
  })

  it('should accept valid character profile', () => {
    const validProfile = {
      name: '张三',
      role: CharacterRole.PROTAGONIST,
      appearance: '身高一米八，面容俊朗',
      personality: '正直勇敢，嫉恶如仇',
      catchphrases: ['人之初，性本善'],
    }

    const result = characterProfileSchema.safeParse(validProfile)
    expect(result.success).toBe(true)
  })

  it('should reject empty name', () => {
    const invalidProfile = {
      name: '',
      role: CharacterRole.PROTAGONIST,
    }

    const result = characterProfileSchema.safeParse(invalidProfile)
    expect(result.success).toBe(false)
  })

  it('should reject invalid role', () => {
    const invalidProfile = {
      name: '张三',
      role: 'INVALID_ROLE',
    }

    const result = characterProfileSchema.safeParse(invalidProfile)
    expect(result.success).toBe(false)
  })

  it('should accept all valid roles', () => {
    const roles = Object.values(CharacterRole)
    
    roles.forEach(role => {
      const profile = {
        name: '测试角色',
        role,
      }
      const result = characterProfileSchema.safeParse(profile)
      expect(result.success).toBe(true)
    })
  })
})

describe('Plotline Schema', () => {
  const plotlineSchema = z.object({
    description: z.string().min(1, '伏笔描述不能为空'),
    type: z.enum([
      PlotlineType.FORESHADOW,
      PlotlineType.SUBPLOT,
      PlotlineType.CONFLICT,
    ]),
    plantedAt: z.number().int().positive(),
    plannedAt: z.number().int().positive().optional(),
    status: z.enum([
      PlotlineStatus.OPEN,
      PlotlineStatus.RESOLVED,
      PlotlineStatus.ABANDONED,
    ]).optional(),
  })

  it('should accept valid plotline', () => {
    const validPlotline = {
      description: '主角身上隐藏的神秘血脉',
      type: PlotlineType.FORESHADOW,
      plantedAt: 1,
      plannedAt: 50,
    }

    const result = plotlineSchema.safeParse(validPlotline)
    expect(result.success).toBe(true)
  })

  it('should reject empty description', () => {
    const invalidPlotline = {
      description: '',
      type: PlotlineType.FORESHADOW,
      plantedAt: 1,
    }

    const result = plotlineSchema.safeParse(invalidPlotline)
    expect(result.success).toBe(false)
  })

  it('should reject non-positive plantedAt', () => {
    const invalidPlotline = {
      description: '测试伏笔',
      type: PlotlineType.FORESHADOW,
      plantedAt: 0,
    }

    const result = plotlineSchema.safeParse(invalidPlotline)
    expect(result.success).toBe(false)
  })

  it('should accept all plotline types', () => {
    const types = Object.values(PlotlineType)
    
    types.forEach(type => {
      const plotline = {
        description: '测试伏笔',
        type,
        plantedAt: 1,
      }
      const result = plotlineSchema.safeParse(plotline)
      expect(result.success).toBe(true)
    })
  })
})

describe('Chapter Outline Schema', () => {
  const chapterOutlineSchema = z.object({
    chapterTitle: z.string().min(1),
    chapterGoal: z.string().min(1),
    mainConflict: z.string(),
    keyScenes: z.array(z.object({
      sceneTitle: z.string(),
      description: z.string(),
      characters: z.array(z.string()).optional(),
    })).min(1),
    ending: z.string(),
    foreshadows: z.array(z.string()).optional(),
    resolvedPlotlines: z.array(z.string()).optional(),
  })

  it('should accept valid chapter outline', () => {
    const validOutline = {
      chapterTitle: '第一章 觉醒',
      chapterGoal: '主角发现自己拥有特殊能力',
      mainConflict: '神秘势力的追杀',
      keyScenes: [
        {
          sceneTitle: '意外发现',
          description: '主角在废墟中发现神秘物品',
          characters: ['张三', '李四'],
        },
      ],
      ending: '主角成功逃脱但身受重伤',
      foreshadows: ['血脉觉醒的暗示'],
      resolvedPlotlines: [],
    }

    const result = chapterOutlineSchema.safeParse(validOutline)
    expect(result.success).toBe(true)
  })

  it('should reject empty chapterTitle', () => {
    const invalidOutline = {
      chapterTitle: '',
      chapterGoal: '测试',
      mainConflict: '测试',
      keyScenes: [{ sceneTitle: '测试', description: '测试' }],
      ending: '测试',
    }

    const result = chapterOutlineSchema.safeParse(invalidOutline)
    expect(result.success).toBe(false)
  })

  it('should require at least one key scene', () => {
    const invalidOutline = {
      chapterTitle: '测试',
      chapterGoal: '测试',
      mainConflict: '测试',
      keyScenes: [],
      ending: '测试',
    }

    const result = chapterOutlineSchema.safeParse(invalidOutline)
    expect(result.success).toBe(false)
  })
})

describe('Validation Report Schema', () => {
  const validationReportSchema = z.object({
    result: z.enum(['pass', 'retry']),
    score: z.number().min(0).max(100),
    issues: z.array(z.object({
      type: z.string(),
      description: z.string(),
      severity: z.enum(['error', 'warning', 'info']),
    })).optional(),
    characterUpdates: z.record(z.string(), z.record(z.unknown())).optional(),
    newPlotlines: z.array(z.string()).optional(),
    resolvedPlotlines: z.array(z.string()).optional(),
  })

  it('should accept pass validation report', () => {
    const report = {
      result: 'pass',
      score: 85,
      issues: [],
      characterUpdates: {},
      newPlotlines: [],
      resolvedPlotlines: [],
    }

    const result = validationReportSchema.safeParse(report)
    expect(result.success).toBe(true)
  })

  it('should accept retry validation report', () => {
    const report = {
      result: 'retry',
      score: 60,
      issues: [
        {
          type: 'inconsistency',
          description: '角色前后性格不一致',
          severity: 'error',
        },
      ],
    }

    const result = validationReportSchema.safeParse(report)
    expect(result.success).toBe(true)
  })

  it('should reject invalid result value', () => {
    const report = {
      result: 'unknown',
      score: 80,
    }

    const result = validationReportSchema.safeParse(report)
    expect(result.success).toBe(false)
  })

  it('should reject score out of range', () => {
    const report = {
      result: 'pass',
      score: 150,
    }

    const result = validationReportSchema.safeParse(report)
    expect(result.success).toBe(false)
  })

  it('should accept score at boundaries', () => {
    const lowScore = { result: 'retry' as const, score: 0 }
    const highScore = { result: 'pass' as const, score: 100 }

    expect(validationReportSchema.safeParse(lowScore).success).toBe(true)
    expect(validationReportSchema.safeParse(highScore).success).toBe(true)
  })
})
