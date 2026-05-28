import type { GenerationSpeedMode } from '@/lib/ai/speed-mode'
import type { ProjectChapter } from '@/hooks/useProjectDetail'

export const chapterStatusMap: Record<ProjectChapter['status'], { label: string; variant: 'default' | 'primary' | 'success' | 'warning' }> = {
  DRAFT: { label: '未写作', variant: 'default' },
  GENERATING: { label: '生成中', variant: 'primary' },
  COMPLETED: { label: '已完成', variant: 'success' },
  REVIEWING: { label: '待审稿', variant: 'warning' },
}

export const projectStatusMap: Record<'DRAFT' | 'WRITING' | 'COMPLETED' | 'PAUSED', { label: string; variant: 'default' | 'primary' | 'success' | 'warning' }> = {
  DRAFT: { label: '草稿', variant: 'default' },
  WRITING: { label: '写作中', variant: 'primary' },
  COMPLETED: { label: '已完成', variant: 'success' },
  PAUSED: { label: '已暂停', variant: 'warning' },
}

export const pipelineStatusMap: Record<string, string> = {
  IDLE: '空闲',
  PENDING: '准备中',
  RUNNING: '运行中',
  COMPLETED: '已完成',
  FAILED: '失败',
  PAUSED: '已暂停',
}

export const pipelineStepMap: Record<string, string> = {
  BLUEPRINT: '蓝图生成',
  ARC_PLAN: '阶段规划',
  CHAPTER_LIST: '章节目录',
  WRITE: '章节写作',
  SUMMARIZE: '总结收尾',
  PLANNER: '章节策划',
  WRITER: '正文写作',
  SUMMARIZER: '摘要整理',
  DB_WRITE: '结果回写',
  RESEARCH: '资料整理',
  DESLOPPER: '去AI味',
  VALIDATOR: '一致性校验',
  POLISHER: '章节润色',
  REVIEWER: '对抗审稿',
  REVIEW_REVISION: '审稿修订',
  PLAN: '策划',
  REVIEW: '审稿',
  POLISH: '润色',
  DRAFT: '草稿生成',
  VALIDATE: '校验',
  INITIALIZE: '初始化',
}

export const speedModeOptions: Array<{
  value: GenerationSpeedMode
  label: string
  description: string
}> = [
  {
    value: 'fast',
    label: '快速验收',
    description: '跳过重型审稿链，适合批量出草稿和验证主链路。',
  },
  {
    value: 'balanced',
    label: '均衡生成',
    description: '默认模式，正文质量与生成速度更适合日常写作。',
  },
  {
    value: 'quality',
    label: '精修质量',
    description: '完整多 Agent 审稿、润色、去 AI 味，适合重点章节。',
  },
]

export const speedModeLabels: Record<GenerationSpeedMode, string> = {
  fast: '快速验收',
  balanced: '均衡生成',
  quality: '精修质量',
}

export const defaultSteeringValues = {
  pace: 0.5,
  darkness: 0.3,
  humor: 0.3,
  romance: 0.2,
  powerGrowth: 0.5,
  conflictIntensity: 0.5,
  mysteryDensity: 0.3,
}
