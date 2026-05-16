export interface WorkflowHook {
  id: string
  name: string
  trigger: HookTrigger
  description: string
  enabled: boolean
  priority: number
}

export type HookTrigger =
  | 'project_create'
  | 'chapter_generate_start'
  | 'chapter_generate_end'
  | 'chapter_save'
  | 'story_gap_detect'
  | 'pre_context_compress'
  | 'post_context_compress'
  | 'pre_commit'

export interface HookContext {
  projectId?: number
  chapterNo?: number
  content?: string
  metadata?: Record<string, unknown>
}

export interface HookResult {
  action: 'continue' | 'warn' | 'block'
  message?: string
  data?: Record<string, unknown>
}

export interface HookExecutionRecord {
  hookId: string
  hookName: string
  trigger: HookTrigger
  action: HookResult['action']
  message?: string
  data?: Record<string, unknown>
  executedAt: string
}
