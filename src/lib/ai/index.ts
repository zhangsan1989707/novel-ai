// AI Provider
export {
  AIProviderFactory,
  getAIProvider,
  createProviderFromEnv,
  createProviderFromDefaultConfig,
  createProviderFromConfigId,
  getSupportedAIProviders,
  getDefaultVendor,
  getDefaultAIConfig,
} from './factory'
export type { AIProvider, AIConfig } from './types'

// 提示词构建
export {
  buildNovelGenerationPrompt,
  buildRevisionPrompt,
  buildOutlineGenerationPrompt,
  buildIdeaGenerationPrompt,
  buildPlotAnalysisPrompt,
  buildSynopsisGenerationPrompt,
} from './prompts'

// 上下文管理
export {
  calculateStage,
  getStageName,
  getStageChapterRange,
  extractStageOutline,
  buildPromptContext,
  getContextSummary,
  getVolumeChapterRange,
} from './context-manager'
