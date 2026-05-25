export type ProjectWorkflowStage = 'BLUEPRINT_CONFIRM' | 'ARC_PLAN_CONFIRM' | 'GENERATE'

export type ProjectFlowState = {
  workflowStage?: string | null
  blueprintConfirmedAt?: Date | string | null
  arcPlanConfirmedAt?: Date | string | null
  hasBlueprint?: boolean
  hasArcPlans?: boolean
}

export function deriveWorkflowStage(input: ProjectFlowState): ProjectWorkflowStage {
  if (!input.hasBlueprint) return 'BLUEPRINT_CONFIRM'
  if (!input.blueprintConfirmedAt) return 'BLUEPRINT_CONFIRM'
  if (!input.hasArcPlans) return 'ARC_PLAN_CONFIRM'
  if (!input.arcPlanConfirmedAt) return 'ARC_PLAN_CONFIRM'

  const explicit = input.workflowStage?.toUpperCase()
  if (explicit === 'BLUEPRINT_CONFIRM' || explicit === 'ARC_PLAN_CONFIRM' || explicit === 'GENERATE') {
    return explicit
  }

  return 'GENERATE'
}

export function canStartGeneration(input: ProjectFlowState): boolean {
  return deriveWorkflowStage(input) === 'GENERATE'
}

export function getWorkflowBlockReason(input: ProjectFlowState): string | null {
  if (!input.hasBlueprint) return '请先生成并确认全书蓝图'
  if (!input.blueprintConfirmedAt) return 'Blueprint 未确认，不能启动正文生成'
  if (!input.hasArcPlans) return '请先生成并确认 ArcPlan'
  if (!input.arcPlanConfirmedAt) return 'ArcPlan 未确认，不能生成章节目录或正文'
  return null
}
