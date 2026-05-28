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
}

export function useNextStepState({
  project,
  pipeline,
  maintenanceActive,
  maintenanceFailed,
}: UseNextStepStateParams): NextStepState | null {
  if (!project?.preflight) {
    return null
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
      ctaLabel: '前往蓝图',
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
    return {
      badgeVariant: 'primary',
      badgeLabel: '生产中',
      title: '当前正在自动写作',
      description: '流水线正在推进中，不建议同时修改蓝图、路线图和章节结构，以免打断状态一致性。',
      ctaLabel: '查看进度',
      ctaAction: 'focus',
    }
  }

  return null
}
