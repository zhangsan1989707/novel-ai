import { CharacterRole, PlotlineType, PlotlineStatus } from '@prisma/client'

// AgentType 需要手动定义，因为 Prisma 枚举名称冲突
export const AgentTypeEnum = {
  PLANNER: 'PLANNER',
  WRITER: 'WRITER',
  POLISHER: 'POLISHER',
  VALIDATOR: 'VALIDATOR',
  SUMMARIZER: 'SUMMARIZER',
  RESEARCHER: 'RESEARCHER',
  REVIEWER: 'REVIEWER',
  DESLOPPER: 'DESLOPPER',
} as const
export type AgentType = typeof AgentTypeEnum[keyof typeof AgentTypeEnum]

// 小说引擎类型定义

// 章节大纲（策划 Agent 输出）
export interface ChapterOutline {
  chapterTitle: string          // 章节标题
  chapterGoal: string           // 本章目标（一句话）
  mainConflict: string          // 主要冲突
  emotionTarget?: string
  conflictTarget?: string
  payoffTarget?: string
  cliffhanger?: string
  cheatUsage?: string
  characterTagProof?: string
  forbiddenMistakes?: string[]
  keyScenes: KeyScene[]         // 2-4 个关键场景
  ending: string                // 章节结局
  foreshadows: string[]         // 本章新埋伏笔描述
  resolvedPlotlines: string[]   // 本章回收的伏笔ID
}

export interface KeyScene {
  scene: string                 // 场景描述
  characters: string[]          // 出场角色名
  emotion: string               // 情绪基调
}

// 角色档案
export interface CharacterProfile {
  id: string
  name: string
  role: CharacterRole
  aliases: string[]
  appearance: string | null
  personality: string | null
  catchphrases: string[]
  background: string | null
  relationships: Record<string, string>
  currentState: Record<string, unknown>
  firstChapter: number | null
  lastUpdated: number | null
}

// 伏笔追踪
export interface PlotlineData {
  id: string
  type: PlotlineType
  description: string
  plantedAt: number
  resolvedAt: number | null
  plannedAt: number | null
  status: PlotlineStatus
}

// 故事状态机
export interface EmotionalArcPoint {
  chapterNo: number
  value: number  // 0-100
}

export interface SubConflict {
  id: string
  description: string
  status: 'OPEN' | 'ESCALATING' | 'RESOLVING' | 'RESOLVED'
}

export interface StoryState {
  emotionalArc: EmotionalArcPoint[]
  mainConflict: string | null
  subConflicts: SubConflict[]
  currentChapter: number
  totalPlanned: number
}

// 校验报告
export interface ValidationIssue {
  type: 'character_inconsistency' | 'timeline' | 'worldview' | 'plotline' | '重复内容'
  description: string
  location: string
  reference: string
}

export interface ValidationReport {
  result: 'pass' | 'retry' | 'fail' | 'skipped'
  score: number  // 0-100, -1 表示跳过校验
  issues: ValidationIssue[]
  characterUpdates: Record<string, unknown>
  newPlotlines: unknown[]
  resolvedPlotlines: unknown[]
  qualityMetrics: {
    logicScore: number
    characterScore: number
    emotionScore: number
    styleScore: number
  }
}

// 章节摘要数据
export interface ChapterSummaryData {
  summary: string
  keyEvents: string[]
  emotionalTone: string | null
  plantedPlotlines: unknown[]
  resolvedPlotlines: unknown[]
}

// 生成阶段
export type GenerationPhase = 
  | 'planning'
  | 'chapter_contract'
  | 'writing'
  | 'polishing'
  | 'summarizing'
  | 'reviewing'
  | 'validating'
  | 'deslopping'
  | 'word_count_check'
  | 'truncation_check'
  | 'quality_gate'
  | 'repairing'
  | 'committing'
  | 'completed'
  | 'failed'

// Agent 上下文
export interface AgentContext {
  projectId: number
  chapterNo: number
  projectTitle?: string
  genre?: string
  writingStyle?: string
  worldSetting?: string
  powerSystem?: string
  protagonistProfile?: string
  antagonistSetting?: string
}

// SSE 事件类型
export interface SSEEvent {
  type: 'start' | 'token' | 'agent_switch' | 'validation' | 'done' | 'error' | 'wordCount' | 'research' | 'hook_warning' | 'phase_timing' | 'progress' | 'chapter_completed' | 'heartbeat' | 'quality_gate_failed'
  data: Record<string, unknown>
}

// 进度事件数据
export interface ProgressEventData {
  phase: GenerationPhase
  chapterNo: number
  totalChapters: number
  completedChapters: number
  currentWordCount: number
  targetWordCount: number
  message: string
  lastHeartbeatAt: string
  timestamp: string
}

export interface ChapterCommitData {
  projectId: number
  chapterNo: number
  content: string
  outline: ChapterOutline
  wordCount: number
  summaryData: ChapterSummaryData
  validationReport: ValidationReport | null
}
