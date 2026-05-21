import type { AgentType } from '@prisma/client'

// ================================
// Agent 基础接口定义
// ================================

export interface AgentInput {
  projectId: number
  chapterNo: number
  [key: string]: unknown
}

export interface AgentOutput {
  success: boolean
  data?: unknown
  error?: string
  metadata?: Record<string, unknown>
}

export interface Agent<TInput extends AgentInput = AgentInput, TOutput extends AgentOutput = AgentOutput> {
  name: AgentType
  version: string
  
  execute(input: TInput): Promise<TOutput>
  
  // 条件执行判断
  shouldExecute?(input: TInput): boolean | Promise<boolean>
  
  // 前置钩子
  beforeExecute?(input: TInput): Promise<TInput>
  
  // 后置钩子
  afterExecute?(input: TInput, output: TOutput): Promise<TOutput>
  
  // 错误处理
  onError?(input: TInput, error: Error): Promise<void>
}

// ================================
// Pipeline 相关类型
// ================================

export interface PipelineStep {
  agent: Agent
  condition?: (context: PipelineContext) => boolean | Promise<boolean>
  timeoutMs?: number
  maxRetries?: number
}

export interface PipelineContext {
  projectId: number
  chapterNo: number
  currentStep: number
  totalSteps: number
  outputs: Map<string, AgentOutput>
  metadata: Record<string, unknown>
}

export interface PipelineConfig {
  name: string
  steps: PipelineStep[]
  onStepStart?: (context: PipelineContext, step: PipelineStep) => Promise<void>
  onStepComplete?: (context: PipelineContext, step: PipelineStep, output: AgentOutput) => Promise<void>
  onError?: (context: PipelineContext, step: PipelineStep, error: Error) => Promise<boolean> // 返回是否继续
}

// ================================
// Pipeline 构建器
// ================================

export class PipelineBuilder {
  private steps: PipelineStep[] = []
  private config: Partial<PipelineConfig> = {}

  constructor(name?: string) {
    if (name) {
      this.config.name = name
    }
  }

  static create(name?: string): PipelineBuilder {
    return new PipelineBuilder(name)
  }

  add(agent: Agent, options: Omit<PipelineStep, 'agent'> = {}): PipelineBuilder {
    this.steps.push({
      agent,
      ...options
    })
    return this
  }

  when(
    condition: (context: PipelineContext) => boolean | Promise<boolean>,
    builder: (builder: PipelineBuilder) => PipelineBuilder
  ): PipelineBuilder {
    const subBuilder = new PipelineBuilder()
    const built = builder(subBuilder)
    this.steps.push(...built.steps.map(step => ({
      ...step,
      condition: step.condition 
        ? async (ctx: PipelineContext) => (await condition(ctx)) && (await step.condition!(ctx))
        : condition
    })))
    return this
  }

  onStepStart(
    handler: (context: PipelineContext, step: PipelineStep) => Promise<void>
  ): PipelineBuilder {
    this.config.onStepStart = handler
    return this
  }

  onStepComplete(
    handler: (context: PipelineContext, step: PipelineStep, output: AgentOutput) => Promise<void>
  ): PipelineBuilder {
    this.config.onStepComplete = handler
    return this
  }

  onError(
    handler: (context: PipelineContext, step: PipelineStep, error: Error) => Promise<boolean>
  ): PipelineBuilder {
    this.config.onError = handler
    return this
  }

  build(): Pipeline {
    return new Pipeline({
      name: this.config.name || 'default',
      steps: this.steps,
      ...this.config
    })
  }
}

// ================================
// Pipeline 执行器
// ================================

export class Pipeline {
  constructor(private config: PipelineConfig) {}

  async execute(initialInput: AgentInput): Promise<PipelineContext> {
    const context: PipelineContext = {
      projectId: initialInput.projectId,
      chapterNo: initialInput.chapterNo,
      currentStep: 0,
      totalSteps: this.config.steps.length,
      outputs: new Map(),
      metadata: {}
    }

    for (let i = 0; i < this.config.steps.length; i++) {
      const step = this.config.steps[i]
      context.currentStep = i + 1

      // 检查条件
      if (step.condition) {
        const shouldExecute = await step.condition(context)
        if (!shouldExecute) {
          continue
        }
      }

      // 调用前置钩子
      if (this.config.onStepStart) {
        await this.config.onStepStart(context, step)
      }

      let output: AgentOutput
      const maxRetries = step.maxRetries || 3
      let attempts = 0

      while (attempts < maxRetries) {
        try {
          // 前置钩子
          let processedInput = initialInput
          if (step.agent.beforeExecute) {
            processedInput = await step.agent.beforeExecute(initialInput)
          }

          // 执行 Agent
          const result = await step.agent.execute({
            ...processedInput,
            // 将之前的输出注入到当前输入
            ...Object.fromEntries(context.outputs)
          })

          // 后置钩子
          if (step.agent.afterExecute) {
            output = await step.agent.afterExecute(initialInput, result)
          } else {
            output = result
          }

          if (!output.success && step.agent.onError) {
            await step.agent.onError(initialInput, new Error(output.error || 'Unknown error'))
          }

          // 保存输出
          context.outputs.set(step.agent.name, output)

          // 调用后置钩子
          if (this.config.onStepComplete) {
            await this.config.onStepComplete(context, step, output)
          }

          break
        } catch (error) {
          attempts++

          if (step.agent.onError) {
            await step.agent.onError(initialInput, error as Error)
          }

          if (this.config.onError) {
            const shouldContinue = await this.config.onError(
              context,
              step,
              error as Error
            )
            if (!shouldContinue) {
              throw error
            }
          }

          if (attempts >= maxRetries) {
            throw error
          }

          // 指数退避
          const delay = Math.min(1000 * Math.pow(2, attempts), 10000)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    return context
  }
}

// ================================
// 预设 Pipelines
// ================================

export function createNovelGenerationPipeline(): PipelineBuilder {
  return PipelineBuilder.create('novel-generation')
}
