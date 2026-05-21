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
  MIMO = 'MIMO',
  VOLCENGINE = 'VOLCENGINE',
  ZHIPU = 'ZHIPU',
}

// 拆书分析维度
export enum AnalysisDimension {
  STORY_OVERVIEW = 'STORY_OVERVIEW',           // 故事总览/大纲骨架
  CHARACTER_RELATION = 'CHARACTER_RELATION',   // 人物关系
  CHARACTER_ARC = 'CHARACTER_ARC',             // 角色成长
  PLOT_LINE = 'PLOT_LINE',                     // 剧情线
  FORESHADOWING = 'FORESHADOWING',             // 伏笔悬念
  CHAPTER_STRUCTURE = 'CHAPTER_STRUCTURE',     // 章节结构
  READING_EXPERIENCE = 'READING_EXPERIENCE',   // 阅读体验
  WORLD_SETTING = 'WORLD_SETTING'              // 世界观设定
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
  projectMode?: string
  storyType?: string
  aiModelId?: number
  aiModelConfig?: AIModelConfig
  creatorId: number
  creator?: User
  chapters?: NovelChapter[]
  createdAt: string
  updatedAt: string
}

export interface OutlineStages {
  stages?: OutlineStageItem[]
  stage1?: OutlineStage[]
  stage2?: OutlineStage[]
  stage3?: OutlineStage[]
  stage4?: OutlineStage[]
}

export interface OutlineStageItem {
  name: string
  description: string
  coreEvents?: string[]
  chapterRatio?: number
  chapterPlan?: string
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
  embeddingVendor?: AIVendor
  embeddingApiKey?: string
  embeddingApiEndpoint?: string
  embeddingModelId?: string
  embeddingDimensions?: number
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

// ============================================
// 平台 & 长度 & Arc 阶段枚举
// ============================================

export type Platform = 'qidian' | 'fanqie' | 'feilu' | 'jinjiang' | 'qimao'

export const PLATFORM_LABELS: Record<Platform, string> = {
  qidian: '起点',
  fanqie: '番茄',
  feilu: '飞卢',
  jinjiang: '晋江',
  qimao: '七猫',
}

export type LengthType = 'short' | 'medium' | 'long' | 'ultra_long'

export const LENGTH_TYPE_LABELS: Record<LengthType, string> = {
  short: '短篇 (30-50章)',
  medium: '中篇 (100-300章)',
  long: '长篇 (500-1000章)',
  ultra_long: '超长篇 (1000+章)',
}

export type ArcStage = 'opening' | 'growth' | 'expansion' | 'mid_conflict' | 'pre_finale' | 'finale'

export const ARC_STAGE_LABELS: Record<ArcStage, string> = {
  opening: '开局',
  growth: '成长',
  expansion: '扩张',
  mid_conflict: '中期冲突',
  pre_finale: '大战前夕',
  finale: '终局',
}

// ============================================
// 故事方向控制 (Story Steering)
// ============================================

export interface StorySteering {
  pace: number
  darkness: number
  humor: number
  romance: number
  powerGrowth: number
  conflictIntensity: number
  mysteryDensity: number
}

export const DEFAULT_STORY_STEERING: StorySteering = {
  pace: 0.5,
  darkness: 0.3,
  humor: 0.3,
  romance: 0.2,
  powerGrowth: 0.5,
  conflictIntensity: 0.5,
  mysteryDensity: 0.3,
}

export interface SteeringAction {
  label: string
  description: string
  apply: (steering: StorySteering) => StorySteering
}

export const STEERING_ACTIONS: SteeringAction[] = [
  {
    label: '更快',
    description: '加快故事节奏',
    apply: (s) => ({ ...s, pace: Math.min(1, s.pace + 0.1) }),
  },
  {
    label: '更爽',
    description: '增加爽点密度',
    apply: (s) => ({ ...s, conflictIntensity: Math.min(1, s.conflictIntensity + 0.1), pace: Math.min(1, s.pace + 0.05) }),
  },
  {
    label: '更黑暗',
    description: '增加黑暗氛围',
    apply: (s) => ({ ...s, darkness: Math.min(1, s.darkness + 0.1), humor: Math.max(0, s.humor - 0.1) }),
  },
  {
    label: '增加感情线',
    description: '增加恋爱戏份',
    apply: (s) => ({ ...s, romance: Math.min(1, s.romance + 0.1), conflictIntensity: Math.min(1, s.conflictIntensity + 0.05) }),
  },
  {
    label: '增加打脸',
    description: '增加打脸/反转桥段',
    apply: (s) => ({ ...s, conflictIntensity: Math.min(1, s.conflictIntensity + 0.15), pace: Math.min(1, s.pace + 0.05) }),
  },
  {
    label: '减少系统感',
    description: '弱化系统描写',
    apply: (s) => ({ ...s, pace: Math.max(0, s.pace - 0.1), powerGrowth: Math.max(0, s.powerGrowth - 0.1) }),
  },
]

// ============================================
// 生成流水线 (Generation Pipeline)
// ============================================

export type PipelineStep = 'blueprint' | 'arc_plan' | 'chapter_list' | 'write' | 'validate' | 'polish' | 'deslop' | 'summarize'

export const PIPELINE_STEP_LABELS: Record<PipelineStep, string> = {
  blueprint: '生成蓝图',
  arc_plan: 'Arc 规划',
  chapter_list: '章节目录',
  write: '逐章写作',
  validate: '内容校验',
  polish: '润色优化',
  deslop: '去 AI 味',
  summarize: '生成摘要',
}

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused'

export interface GenerationJobInfo {
  id: number
  projectId: number
  type: string
  status: JobStatus
  currentStep: PipelineStep | null
  stepIndex: number
  totalChapters: number
  currentChapter: number
  retryCount: number
  progress: number
  errorMessage?: string
}

// ============================================
// 平台模板 (Platform Template)
// ============================================

export interface PlatformTemplate {
  platform: Platform
  pace: 'slow' | 'medium' | 'fast' | 'ultra_fast'
  cliffhangerDensity: 'low' | 'medium' | 'high' | 'very_high'
  slapFaceDensity: 'low' | 'medium' | 'high' | 'very_high'
  foreshadowDensity: 'low' | 'medium' | 'high' | 'very_high'
  growthDensity: 'low' | 'medium' | 'high' | 'very_high'
  chapterWordTarget: number
  batchSizeBaseline: number
}

// ============================================
// Arc 计划 & 蓝图 (Arc Plan & Blueprint)
// ============================================

export interface ArcPlanInfo {
  id: string
  arcNumber: number
  name: string
  stage: ArcStage
  description?: string
  batchSize: number
  startChapter: number
  endChapter?: number
  goals: string[]
  keyEvents: string[]
  isCompleted: boolean
}

export interface BookBlueprintInfo {
  corePitch: string
  worldDirection?: string
  mainlineDirection?: string
  growthDirection?: string
  endingDirection?: string
  constraints: string[]
}

export interface VillainInfo {
  id: string
  name: string
  tier: 'stage' | 'arc' | 'final'
  isFinalBoss: boolean
  arcNumber?: number
  description?: string
  motivation?: string
  abilities: string[]
  introducedAt?: number
  defeatedAt?: number
  lifecycle: 'active' | 'defeated' | 'escaped' | 'transformed'
}

export interface WorldStateInfo {
  mapLevel: number
  factionCount: number
  powerLevel: number
  civilizationLevel: number
  classStructure: string[]
  regions: string[]
  currentExpansion?: string
}
