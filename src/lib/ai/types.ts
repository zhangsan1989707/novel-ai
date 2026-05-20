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
  timeoutMs?: number
  responseFormat?: Record<string, unknown>
}

// ============================================
// 生成结果
// ============================================

export interface GenerationResult {
  content: string
  wordCount?: number
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
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

  /**
   * 图片生成（可选）
   */
  generateImage?(prompt: string, params?: ImageGenerationParams): Promise<ImageGenerationResult>
}

// ============================================
// 图片生成
// ============================================

export interface ImageGenerationParams {
  size?: '1024x1024' | '1792x1024' | '1024x1792' | string
  quality?: 'standard' | 'hd'
  style?: 'vivid' | 'natural'
  numImages?: number
}

export interface ImageGenerationResult {
  imageUrls: string[]
  promptTokens?: number
  cost?: number
  revisedPrompt?: string
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
  memoryContext?: string
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
