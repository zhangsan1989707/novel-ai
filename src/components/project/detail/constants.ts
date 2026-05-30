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
    value: 'FAST_ACCEPTANCE',
    label: '快速验收',
    description: '跳过重型审稿链，适合批量出草稿和验证主链路。',
  },
  {
    value: 'FINAL_POLISH',
    label: '精修成稿',
    description: '完整多 Agent 审稿、润色、去 AI 味，适合定稿章节。',
  },
]

export const speedModeLabels: Record<GenerationSpeedMode, string> = {
  FAST_ACCEPTANCE: '快速验收',
  FINAL_POLISH: '精修成稿',
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

export type ProjectWorkflowPhase =
  | 'BLUEPRINT_GENERATING'
  | 'BLUEPRINT_READY'
  | 'ROADMAP_READY'
  | 'WRITING'
  | 'MAINTENANCE_FAILED'

export const workflowPhaseLabels: Record<ProjectWorkflowPhase, {
  title: string
  sidebarTitle: string
  statusBadge: string
  nextStep: string
  estimated: string
}> = {
  BLUEPRINT_GENERATING: {
    title: '生成创作蓝图中',
    sidebarTitle: '创作准备进度',
    statusBadge: '初始化创作工程中',
    nextStep: '等待蓝图生成完成后确认',
    estimated: '预计 30-90 秒',
  },
  BLUEPRINT_READY: {
    title: '等待确认创作蓝图',
    sidebarTitle: '创作准备进度',
    statusBadge: '待确认创作蓝图',
    nextStep: '确认蓝图后进入故事路线',
    estimated: '取决于你的确认时间',
  },
  ROADMAP_READY: {
    title: '等待确认故事路线',
    sidebarTitle: '创作准备进度',
    statusBadge: '待确认故事路线',
    nextStep: '确认路线后开始生成章节',
    estimated: '取决于你的确认时间',
  },
  WRITING: {
    title: '正文生成',
    sidebarTitle: '写作进度',
    statusBadge: '写作进行中',
    nextStep: '持续生成章节并推进进度',
    estimated: '按章节进度推进',
  },
  MAINTENANCE_FAILED: {
    title: '初始化任务失败',
    sidebarTitle: '创作准备进度',
    statusBadge: '初始化异常',
    nextStep: '重试初始化后再继续',
    estimated: '取决于修复与重试结果',
  },
}

export const blueprintProgressSteps = [
  '分析题材与平台定位',
  '生成 Book Blueprint',
  '生成故事路线 Arc Plan',
  '初始化角色档案',
  '初始化故事状态',
]
