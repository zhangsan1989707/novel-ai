// ============================================
// 枚举类型
// ============================================

export enum ProjectStatus {
  DRAFT = 'DRAFT',
  WRITING = 'WRITING',
  COMPLETED = 'COMPLETED',
  PAUSED = 'PAUSED',
}

export enum ChapterStatus {
  DRAFT = 'DRAFT',
  GENERATING = 'GENERATING',
  COMPLETED = 'COMPLETED',
  REVIEWING = 'REVIEWING',
}

export enum WriterType {
  REAL_AUTHOR = 'REAL_AUTHOR',
  CUSTOM = 'CUSTOM',
}

export enum TrainingStatus {
  UNTRAINED = 'UNTRAINED',
  TRAINING = 'TRAINING',
  TRAINED = 'TRAINED',
  FAILED = 'FAILED',
}

export enum DocumentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum AIVendor {
  OPENAI = 'OPENAI',
  ANTHROPIC = 'ANTHROPIC',
  ALIBABA = 'ALIBABA',
  DEEPSEEK = 'DEEPSEEK',
  MINIMAX = 'MINIMAX',
  VOLCENGINE = 'VOLCENGINE',
}

// 拆书分析维度
export enum AnalysisDimension {
  CHARACTER_RELATION = 'CHARACTER_RELATION',   // 人物关系
  PLOT_LINE = 'PLOT_LINE',                     // 剧情线
  FORESHADOWING = 'FORESHADOWING',             // 伏笔悬念
  CHAPTER_STRUCTURE = 'CHAPTER_STRUCTURE',     // 章节结构
  WORLD_SETTING = 'WORLD_SETTING'             // 世界观设定
}

// 分析类型
export enum AnalysisType {
  BREAKDOWN = 'BREAKDOWN',     // 拆书分析
  CONTINUATION = 'CONTINUATION' // 续写（未来）
}

// 续写模式
export enum ContinuationMode {
  ENDING = 'ending',      // 续写结局
  CONTINUE = 'continue',  // 继续创作
  REWRITE = 'rewrite'     // 全文重写
}

// 结局方向
export enum EndingDirection {
  HAPPY = 'happy',   // 幸福结局
  TRAGIC = 'tragic', // 悲剧结局
  OPEN = 'open'      // 开放式结局
}

// 项目模式
export enum ProjectMode {
  CREATE = 'CREATE',    // 创作模式
  ANALYZE = 'ANALYZE'  // 拆解模式
}

// ============================================
// 类型定义
// ============================================

export interface AIModelConfig {
  id: number
  name: string
  vendor: AIVendor
  modelId: string
  apiKey?: string
  apiEndpoint?: string
  isDefault: boolean
}

export interface NovelProject {
  id: number
  title: string
  description?: string
  genre?: string
  writingStyle?: string
  targetWordCount?: number
  currentWordCount: number
  chapterWordCount: number
  outline?: string
  outlineStages?: OutlineStages
  worldSetting?: string
  powerSystem?: string
  protagonistProfile?: string
  protagonistGoal?: string
  antagonistSetting?: string
  endingPlan?: string
  writingPrompt?: string
  targetAudience?: 'MALE' | 'FEMALE'
  status: ProjectStatus
  coverImage?: string
  totalVolumes: number
  aiModelId?: number
  aiModelConfig?: AIModelConfig
  creatorId: number
  creator?: User
  chapters?: NovelChapter[]
  createdAt: string
  updatedAt: string
}

export interface OutlineStages {
  stage1?: OutlineStage[]
  stage2?: OutlineStage[]
  stage3?: OutlineStage[]
  stage4?: OutlineStage[]
}

export interface OutlineStage {
  title: string
  summary: string
  estimatedWordCount?: number
}

export interface NovelChapter {
  id: number
  projectId: number
  project?: NovelProject
  chapterNumber: number
  title: string
  content?: string
  summary?: string
  wordCount: number
  status: ChapterStatus
  generationPrompt?: string
  generationParams?: GenerationParams
  generationCount: number
  lastGeneratedTime?: string
  sortOrder: number
  virtualWriterId?: number
  virtualWriter?: VirtualWriter
  versions?: ChapterVersion[]
  createdAt: string
  updatedAt: string
}

