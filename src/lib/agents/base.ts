import type { AgentType } from '@/lib/engine/types'

export enum ModelTier {
  OPUS = 'opus',
  SONNET = 'sonnet',
  HAIKU = 'haiku',
}

export interface AgentDefinition<TInput = unknown, TOutput = unknown> {
  readonly type: AgentType
  readonly name: string
  readonly description: string
  readonly modelTier: ModelTier
  readonly supportsStreaming: boolean

  execute(input: TInput, context?: AgentExecutionContext): Promise<TOutput>
  executeStream?(input: TInput, onChunk: (chunk: string) => void, context?: AgentExecutionContext): Promise<TOutput>
  validate?(output: TOutput): ValidationResult
}

export interface AgentExecutionContext {
  projectId: number
  chapterNo?: number
  userId?: number
  signal?: AbortSignal
}

export interface ValidationResult {
  valid: boolean
  score?: number
  issues?: ValidationIssue[]
}

export interface ValidationIssue {
  severity: 'error' | 'warning'
  message: string
  field?: string
}
