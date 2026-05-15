/**
 * AI Prompts - 统一从新模块导入
 * @deprecated 请使用 @/lib/prompts 中的对应函数
 * 
 * @example
 * // 旧方式 (deprecated)
 * import { buildNovelGenerationPrompt } from '@/lib/ai/prompts'
 * 
 * // 新方式
 * import { buildNovelGenerationPrompt } from '@/lib/prompts'
 */

// Re-export novel prompts for backward compatibility
export {
  buildNovelGenerationPrompt,
  buildRevisionPrompt,
  buildOutlineGenerationPrompt,
  buildEndingPrompt,
  buildSynopsisGenerationPrompt,
  buildChapterListPrompt,
  buildIdeaGenerationPrompt,
} from '@/lib/prompts'

// Re-export analysis prompts for backward compatibility
export {
  buildPlotAnalysisPrompt,
} from '@/lib/prompts'

// Re-export types for backward compatibility
export type {
  RevisionType,
  OutlineGenerationInput,
  EndingGenerationInput,
  SynopsisGenerationInput,
  ChapterListGenerationInput,
  IdeaGenerationInput,
  PlotAnalysisInput,
  PlotAnalysisOptions,
} from '@/lib/prompts'
