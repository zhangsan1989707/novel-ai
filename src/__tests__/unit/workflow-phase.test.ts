import { describe, it, expect } from 'vitest'
import { resolveWorkflowPhase } from '@/components/project/detail/utils'

const baseProject = {
  workflowStage: 'BLUEPRINT_CONFIRM' as const,
  blueprintConfirmedAt: null,
  arcPlanConfirmedAt: null,
  bookBlueprint: null,
  arcPlans: [],
  storyRoadmap: [],
  maintenanceSummary: null,
}

describe('resolveWorkflowPhase', () => {
  it('returns BLUEPRINT_GENERATING when maintenance is active', () => {
    expect(resolveWorkflowPhase(baseProject, { maintenanceActive: true })).toBe('BLUEPRINT_GENERATING')
  })

  it('returns BLUEPRINT_GENERATING when blueprint is missing', () => {
    expect(resolveWorkflowPhase(baseProject)).toBe('BLUEPRINT_GENERATING')
  })

  it('returns BLUEPRINT_READY when blueprint exists but not confirmed', () => {
    expect(resolveWorkflowPhase({ ...baseProject, bookBlueprint: { corePitch: 'x' } })).toBe('BLUEPRINT_READY')
  })

  it('returns ROADMAP_READY when roadmap exists but not confirmed', () => {
    expect(
      resolveWorkflowPhase({
        ...baseProject,
        workflowStage: 'ARC_PLAN_CONFIRM',
        blueprintConfirmedAt: '2024-01-01',
        storyRoadmap: [{ arcNumber: 1 }],
      }),
    ).toBe('ROADMAP_READY')
  })

  it('returns MAINTENANCE_FAILED after bootstrap failure', () => {
    expect(
      resolveWorkflowPhase({
        ...baseProject,
        workflowStage: 'GENERATE',
        maintenanceSummary: { bootstrapFailed: true },
      }),
    ).toBe('MAINTENANCE_FAILED')
  })

  it('returns WRITING when all setup conditions are completed', () => {
    expect(
      resolveWorkflowPhase({
        ...baseProject,
        workflowStage: 'GENERATE',
        blueprintConfirmedAt: '2024-01-01',
        arcPlanConfirmedAt: '2024-01-02',
      }),
    ).toBe('WRITING')
  })
})
