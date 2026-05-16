import type { AIVendor } from '@/types'

// ============================================
// AI 配置类型
// ============================================

export interface AIConfig {
  vendor: AIVendor
  modelId: string
  apiKey: string
  apiEndpoint?: string
}

// ============================================
// 生成参数
// ============================================

export interface GenerationParams {
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  stop?: string[]
}

// ============================================
// 生成结果
// ============================================

export interface GenerationResult {
  content: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  cost?: number // 本次调用的费用（单位：元）
  finishReason?: 'stop' | 'length' | 'content_filter' | 'error'
}

// ============================================
// AI Provider 接口
// ============================================

export interface AIProvider {
  readonly name: string
  readonly vendor: AIVendor

  /**
   * 非流式生成
   */
  generate(prompt: string, params?: GenerationParams): Promise<GenerationResult>

  /**
   * 流式生成（返回 AsyncGenerator）
   */
  generateStream(prompt: string, params?: GenerationParams): AsyncGenerator<string>

  /**
   * 验证配置是否有效
   */
  validateConfig(config: AIConfig): boolean
}

// ============================================
// 提示词构建
// ============================================

export interface PromptContext {
  projectTitle: string
  genre?: string
  writingStyle?: string
  worldSetting?: string
  powerSystem?: string
  protagonistProfile?: string
  protagonistGoal?: string
  antagonistSetting?: string
  endingPlan?: string
  writingPrompt?: string
  currentChapterNumber: number
  currentChapterTitle: string
  currentChapterSummary?: string
  previousChapters?: {
    chapterNumber: number
    title: string
    content: string
  }[]
  stageOutline?: string
  virtualWriterStyle?: {
    styleFeatures?: string
    vocabularyFeatures?: string
    sentenceFeatures?: string
    rhetoricFeatures?: string
    themeFeatures?: string
  }
}

export interface BuildPromptOptions {
  useContext: boolean
  contextChapterCount: number
  targetWordCount: number
  includeStageOutline: boolean
}
