import type { ProjectDetail } from '@/hooks/useProjectDetail'
import type { PipelineStatus } from '@/hooks/useProjectPipeline'

export type NextStepState = {
  badgeVariant: 'primary' | 'secondary' | 'success' | 'warning' | 'danger'
  badgeLabel: string
  title: string
  description: string
  ctaLabel: string
  ctaAction: string
  disabled?: boolean
}

interface UseNextStepStateParams {
  project: ProjectDetail | null
  pipeline: PipelineStatus | null
  maintenanceActive: boolean
  maintenanceFailed: boolean
  openBatchDeslop?: () => void
}

export function useNextStepState({
  project,
  pipeline,
  maintenanceActive,
  maintenanceFailed,
  openBatchDeslop,
}: UseNextStepStateParams): NextStepState | null {
  if (!project?.preflight) {
    return null
  }

  const fastModeCompleted = pipeline?.status === 'COMPLETED' && pipeline?.speedMode === 'FAST_ACCEPTANCE'
  const hasCompletedChapters = (project.chapters || []).some(c => c.status === 'COMPLETED' && c.content)
  const hasReviewingChapters = (project.chapters || []).some(c => c.status === 'REVIEWING')

  if (fastModeCompleted && hasCompletedChapters && openBatchDeslop) {
    return {
      badgeVariant: 'warning',
      badgeLabel: '建议处理',
      title: '快速验收已完成生成，建议进行文风精修',
      description: `当前共有 ${project.chapters.filter(c => c.status === 'COMPLETED' && c.content).length} 章已完成。快速验收模式跳过了深度审稿与文风精修环节，建议批量处理以提升文本自然度和阅读质感。${hasReviewingChapters ? `另有 ${project.chapters.filter(c => c.status === 'REVIEWING').length} 章待审稿需要单独处理。` : ''}`,
      ctaLabel: '一键批量精修',
      ctaAction: 'batchDeslop',
    }
  }

  if (!project.preflight.hasModel) {
    return {
      badgeVariant: 'warning',
      badgeLabel: '阻断项',
      title: '先绑定可用模型',
      description: '当前项目还没有真正绑定可用的 AI 模型。先完成绑定，后续蓝图、目录和正文生产才会稳定接管。',
      ctaLabel: '前往模型设置',
      ctaAction: 'settings',
    }
  }

  if (maintenanceFailed) {
    return {
      badgeVariant: 'warning',
      badgeLabel: '需修复',
      title: '初始化任务失败，需要重试',
      description: project.maintenanceSummary?.bootstrapError || project.maintenanceSummary?.ragError || '后台初始化未完成，先修复初始化，再继续 AI 生产。',
      ctaLabel: '重试初始化',
      ctaAction: 'retry',
    }
  }

  if (maintenanceActive) {
    return {
      badgeVariant: 'secondary',
      badgeLabel: '等待中',
      title: 'AI 正在接管底层创作配置',
      description: '系统正在自动补齐 Blueprint、故事路线和故事状态。这里完成后，再开始整书生成。',
      ctaLabel: '等待完成',
      ctaAction: 'wait',
      disabled: true,
    }
  }

  if (!project.bookBlueprint || !project.blueprintConfirmedAt) {
    return {
      badgeVariant: 'warning',
      badgeLabel: '待确认',
      title: '先确认全书蓝图',
      description: '核心卖点、世界方向、主线方向、成长方向、终局方向以及平台/题材/风格策略需要先确认，再进入后续生产。',
      ctaLabel: '确认并开始创作',
      ctaAction: 'blueprint',
    }
  }

  if (!project.arcPlans?.length || !project.arcPlanConfirmedAt) {
    return {
      badgeVariant: 'warning',
      badgeLabel: '待确认',
      title: '先确认故事路线图',
      description: '当前阶段需要先把 Arc Plan 和故事路线图确认下来，正文生成才能保持连贯。',
      ctaLabel: '前往路线图',
      ctaAction: 'roadmap',
    }
  }

  if (pipeline?.status === 'RUNNING') {
    const currentChapter = pipeline.runtime?.currentChapter
    const currentTask = currentChapter
      ? `当前任务：第${currentChapter.chapterNumber}章${currentChapter.currentPhase?.includes('deslop') ? '文风精修' : '生成与润色'}`
      : '当前任务：推进当前批次章节'

    return {
      badgeVariant: 'primary',
      badgeLabel: '生产中',
      title: '正在自动创作中',
      description: `系统正在生成并精修当前批次章节。${currentTask}；下一步会保存章节摘要并更新目录。生成期间建议不要修改大纲、主线和章节结构，以免影响上下文一致性。`,
      ctaLabel: '查看进度',
      ctaAction: 'focus',
    }
  }

  return null
}
