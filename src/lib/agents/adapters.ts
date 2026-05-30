import { AgentDefinition, ModelTier } from './base'
import { agentRegistry } from './registry'
import { plannerAgent } from './planner'
import { writerAgent } from './writer'
import { polisherAgent } from './polisher'
import { validatorAgent } from './validator'
import { summarizerAgent } from './summarizer'
import { researcherAgent } from './researcher'
import { reviewerAgent } from './reviewer'
import { deslopperAgent } from './deslopper'
import type { ChapterOutline, CharacterProfile, PlotlineData, ChapterSummaryData } from '@/lib/engine/types'
import type { ResearchInput, ResearchResult } from './researcher'
import type { ReviewInput, MultiReviewResult } from './reviewer'
import type { DeslopInput, DeslopResult } from './deslopper'

interface PlannerInput {
  projectId: number
  chapterNo: number
  projectTitle: string
  genre?: string
  writingStyle?: string
  worldSetting?: string
  powerSystem?: string
  protagonistProfile?: string
  antagonistSetting?: string
  targetWordCount: number
  characterProfiles: { name: string; role: string; description: string }[]
  openPlotlines: { id: string; description: string }[]
  emotionalArc: { chapterNo: number; value: number }[]
  recentChapterCount: number
  useEnhancedPrompt?: boolean
}

interface PlannerOutput {
  outline: ChapterOutline
  tokens?: number
}

interface WriterInput {
  projectId: number
  chapterNo: number
  projectTitle: string
  genre?: string
  writingStyle?: string
  worldSetting?: string
  powerSystem?: string
  outline: ChapterOutline
  characterProfiles: CharacterProfile[]
  recentSummaries: { chapterNo: number; summary: string }[]
  targetWordCount: number
  useEnhancedPrompt?: boolean
}

interface WriterOutput {
  content: string
  tokens?: number
}

interface PolisherInput {
  projectId: number
  chapterNo: number
  content: string
  styleGuide?: string | null
  writingStyle?: string
  genre?: string
  chapterTitle?: string
  useEnhancedPrompt?: boolean
}

interface PolisherOutput {
  content: string
  tokens?: number
}

interface ValidatorInput {
  projectId: number
  chapterNo: number
  newChapterContent: string
  characterProfiles: CharacterProfile[]
  recentSummaries: { chapterNo: number; summary: string }[]
  worldSetting?: string
  openPlotlines: PlotlineData[]
  chapterTitle?: string
  chapterGoal?: string
  useEnhancedPrompt?: boolean
}

interface SummarizerInput {
  projectId: number
  chapterNo: number
  chapterTitle: string
  chapterContent: string
  worldSetting?: string
  protagonistProfile?: string
}

const plannerAdapter: AgentDefinition<PlannerInput, PlannerOutput> = {
  type: 'PLANNER',
  name: '策划 Agent',
  description: '生成章节大纲',
  modelTier: ModelTier.SONNET,
  supportsStreaming: false,
  execute: plannerAgent,
}

const writerAdapter: AgentDefinition<WriterInput, WriterOutput> = {
  type: 'WRITER',
  name: '写作 Agent',
  description: '生成章节正文',
  modelTier: ModelTier.SONNET,
  supportsStreaming: true,
  execute: (input) => writerAgent(input),
  executeStream: (input, onChunk) => writerAgent(input, onChunk),
}

const polisherAdapter: AgentDefinition<PolisherInput, PolisherOutput> = {
  type: 'POLISHER',
  name: '润色 Agent',
  description: '文风优化',
  modelTier: ModelTier.SONNET,
  supportsStreaming: true,
  execute: (input) => polisherAgent(input),
  executeStream: (input, onChunk) => polisherAgent(input, onChunk),
}

const validatorAdapter: AgentDefinition<ValidatorInput, unknown> = {
  type: 'VALIDATOR',
  name: '校验 Agent',
  description: '一致性检查',
  modelTier: ModelTier.HAIKU,
  supportsStreaming: false,
  execute: validatorAgent,
}

const summarizerAdapter: AgentDefinition<SummarizerInput, ChapterSummaryData> = {
  type: 'SUMMARIZER',
  name: '摘要 Agent',
  description: '生成章节摘要',
  modelTier: ModelTier.HAIKU,
  supportsStreaming: false,
  execute: summarizerAgent,
}

const researcherAdapter: AgentDefinition<ResearchInput, ResearchResult> = {
  type: 'RESEARCHER',
  name: '研究 Agent',
  description: '素材研究',
  modelTier: ModelTier.SONNET,
  supportsStreaming: false,
  execute: researcherAgent,
}

const reviewerAdapter: AgentDefinition<ReviewInput, MultiReviewResult> = {
  type: 'REVIEWER',
  name: '审稿 Agent',
  description: '多维度审稿',
  modelTier: ModelTier.OPUS,
  supportsStreaming: false,
  execute: reviewerAgent,
}

const deslopperAdapter: AgentDefinition<DeslopInput, DeslopResult> = {
  type: 'DESLOPPER',
  name: '去AI味 Agent',
  description: '检测和消除AI痕迹',
  modelTier: ModelTier.SONNET,
  supportsStreaming: false,
  execute: deslopperAgent,
}

export function registerAllAgents(): void {
  agentRegistry.register(plannerAdapter)
  agentRegistry.register(writerAdapter)
  agentRegistry.register(polisherAdapter)
  agentRegistry.register(validatorAdapter)
  agentRegistry.register(summarizerAdapter)
  agentRegistry.register(researcherAdapter)
  agentRegistry.register(reviewerAdapter)
  agentRegistry.register(deslopperAdapter)
}

registerAllAgents()
