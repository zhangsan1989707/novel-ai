/**
 * 章节生成契约 - 统一生成参数
 */
import type { GenerationSpeedMode } from '@/lib/ai/speed-mode'

export interface ChapterGenerationContract {
  projectId: number
  chapterNo: number
  expectedTitle: string
  expectedSummary: string
  targetWordCount: number
  minWordCount: number
  maxWordCount: number
  mode: GenerationSpeedMode
}

export function createChapterContract(params: {
  projectId: number
  chapterNo: number
  title?: string
  summary?: string
  targetWordCount: number
  mode: GenerationSpeedMode
}): ChapterGenerationContract {
  const { projectId, chapterNo, title, summary, targetWordCount, mode } = params
  
  // 字数范围：目标字数的 80% ~ 150%
  const minWordCount = Math.floor(targetWordCount * 0.8)
  const maxWordCount = Math.floor(targetWordCount * 1.5)
  
  return {
    projectId,
    chapterNo,
    expectedTitle: title || `第${chapterNo}章`,
    expectedSummary: summary || '',
    targetWordCount,
    minWordCount,
    maxWordCount,
    mode,
  }
}
