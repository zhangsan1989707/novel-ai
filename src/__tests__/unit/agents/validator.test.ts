import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/ai/service', () => ({
  AIService: {
    createProvider: vi.fn().mockResolvedValue({
      generate: vi.fn(),
      generateStream: vi.fn()
    })
  }
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    aIModelConfig: {
      findFirst: vi.fn().mockResolvedValue({
        vendor: 'DEEPSEEK',
        modelId: 'deepseek-chat'
      })
    }
  }
}));

describe('validatorAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should export validatorAgent function', async () => {
      const { validatorAgent } = await import('@/lib/agents/validator');
      expect(typeof validatorAgent).toBe('function');
    });
  });

  describe('validation result', () => {
    it('should return valid structure for content validation', async () => {
      const { AIService } = await import('@/lib/ai/service');
      const { validatorAgent } = await import('@/lib/agents/validator');

      const mockProvider = {
        generate: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            result: 'pass',
            score: 85,
            issues: []
          })
        }),
        generateStream: vi.fn()
      };

      (AIService.createProvider as any).mockResolvedValue(mockProvider);

      const result = await validatorAgent({
        projectId: 1,
        chapterNo: 1,
        newChapterContent: '这是一段符合要求的小说正文...',
        worldSetting: '修仙世界',
        characterProfiles: [],
        recentSummaries: [],
        openPlotlines: []
      });

      expect(result).toBeDefined();
      expect(result.result).toBe('pass');
      expect(result.score).toBe(85);
    });

    it('should detect content with issues', async () => {
      const { AIService } = await import('@/lib/ai/service');
      const { validatorAgent } = await import('@/lib/agents/validator');

      const mockProvider = {
        generate: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            result: 'retry',
            score: 60,
            issues: [
              { type: 'INCONSISTENCY', description: '角色性格前后不一致' }
            ]
          })
        }),
        generateStream: vi.fn()
      };

      (AIService.createProvider as any).mockResolvedValue(mockProvider);

      const result = await validatorAgent({
        projectId: 1,
        chapterNo: 1,
        newChapterContent: '存在问题的正文...',
        worldSetting: '修仙世界',
        characterProfiles: [],
        recentSummaries: [],
        openPlotlines: []
      });

      expect(result.result).toBe('retry');
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  describe('character consistency check', () => {
    it('should validate character consistency', async () => {
      const { AIService } = await import('@/lib/ai/service');
      const { validatorAgent } = await import('@/lib/agents/validator');

      const mockProvider = {
        generate: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            result: 'pass',
            score: 90,
            issues: []
          })
        }),
        generateStream: vi.fn()
      };

      (AIService.createProvider as any).mockResolvedValue(mockProvider);

      await validatorAgent({
        projectId: 1,
        chapterNo: 1,
        newChapterContent: '正文内容...',
        worldSetting: '修仙世界',
        characterProfiles: [
          {
            id: 1,
            name: '张三',
            role: 'PROTAGONIST',
            personality: '坚毅果敢',
            appearance: ''
          }
        ],
        recentSummaries: [],
        openPlotlines: []
      });

      expect(mockProvider.generate).toHaveBeenCalled();
      const callArgs = mockProvider.generate.mock.calls[0][0];
      expect(callArgs).toContain('张三');
    });
  });

  describe('plotline tracking', () => {
    it('should check plotline consistency', async () => {
      const { AIService } = await import('@/lib/ai/service');
      const { validatorAgent } = await import('@/lib/agents/validator');

      const mockProvider = {
        generate: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            result: 'pass',
            score: 80,
            issues: []
          })
        }),
        generateStream: vi.fn()
      };

      (AIService.createProvider as any).mockResolvedValue(mockProvider);

      await validatorAgent({
        projectId: 1,
        chapterNo: 1,
        newChapterContent: '正文内容...',
        worldSetting: '修仙世界',
        characterProfiles: [],
        recentSummaries: [],
        openPlotlines: [
          {
            id: 'pl-001',
            description: '主角身世之谜',
            status: 'OPEN',
            plantedAt: 1
          }
        ]
      });

      expect(mockProvider.generate).toHaveBeenCalled();
      const callArgs = mockProvider.generate.mock.calls[0][0];
      expect(callArgs).toContain('主角身世之谜');
    });
  });

  describe('error handling', () => {
    it('should handle AI provider errors', async () => {
      const { AIService } = await import('@/lib/ai/service');
      const { validatorAgent } = await import('@/lib/agents/validator');

      const mockProvider = {
        generate: vi.fn().mockRejectedValue(new Error('AI provider error')),
        generateStream: vi.fn()
      };

      (AIService.createProvider as any).mockResolvedValue(mockProvider);

      await expect(
        validatorAgent({
          projectId: 1,
          chapterNo: 1,
          newChapterContent: '测试内容',
          worldSetting: '测试',
          characterProfiles: [],
          recentSummaries: [],
          openPlotlines: []
        })
      ).rejects.toThrow('AI provider error');
    });

    it('should handle malformed JSON response', async () => {
      const { AIService } = await import('@/lib/ai/service');
      const { validatorAgent } = await import('@/lib/agents/validator');

      const mockProvider = {
        generate: vi.fn().mockResolvedValue({
          content: 'not valid json'
        }),
        generateStream: vi.fn()
      };

      (AIService.createProvider as any).mockResolvedValue(mockProvider);

      const result = await validatorAgent({
        projectId: 1,
        chapterNo: 1,
        newChapterContent: '测试内容',
        worldSetting: '测试',
        characterProfiles: [],
        recentSummaries: [],
        openPlotlines: []
      });

      expect(result).toBeDefined();
    });
  });
});
