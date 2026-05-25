/**
 * 提示词模块 - 统一导出
 * 
 * @example
 * import { buildWriterPrompt } from '@/lib/prompts'
 * import { buildNovelGenerationPrompt } from '@/lib/prompts'
 */

// ============================================
// 共享常量和工具
// ============================================
export * from './shared/constants'

// ============================================
// 章节 Agent 提示词
// ============================================
export {
  buildPlannerPrompt,
  type PlannerPromptInput,
} from './chapter/planning'

export {
  buildWriterPrompt,
  type WriterPromptInput,
} from './chapter/writing'

export {
  buildPolisherPrompt,
  type PolisherPromptInput,
} from './chapter/polishing'

export {
  buildValidatorPrompt,
  type ValidatorPromptInput,
} from './chapter/validating'

export {
  buildSummarizerPrompt,
  type SummarizerPromptInput,
} from './chapter/summarizing'

// ============================================
// 小说创作提示词
// ============================================
export { buildNovelGenerationPrompt } from './novel/generation'
export {
  buildRevisionPrompt,
  type RevisionType,
} from './novel/revision'
export {
  buildOutlineGenerationPrompt,
  type OutlineGenerationInput,
} from './novel/outline'
export {
  buildEndingPrompt,
  type EndingGenerationInput,
} from './novel/ending'
export {
  buildSynopsisGenerationPrompt,
  type SynopsisGenerationInput,
} from './novel/synopsis'
export {
  buildChapterListPrompt,
  buildSummaryCompletionPrompt,
  type ChapterListGenerationInput,
} from './novel/chapter-list'
export {
  buildIdeaGenerationPrompt,
  type IdeaGenerationInput,
} from './novel/idea'
export {
  buildTitleGenerationPrompt,
  type TitleGenerationInput,
} from './novel/title'

// ============================================
// 分析提示词
// ============================================
export {
  buildPlotAnalysisPrompt,
  type PlotAnalysisInput,
  type PlotAnalysisOptions,
} from './analysis'

// ============================================
// 研究提示词
// ============================================
export {
  buildResearchPrompt,
  type ResearchPromptInput,
} from './research'
