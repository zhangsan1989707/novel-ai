import { describe, it, expect } from 'vitest'
import { useNextStepState } from '@/components/project/detail/useNextStepState'
import type { ProjectDetail } from '@/hooks/useProjectDetail'
import type { PipelineStatus } from '@/hooks/useProjectPipeline'

const makeProject = (overrides: Partial<ProjectDetail> = {}): ProjectDetail => ({
  id: 1,
  title: 'Test Project',
  currentWordCount: 1000,
  chapterWordCount: 3000,
  status: 'WRITING',
  totalVolumes: 1,
  projectMode: 'CREATE',
  chapters: [],
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  ...overrides,
})

describe('useNextStepState', () => {
  it('returns null when no preflight', () => {
    const result = useNextStepState({
      project: makeProject(),
      pipeline: null,
      maintenanceActive: false,
      maintenanceFailed: false,
    })
    expect(result).toBeNull()
  })

  it('returns warning when no model bound', () => {
    const result = useNextStepState({
      project: makeProject({
        preflight: { hasModel: false } as any,
      }),
      pipeline: null,
      maintenanceActive: false,
      maintenanceFailed: false,
    })
    expect(result).not.toBeNull()
    expect(result?.ctaAction).toBe('settings')
    expect(result?.badgeVariant).toBe('warning')
  })

  it('returns retry action when maintenance failed', () => {
    const result = useNextStepState({
      project: makeProject({
        preflight: { hasModel: true } as any,
        maintenanceSummary: { bootstrapError: 'Test error' } as any,
      }),
      pipeline: null,
      maintenanceActive: false,
      maintenanceFailed: true,
    })
    expect(result).not.toBeNull()
    expect(result?.ctaAction).toBe('retry')
  })

  it('returns wait state when maintenance active', () => {
    const result = useNextStepState({
      project: makeProject({
        preflight: { hasModel: true } as any,
      }),
      pipeline: null,
      maintenanceActive: true,
      maintenanceFailed: false,
    })
    expect(result).not.toBeNull()
    expect(result?.ctaAction).toBe('wait')
    expect(result?.disabled).toBe(true)
  })

  it('returns blueprint action when no blueprint', () => {
    const result = useNextStepState({
      project: makeProject({
        preflight: { hasModel: true } as any,
      }),
      pipeline: null,
      maintenanceActive: false,
      maintenanceFailed: false,
    })
    expect(result).not.toBeNull()
    expect(result?.ctaAction).toBe('blueprint')
  })

  it('returns focus state when pipeline running', () => {
    const result = useNextStepState({
      project: makeProject({
        preflight: { hasModel: true } as any,
        bookBlueprint: { corePitch: 'test' } as any,
        blueprintConfirmedAt: '2024-01-01',
        arcPlans: [{ id: '1' }] as any,
        arcPlanConfirmedAt: '2024-01-01',
      }),
      pipeline: { status: 'RUNNING' } as PipelineStatus,
      maintenanceActive: false,
      maintenanceFailed: false,
    })
    expect(result).not.toBeNull()
    expect(result?.ctaAction).toBe('focus')
    expect(result?.badgeVariant).toBe('primary')
  })

  it('returns null when everything is ready', () => {
    const result = useNextStepState({
      project: makeProject({
        preflight: { hasModel: true } as any,
        bookBlueprint: { corePitch: 'test' } as any,
        blueprintConfirmedAt: '2024-01-01',
        arcPlans: [{ id: '1' }] as any,
        arcPlanConfirmedAt: '2024-01-01',
      }),
      pipeline: { status: 'IDLE' } as PipelineStatus,
      maintenanceActive: false,
      maintenanceFailed: false,
    })
    expect(result).toBeNull()
  })
})
