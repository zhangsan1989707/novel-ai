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
  characterUpdates: Record<string, Record<string, unknown>>
  newPlotlines: string[]
  resolvedPlotlines: string[]
  popularFiction?: {
    readability: number
    emotion: number
    cheatPayoff: number
    conflict: number
    hook: number
    character: number
    pacing: number
    total: number
    issues: string[]
    suggestions: string[]
  }
  qualityMetrics?: {
    logicScore: number
    characterScore: number
    emotionScore: number
    styleScore: number
  }
}

// 章节摘要
export interface ChapterSummaryData {
  summary: string
  keyEvents: string[]
  emotionalTone: string | null
  plantedPlotlines: string[]
  resolvedPlotlines: string[]
}

// Agent 执行上下文
export interface AgentContext {
  projectId: number
  chapterNo: number
  projectTitle: string
  genre?: string | null
  writingStyle?: string | null
  worldSetting?: string | null
  powerSystem?: string | null
  protagonistProfile?: string | null
  antagonistSetting?: string | null
  targetWordCount?: number | null
}

// 写作 Agent 输入
export interface WriterInput {
  outline: ChapterOutline
  characterProfiles: CharacterProfile[]
  recentSummaries: { chapterNo: number; summary: string }[]
  styleGuide?: string | null
}

// 校验 Agent 输入
export interface ValidatorInput {
  newChapterContent: string
  characterProfiles: CharacterProfile[]
  recentSummaries: { chapterNo: number; summary: string }[]
  worldSetting?: string | null
  openPlotlines: PlotlineData[]
}

// Agent 执行结果
export interface AgentResult {
  success: boolean
  content: string
  tokenCount?: number
  durationMs?: number
  error?: string
}

// SSE 事件类型
export interface SSEEvent {
  type: 'start' | 'token' | 'agent_switch' | 'validation' | 'done' | 'error' | 'wordCount' | 'research' | 'hook_warning' | 'phase_timing'
  data: Record<string, unknown>
}
