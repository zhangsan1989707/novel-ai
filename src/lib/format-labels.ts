/**
 * 统一中文标签映射 - 禁止在页面上显示英文内部字段
 */

// 章节状态
export const chapterStatusLabels: Record<string, string> = {
  DRAFT: '草稿',
  GENERATING: '生成中',
  COMPLETED: '已完成',
  REVIEWING: '待审核',
}

// 生成阶段
export const generationPhaseLabels: Record<string, string> = {
  planning: '章节规划',
  chapter_contract: '构建契约',
  writing: '正文写作',
  polishing: '文风润色',
  summarizing: '摘要整理',
  reviewing: '内容复核',
  validating: '质量校验',
  deslopping: '去AI味',
  word_count_check: '字数校验',
  truncation_check: '截断检测',
  quality_gate: '质量门禁',
  repairing: '修复中',
  committing: '保存中',
  completed: '已完成',
  failed: '生成失败',
}

// 流水线步骤
export const pipelineStepLabels: Record<string, string> = {
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
  VALIDATOR: '质量校验',
  POLISHER: '文风润色',
  REVIEWER: '内容复核',
  REVIEW_REVISION: '审稿修订',
  PLAN: '策划',
  REVIEW: '审稿',
  POLISH: '润色',
  DRAFT: '草稿生成',
  VALIDATE: '校验',
  INITIALIZE: '初始化',
}

// 流水线状态
export const pipelineStatusLabels: Record<string, string> = {
  IDLE: '空闲',
  PENDING: '准备中',
  RUNNING: '运行中',
  COMPLETED: '已完成',
  FAILED: '失败',
  PAUSED: '已暂停',
  QUEUED: '排队中',
  REPAIRING: '修复中',
  STALE: '已过期',
  CANCELLED: '已取消',
}

// 生成模式
export const speedModeLabels: Record<string, string> = {
  FAST_ACCEPTANCE: '快速验收',
  FINAL_POLISH: '精修成稿',
}

// Agent 类型
export const agentTypeLabels: Record<string, string> = {
  PLANNER: '策划',
  WRITER: '写作',
  POLISHER: '润色',
  VALIDATOR: '校验',
  SUMMARIZER: '摘要',
  RESEARCHER: '研究',
  REVIEWER: '审稿',
  DESLOPPER: '去AI味',
}

/**
 * 格式化章节状态
 */
export function formatChapterStatus(status: string): string {
  return chapterStatusLabels[status] || status
}

/**
 * 格式化生成阶段
 */
export function formatGenerationPhase(phase: string): string {
  return generationPhaseLabels[phase] || phase
}

/**
 * 格式化流水线步骤
 */
export function formatPipelineStep(step: string): string {
  return pipelineStepLabels[step] || step || '等待中'
}

/**
 * 格式化流水线状态
 */
export function formatPipelineStatus(status: string): string {
  return pipelineStatusLabels[status] || status
}

/**
 * 格式化生成模式
 */
export function formatSpeedMode(mode: string): string {
  return speedModeLabels[mode] || mode
}

/**
 * 格式化 Agent 类型
 */
export function formatAgentType(agent: string): string {
  return agentTypeLabels[agent] || agent
}

/**
 * 格式化时间为相对时间
 */
export function formatTimeAgo(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (seconds < 5) return '刚刚'
  if (seconds < 60) return `${seconds}秒前`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时前`
  return `${Math.floor(seconds / 86400)}天前`
}

/**
 * 格式化运行时长
 */
export function formatDuration(startTime: string | undefined): string {
  if (!startTime) return '-'
  const start = new Date(startTime)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - start.getTime()) / 1000)
  
  if (seconds < 60) return `${seconds}秒`
  const minutes = Math.floor(seconds / 60)
  const remainSeconds = seconds % 60
  if (minutes < 60) return `${minutes}分${remainSeconds}秒`
  const hours = Math.floor(minutes / 60)
  const remainMinutes = minutes % 60
  return `${hours}时${remainMinutes}分`
}
