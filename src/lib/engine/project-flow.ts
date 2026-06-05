export type ProjectWorkflowStage = 'BLUEPRINT_CONFIRM' | 'ARC_PLAN_CONFIRM' | 'OUTLINE_REVIEW' | 'GENERATE'

export type ProjectFlowState = {
  workflowStage?: string | null
  blueprintConfirmedAt?: Date | string | null
  arcPlanConfirmedAt?: Date | string | null
  outlineConfirmedAt?: Date | string | null
  hasBlueprint?: boolean
  hasArcPlans?: boolean
  hasOutlines?: boolean
}

export function deriveWorkflowStage(input: ProjectFlowState): ProjectWorkflowStage {
  if (!input.hasBlueprint) return 'BLUEPRINT_CONFIRM'
  if (!input.blueprintConfirmedAt) return 'BLUEPRINT_CONFIRM'
  if (!input.hasArcPlans) return 'ARC_PLAN_CONFIRM'
  if (!input.arcPlanConfirmedAt) return 'ARC_PLAN_CONFIRM'

  // 向后兼容：已在 GENERATE 阶段的项目不受大纲审核影响
  const explicit = input.workflowStage?.toUpperCase()
  if (explicit === 'GENERATE') return 'GENERATE'

  if (input.hasOutlines && !input.outlineConfirmedAt) return 'OUTLINE_REVIEW'

  if (explicit === 'BLUEPRINT_CONFIRM' || explicit === 'ARC_PLAN_CONFIRM' || explicit === 'OUTLINE_REVIEW' || explicit === 'GENERATE') {
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

  // 向后兼容：已在 GENERATE 阶段的项目不受大纲审核影响
  const explicit = input.workflowStage?.toUpperCase()
  if (explicit === 'GENERATE') return null

  if (input.hasOutlines && !input.outlineConfirmedAt) return '章节目录未确认，请先审核并确认大纲'
  return null
}
