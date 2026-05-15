/**
 * Agent Prompts - 统一从新模块导入
 * @deprecated 请使用 @/lib/prompts 中的对应函数
 * 
 * @example
 * // 旧方式 (deprecated)
 * import { buildWriterPrompt } from './prompts'
 * 
 * // 新方式
 * import { buildWriterPrompt } from '@/lib/prompts'
 */

// Re-export from new module for backward compatibility
export {
  buildPlannerPrompt,
  buildWriterPrompt,
  buildPolisherPrompt,
  buildValidatorPrompt,
  buildSummarizerPrompt,
} from '@/lib/prompts'

// Re-export types for backward compatibility
export type {
  PlannerPromptInput,
  WriterPromptInput,
  PolisherPromptInput,
  ValidatorPromptInput,
  SummarizerPromptInput,
} from '@/lib/prompts'
