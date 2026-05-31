import { describe, it, expect, vi } from 'vitest';

const mockGenerate = vi.fn();

vi.mock('@/lib/ai/factory', () => ({
  createAIProvider: vi.fn(() => ({
    generate: mockGenerate,
    generateStream: vi.fn()
  })),
  getDefaultVendor: vi.fn(() => 'DEEPSEEK'),
  getDefaultModel: vi.fn(() => 'deepseek-chat')
}));

describe('plannerAgent', () => {
  beforeEach(() => {
    mockGenerate.mockReset();
  });

  describe('basic functionality', () => {
    it('should export plannerAgent function', async () => {
      const { plannerAgent } = await import('@/lib/agents/planner');
      expect(typeof plannerAgent).toBe('function');
    });
  });

  describe('input validation', () => {
    it('should validate required input fields', async () => {
      const { plannerAgent } = await import('@/lib/agents/planner');

      const invalidInput = {
        projectId: 1,
        chapterNo: 0
      } as any;

      await expect(
        plannerAgent(invalidInput, undefined, { generate: mockGenerate } as any)
      ).rejects.toThrow();
    });

    it('should reject negative chapter number', async () => {
      const { plannerAgent } = await import('@/lib/agents/planner');

      const invalidInput = {
        projectId: 1,
        chapterNo: -1
      } as any;

      await expect(
        plannerAgent(invalidInput, undefined, { generate: mockGenerate } as any)
      ).rejects.toThrow();
    });
  });

  describe('output structure', () => {
    it('should return valid outline structure on success', async () => {
      const { plannerAgent } = await import('@/lib/agents/planner');

      mockGenerate.mockResolvedValueOnce({
        content: JSON.stringify({
          chapterTitle: '第一章 起点',
          chapterGoal: '建立主角背景',
          mainConflict: '主角遭遇危机',
          keyScenes: [
            { scene: '场景1', description: '描述1' }
          ],
          ending: '危机暂时解除',
          foreshadows: [],
          resolvedPlotlines: []
        })
      });

      const result = await plannerAgent({
        projectId: 1,
        chapterNo: 1,
        characterProfiles: [],
        openPlotlines: [],
        emotionalArc: [],
        targetWordCount: 3000,
        recentChapterSummaries: [],
        provider: { generate: mockGenerate } as any
      } as any);

      expect(result).toBeDefined();
      expect(result.outline).toBeDefined();
      expect(result.outline.chapterTitle).toBe('第一章 起点');
      expect(result.outline.chapterGoal).toBe('建立主角背景');
    });

    it('should handle missing optional fields', async () => {
      const { plannerAgent } = await import('@/lib/agents/planner');

      mockGenerate.mockResolvedValueOnce({
        content: JSON.stringify({
          chapterTitle: '测试章节',
          chapterGoal: '测试目标'
        })
      });

      const result = await plannerAgent({
        projectId: 1,
        chapterNo: 1,
        characterProfiles: [],
        openPlotlines: [],
        emotionalArc: [],
        targetWordCount: 3000,
        recentChapterSummaries: [],
        provider: { generate: mockGenerate } as any
      } as any);

      expect(result).toBeDefined();
      expect(result.outline.chapterTitle).toBe('测试章节');
    });
  });

  describe('error handling', () => {
    it('should handle AI provider errors', async () => {
      const { plannerAgent } = await import('@/lib/agents/planner');

      mockGenerate.mockRejectedValueOnce(new Error('AI provider unavailable'));

      await expect(
        plannerAgent({
          projectId: 1,
          chapterNo: 1,
          characterProfiles: [],
          openPlotlines: [],
          emotionalArc: [],
          targetWordCount: 3000,
          recentChapterSummaries: [],
          provider: { generate: mockGenerate } as any
        } as any)
      ).rejects.toThrow('AI provider unavailable');
    });

    it('should handle invalid JSON response', async () => {
      const { plannerAgent } = await import('@/lib/agents/planner');

      mockGenerate.mockResolvedValueOnce({
        content: 'invalid json response'
      }).mockResolvedValueOnce({
        content: 'still invalid'
      });

      const result = await plannerAgent({
        projectId: 1,
        chapterNo: 1,
        characterProfiles: [],
        openPlotlines: [],
        emotionalArc: [],
        targetWordCount: 3000,
        recentChapterSummaries: [],
        provider: { generate: mockGenerate } as any
      } as any);

      expect(result).toBeDefined();
    });
  });

  describe('character context', () => {
    it('should include character information in prompt', async () => {
      const { plannerAgent } = await import('@/lib/agents/planner');

      mockGenerate.mockResolvedValueOnce({
        content: JSON.stringify({
          chapterTitle: '第一章',
          chapterGoal: '建立角色'
        })
      });

      const input = {
        projectId: 1,
        chapterNo: 1,
        characterProfiles: [
          { name: '张三', role: 'PROTAGONIST', personality: '坚毅' }
        ],
        openPlotlines: [],
        emotionalArc: [],
        targetWordCount: 3000,
        recentChapterSummaries: [],
        provider: { generate: mockGenerate } as any
      };

      await plannerAgent(input as any);

      expect(mockGenerate).toHaveBeenCalled();
      const callArgs = mockGenerate.mock.calls[0][0];
      expect(callArgs).toContain('张三');
    });
  });

  describe('plotline tracking', () => {
    it('should include open plotlines in context', async () => {
      const { plannerAgent } = await import('@/lib/agents/planner');

      mockGenerate.mockResolvedValueOnce({
        content: JSON.stringify({
          chapterTitle: '第一章',
          chapterGoal: '埋设伏笔'
        })
      });

      const input = {
        projectId: 1,
        chapterNo: 1,
        openPlotlines: [
          { id: 'pl-001', description: '主角身世之谜' }
        ],
        emotionalArc: [],
        targetWordCount: 3000,
        recentChapterSummaries: [],
        provider: { generate: mockGenerate } as any
      };

      await plannerAgent(input as any);

      expect(mockGenerate).toHaveBeenCalled();
      const callArgs = mockGenerate.mock.calls[0][0];
      expect(callArgs).toContain('主角身世之谜');
    });
  });
});