export interface VirtualWriter {
  id: number
  name: string
  description?: string
  writerType: WriterType
  styleFeatures?: string
  vocabularyFeatures?: string
  sentenceFeatures?: string
  rhetoricFeatures?: string
  themeFeatures?: string
  trainingStatus: TrainingStatus
  trainingProgress: number
  trainedAt?: string
  documentCount: number
  totalWordCount: number
  isPublic: boolean
  tags?: string
  creatorId: number
  creator?: User
  documents?: WriterDocument[]
  chapters?: NovelChapter[]
  createdAt: string
  updatedAt: string
}

export interface WriterDocument {
  id: number
  virtualWriterId: number
  virtualWriter?: VirtualWriter
  fileName: string
  filePath: string
  fileSize: number
  wordCount: number
  status: DocumentStatus
  errorMessage?: string
  createdAt: string
  processedAt?: string
}

export interface ChapterVersion {
  id: number
  chapterId: number
  chapter?: NovelChapter
  content: string
  wordCount: number
  prompt?: string
  versionNumber: number
  createdAt: string
}

export interface BookAnalysis {
  id: string
  projectId: number
  project?: NovelProject
  volumeNumber: number  // -1=整书, 0=全卷, 1-N=具体卷
  analysisType: AnalysisType
  dimension: AnalysisDimension
  analysisData: Record<string, unknown>
  rawContent?: string
  wordCount?: number
  createdAt: string
  updatedAt: string
}

// 分析结果数据结构
export interface CharacterRelationData {
  characters: {
    name: string
    role: 'protagonist' | 'antagonist' | 'supporting' | 'minor'
    description: string
    relationships: { target: string; type: string }[]
  }[]
  summary: string
}

export interface PlotLineData {
  mainPlot: { title: string; keyEvents: string[] }[]
  subPlots: { title: string; keyEvents: string[] }[]
  timeline: { event: string; chapter?: number }[]
}

export interface ForeshadowingData {
  items: {
    setup: string
    payoff?: string
    chapter?: number
    importance: 'major' | 'minor'
  }[]
}

export interface ChapterStructureData {
  chapters: {
    number: number
    title: string
    function: 'setup' | 'development' | 'climax' | 'resolution' | 'transition'
    keyEvents: string[]
  }[]
  arcAnalysis: string
}

export interface WorldSettingData {
  settings: {
    name: string
    description: string
    rules?: string[]
  }[]
  powerSystem?: {
    name: string
    levels: string[]
  }
}

export interface User {
  id: number
  email: string
  name?: string
  createdAt: string
  updatedAt: string
}

export interface SourceNovel {
  id: string
  projectId: number
  originalText: string
  wordCount: number
  sourceName?: string
  createdAt: string
  updatedAt: string
}

// ============================================
// API 请求/响应类型
// ============================================

export interface GenerationParams {
  useContext: boolean
  contextChapterCount: number
  targetWordCount: number
  temperature: number
  stream: boolean
  virtualWriterId?: number
}

export interface RevisionParams {
  type: 'rewrite' | 'continue'
  suggestion?: string
  quickSuggestion?: QuickSuggestion
}

export type QuickSuggestion =
  | 'increase_details'
  | 'strengthen_psychology'
  | 'enhance_atmosphere'
  | 'accelerate_pace'
  | 'increase_dialogue'
  | 'reduce_redundancy'

// ============================================
// AI Provider 类型
// ============================================

export interface AIConfig {
  vendor: AIVendor
  modelId: string
  apiKey: string
  apiEndpoint?: string
}

export interface GenerationResult {
  content: string
  wordCount: number
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface StreamEvent {
  type: 'start' | 'token' | 'wordCount' | 'done' | 'error'
  data: Record<string, unknown>
}
