import type { WorkflowHook, HookTrigger, HookContext, HookResult, HookExecutionRecord } from './types'
import {
  onProjectCreate,
  onChapterGenerateStart,
  onChapterGenerateEnd,
  onStoryGapDetect,
  onPreContextCompress,
  onPostContextCompress,
  onPreCommit,
} from './builtins'

class HookRegistry {
  private hooks: Map<string, WorkflowHook> = new Map()
  private handlers: Map<string, (context: HookContext) => Promise<HookResult>> = new Map()
  private executionHistory: HookExecutionRecord[] = []
  private maxHistorySize = 100

  register(hook: WorkflowHook, handler: (context: HookContext) => Promise<HookResult>): void {
    this.hooks.set(hook.id, hook)
    this.handlers.set(hook.id, handler)
  }

  unregister(hookId: string): void {
    this.hooks.delete(hookId)
    this.handlers.delete(hookId)
  }

  getHooksByTrigger(trigger: HookTrigger): WorkflowHook[] {
    return Array.from(this.hooks.values())
      .filter(h => h.trigger === trigger && h.enabled)
      .sort((a, b) => a.priority - b.priority)
  }

  getAllHooks(): WorkflowHook[] {
    return Array.from(this.hooks.values()).sort((a, b) => a.priority - b.priority)
  }

  getHook(hookId: string): WorkflowHook | undefined {
    return this.hooks.get(hookId)
  }

  setEnabled(hookId: string, enabled: boolean): boolean {
    const hook = this.hooks.get(hookId)
    if (!hook) return false
    hook.enabled = enabled
    this.hooks.set(hookId, hook)
    return true
  }

  async execute(trigger: HookTrigger, context: HookContext): Promise<HookResult[]> {
    const hooks = this.getHooksByTrigger(trigger)
    const results: HookResult[] = []

    for (const hook of hooks) {
      const handler = this.handlers.get(hook.id)
      if (!handler) continue

      try {
        const result = await handler(context)

        const record: HookExecutionRecord = {
          hookId: hook.id,
          hookName: hook.name,
          trigger,
          action: result.action,
          message: result.message,
          data: result.data,
          executedAt: new Date().toISOString(),
        }
        this.addHistory(record)

        results.push(result)

        if (result.action === 'block') {
          break
        }
      } catch {
        const record: HookExecutionRecord = {
          hookId: hook.id,
          hookName: hook.name,
          trigger,
          action: 'warn',
          message: `Hook 执行异常`,
          executedAt: new Date().toISOString(),
        }
        this.addHistory(record)
        results.push({ action: 'warn', message: `Hook ${hook.name} 执行异常` })
      }
    }

    return results
  }

  getExecutionHistory(limit: number = 50): HookExecutionRecord[] {
    return this.executionHistory.slice(-limit)
  }

  private addHistory(record: HookExecutionRecord): void {
    this.executionHistory.push(record)
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(-this.maxHistorySize)
    }
  }
}

export const hookRegistry = new HookRegistry()

export function registerBuiltinHooks(): void {
  hookRegistry.register(
    {
      id: 'builtin-project-create',
      name: '项目创建初始化',
      trigger: 'project_create',
      description: '项目创建时检查设定完整性，提示补充缺失设定',
      enabled: true,
      priority: 10,
    },
    onProjectCreate
  )

  hookRegistry.register(
    {
      id: 'builtin-chapter-generate-start',
      name: '章节生成前检测',
      trigger: 'chapter_generate_start',
      description: '章节生成开始时检测世界观、主角、大纲等设定缺口',
      enabled: true,
      priority: 10,
    },
    onChapterGenerateStart
  )

  hookRegistry.register(
    {
      id: 'builtin-chapter-generate-end',
      name: '章节生成后更新',
      trigger: 'chapter_generate_end',
      description: '章节生成结束后更新项目状态和总字数',
      enabled: true,
      priority: 10,
    },
    onChapterGenerateEnd
  )

  hookRegistry.register(
    {
      id: 'builtin-story-gap-detect',
      name: '故事缺口检测',
      trigger: 'story_gap_detect',
      description: '检测未回收的过期伏笔、角色状态矛盾、时间线冲突',
      enabled: true,
      priority: 20,
    },
    onStoryGapDetect
  )

  hookRegistry.register(
    {
      id: 'builtin-pre-context-compress',
      name: '压缩前快照',
      trigger: 'pre_context_compress',
      description: '上下文压缩前保存当前进度摘要到 StoryState',
      enabled: true,
      priority: 10,
    },
    onPreContextCompress
  )

  hookRegistry.register(
    {
      id: 'builtin-post-context-compress',
      name: '压缩后恢复提示',
      trigger: 'post_context_compress',
      description: '上下文压缩后提示读取进度快照恢复关键信息',
      enabled: true,
      priority: 10,
    },
    onPostContextCompress
  )

  hookRegistry.register(
    {
      id: 'builtin-pre-commit',
      name: '提交前验证',
      trigger: 'pre_commit',
      description: '检查角色属性硬编码、设定字段必填、伏笔有始有终',
      enabled: true,
      priority: 10,
    },
    onPreCommit
  )
}

registerBuiltinHooks()
