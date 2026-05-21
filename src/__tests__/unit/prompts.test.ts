import { describe, it, expect } from 'vitest'
import {
  buildChapterListPrompt,
  buildWriterPrompt,
  buildPlannerPrompt,
  buildPolisherPrompt,
  buildValidatorPrompt,
  buildSummarizerPrompt,
} from '@/lib/prompts'

describe('Prompt Builders', () => {
  describe('buildChapterListPrompt', () => {
    it('should build prompt with required fields', () => {
      const input = {
        projectTitle: '我的玄幻小说',
        genre: '玄幻',
        totalChapters: 50,
        titleStyle: 'webnovel' as const,
      }

      const result = buildChapterListPrompt(input)

      expect(result).toContain('我的玄幻小说')
      expect(result).toContain('玄幻')
      expect(result).toContain('50')
    })

    it('should include optional settings', () => {
      const input = {
        projectTitle: '测试小说',
        genre: '都市',
        writingStyle: '轻松幽默',
        worldSetting: '现代都市',
        protagonistProfile: '普通大学生',
        protagonistGoal: '成为首富',
        antagonistSetting: '商业巨头',
        endingPlan: '主角成功登顶',
        totalChapters: 30,
        titleStyle: 'traditional' as const,
      }

      const result = buildChapterListPrompt(input)

      expect(result).toContain('轻松幽默')
      expect(result).toContain('现代都市')
      expect(result).toContain('普通大学生')
      expect(result).toContain('成为首富')
    })

    it('should handle webnovel title style', () => {
      const input = {
        projectTitle: '网文小说',
        totalChapters: 100,
        titleStyle: 'webnovel' as const,
      }

      const result = buildChapterListPrompt(input)
      expect(result).toContain('网文风格')
      expect(result).toContain('吸睛')
    })

    it('should handle poetry title style', () => {
      const input = {
        projectTitle: '古风小说',
        genre: '古言',
        totalChapters: 20,
        titleStyle: 'poetry' as const,
      }

      const result = buildChapterListPrompt(input)
      expect(result).toContain('诗词风格')
    })

    it('should handle traditional title style', () => {
      const input = {
        projectTitle: '传统小说',
        genre: '武侠',
        totalChapters: 50,
        titleStyle: 'traditional' as const,
      }

      const result = buildChapterListPrompt(input)
      expect(result).toContain('传统风格')
    })

    it('should include chapter count in output', () => {
      const input = {
        projectTitle: '测试',
        totalChapters: 50,
        titleStyle: 'webnovel' as const,
      }

      const result = buildChapterListPrompt(input)
      // 新提示词使用 "EXACTLY" 强调章节数量控制
      expect(result).toContain('EXACTLY 50')
      expect(result).toContain('50')
    })
  })

  describe('buildWriterPrompt', () => {
    it('should build prompt with outline', () => {
      const input = {
        projectTitle: '测试小说',
        genre: '玄幻',
        writingStyle: '热血激昂',
        worldSetting: '修仙世界',
        powerSystem: '筑基-金丹-元婴',
        chapterNo: 1,
        outline: {
          chapterTitle: '第一章 觉醒',
          chapterGoal: '主角发现自己能力',
          mainConflict: '神秘势力追杀',
          keyScenes: [
            { scene: '发现神秘物品并被迫逃离', characters: ['张三'], emotion: '惊惧' },
          ],
          ending: '成功逃脱',
          foreshadows: ['血脉觉醒'],
          resolvedPlotlines: [],
        },
        characterProfiles: '【张三】主角：高大威猛',
        recentSummaries: '第0章：主角出场',
        targetWordCount: 3000,
      }

      const result = buildWriterPrompt(input)

      expect(result).toContain('测试小说')
      expect(result).toContain('第一章 觉醒')
      expect(result).toContain('主角发现自己能力')
    })

    it('should include character profiles', () => {
      const input = {
        projectTitle: '测试',
        genre: '玄幻',
        chapterNo: 5,
        outline: {
          chapterTitle: '第五章',
          chapterGoal: '测试',
          mainConflict: '测试',
          keyScenes: [],
          ending: '测试',
          foreshadows: [],
          resolvedPlotlines: [],
        },
        characterProfiles: '【李四】反派：阴险狡诈',
        recentSummaries: '',
        targetWordCount: 3000,
      }

      const result = buildWriterPrompt(input)

      expect(result).toContain('李四')
      expect(result).toContain('反派')
    })

    it('should include world setting', () => {
      const input = {
        projectTitle: '测试',
        genre: '玄幻',
        worldSetting: '修仙世界，灵气复苏',
        chapterNo: 1,
        outline: {
          chapterTitle: '测试',
          chapterGoal: '测试',
          mainConflict: '测试',
          keyScenes: [],
          ending: '测试',
          foreshadows: [],
          resolvedPlotlines: [],
        },
        characterProfiles: '',
        recentSummaries: '',
        targetWordCount: 3000,
      }

      const result = buildWriterPrompt(input)

      expect(result).toContain('修仙世界')
      expect(result).toContain('世界观')
    })

    it('should include power system', () => {
      const input = {
        projectTitle: '测试',
        genre: '玄幻',
        powerSystem: '筑基-金丹-元婴',
        chapterNo: 1,
        outline: {
          chapterTitle: '测试',
          chapterGoal: '测试',
          mainConflict: '测试',
          keyScenes: [],
          ending: '测试',
          foreshadows: [],
          resolvedPlotlines: [],
        },
        characterProfiles: '',
        recentSummaries: '',
        targetWordCount: 3000,
      }

      const result = buildWriterPrompt(input)

      expect(result).toContain('筑基-金丹-元婴')
      expect(result).toContain('力量体系')
    })

    it('should include recent summaries', () => {
      const input = {
        projectTitle: '测试',
        genre: '玄幻',
        chapterNo: 3,
        outline: {
          chapterTitle: '第三章',
          chapterGoal: '测试',
          mainConflict: '测试',
          keyScenes: [],
          ending: '测试',
          foreshadows: [],
          resolvedPlotlines: [],
        },
        characterProfiles: '',
        recentSummaries: '第1章：主角登场\n第2章：获得能力',
        targetWordCount: 3000,
      }

      const result = buildWriterPrompt(input)

      expect(result).toContain('前情摘要')
      expect(result).toContain('第1章')
    })

    it('should include word count in task section', () => {
      const input = {
        projectTitle: '测试',
        chapterNo: 1,
        outline: {
          chapterTitle: '测试',
          chapterGoal: '测试',
          mainConflict: '测试',
          keyScenes: [],
          ending: '测试',
          foreshadows: [],
          resolvedPlotlines: [],
        },
        characterProfiles: '',
        recentSummaries: '',
        targetWordCount: 3000,
      }

      const result = buildWriterPrompt(input)

      expect(result).toContain('字数要求')
      // 2400-3600 (3000 * 0.8 - 3000 * 1.2)
      expect(result).toContain('2400')
    })
  })

  describe('buildPolisherPrompt', () => {
    it('should build prompt with content', () => {
      const input = {
        content: '这是待润色的内容。',
        chapterNo: 1,
        styleGuide: '热血激昂',
      }

      const result = buildPolisherPrompt(input)

      expect(result).toContain('这是待润色的内容')
      expect(result).toContain('热血激昂')
    })
  })

  describe('buildValidatorPrompt', () => {
    it('should build prompt for validation', () => {
      const input = {
        chapterNo: 1,
        newChapterContent: '这是待校验的内容。',
        characterProfiles: '张三：主角',
        recentSummaries: '前章摘要',
        worldSetting: '修仙世界',
        openPlotlines: '神秘血脉',
      }

      const result = buildValidatorPrompt(input)

      expect(result).toContain('这是待校验的内容')
      expect(result).toContain('修仙世界')
    })
  })

  describe('buildSummarizerPrompt', () => {
    it('should build prompt for summarization', () => {
      const input = {
        chapterTitle: '第一章',
        chapterNo: 1,
        chapterContent: '这是待摘要的内容。',
        worldSetting: '修仙世界',
        protagonistProfile: '普通少年',
      }

      const result = buildSummarizerPrompt(input)

      expect(result).toContain('第一章')
      expect(result).toContain('这是待摘要的内容')
    })
  })
})
