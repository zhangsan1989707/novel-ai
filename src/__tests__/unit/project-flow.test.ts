import { describe, expect, it } from 'vitest'
import { deriveWorkflowStage, canStartGeneration, getWorkflowBlockReason } from '@/lib/engine/project-flow'

describe('deriveWorkflowStage', () => {
  it('returns BLUEPRINT_CONFIRM when hasBlueprint is false', () => {
    expect(deriveWorkflowStage({ hasBlueprint: false })).toBe('BLUEPRINT_CONFIRM')
  })

  it('returns BLUEPRINT_CONFIRM when blueprintConfirmedAt is null', () => {
    expect(deriveWorkflowStage({ hasBlueprint: true, blueprintConfirmedAt: null })).toBe('BLUEPRINT_CONFIRM')
  })

  it('returns ARC_PLAN_CONFIRM when hasArcPlans is false', () => {
    expect(deriveWorkflowStage({
      hasBlueprint: true,
      blueprintConfirmedAt: new Date(),
      hasArcPlans: false,
    })).toBe('ARC_PLAN_CONFIRM')
  })

  it('returns ARC_PLAN_CONFIRM when arcPlanConfirmedAt is null', () => {
    expect(deriveWorkflowStage({
      hasBlueprint: true,
      blueprintConfirmedAt: new Date(),
      hasArcPlans: true,
      arcPlanConfirmedAt: null,
    })).toBe('ARC_PLAN_CONFIRM')
  })

  it('returns GENERATE when workflowStage is explicitly GENERATE (backward compat)', () => {
    expect(deriveWorkflowStage({
      hasBlueprint: true,
      blueprintConfirmedAt: new Date(),
      hasArcPlans: true,
      arcPlanConfirmedAt: new Date(),
      workflowStage: 'GENERATE',
      hasOutlines: true,
      outlineConfirmedAt: null,
    })).toBe('GENERATE')
  })

  it('returns OUTLINE_REVIEW when outlines exist but not confirmed', () => {
    expect(deriveWorkflowStage({
      hasBlueprint: true,
      blueprintConfirmedAt: new Date(),
      hasArcPlans: true,
      arcPlanConfirmedAt: new Date(),
      hasOutlines: true,
      outlineConfirmedAt: null,
    })).toBe('OUTLINE_REVIEW')
  })

  it('returns GENERATE when all conditions met', () => {
    expect(deriveWorkflowStage({
      hasBlueprint: true,
      blueprintConfirmedAt: new Date(),
      hasArcPlans: true,
      arcPlanConfirmedAt: new Date(),
      hasOutlines: true,
      outlineConfirmedAt: new Date(),
    })).toBe('GENERATE')
  })

  it('handles case-insensitive workflowStage', () => {
    expect(deriveWorkflowStage({
      hasBlueprint: true,
      blueprintConfirmedAt: new Date(),
      hasArcPlans: true,
      arcPlanConfirmedAt: new Date(),
      workflowStage: 'generate',
    })).toBe('GENERATE')
  })
})

describe('canStartGeneration', () => {
  it('returns true when stage is GENERATE', () => {
    expect(canStartGeneration({
      hasBlueprint: true,
      blueprintConfirmedAt: new Date(),
      hasArcPlans: true,
      arcPlanConfirmedAt: new Date(),
    })).toBe(true)
  })

  it('returns false for BLUEPRINT_CONFIRM', () => {
    expect(canStartGeneration({ hasBlueprint: false })).toBe(false)
  })

  it('returns false for ARC_PLAN_CONFIRM', () => {
    expect(canStartGeneration({
      hasBlueprint: true,
      blueprintConfirmedAt: new Date(),
      hasArcPlans: false,
    })).toBe(false)
  })
})

describe('getWorkflowBlockReason', () => {
  it('returns message when no blueprint', () => {
    expect(getWorkflowBlockReason({ hasBlueprint: false })).toBe('请先生成并确认全书蓝图')
  })

  it('returns message when blueprint not confirmed', () => {
    expect(getWorkflowBlockReason({ hasBlueprint: true, blueprintConfirmedAt: null }))
      .toBe('Blueprint 未确认，不能启动正文生成')
  })

  it('returns message when no arc plans', () => {
    expect(getWorkflowBlockReason({
      hasBlueprint: true,
      blueprintConfirmedAt: new Date(),
      hasArcPlans: false,
    })).toBe('请先生成并确认 ArcPlan')
  })

  it('returns message when outlines pending', () => {
    expect(getWorkflowBlockReason({
      hasBlueprint: true,
      blueprintConfirmedAt: new Date(),
      hasArcPlans: true,
      arcPlanConfirmedAt: new Date(),
      hasOutlines: true,
      outlineConfirmedAt: null,
    })).toBe('章节目录未确认，请先审核并确认大纲')
  })

  it('returns null when generation can start', () => {
    expect(getWorkflowBlockReason({
      hasBlueprint: true,
      blueprintConfirmedAt: new Date(),
      hasArcPlans: true,
      arcPlanConfirmedAt: new Date(),
    })).toBeNull()
  })

  it('returns null for explicit GENERATE even with pending outlines', () => {
    expect(getWorkflowBlockReason({
      hasBlueprint: true,
      blueprintConfirmedAt: new Date(),
      hasArcPlans: true,
      arcPlanConfirmedAt: new Date(),
      workflowStage: 'GENERATE',
      hasOutlines: true,
      outlineConfirmedAt: null,
    })).toBeNull()
  })
})
