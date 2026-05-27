import { ModelTier } from './base'
import { AIVendor } from '@/types'
import { prisma } from '@/lib/prisma'

export interface ModelConfig {
  vendor: AIVendor
  modelId: string
  description: string
  costPerMillionInput: number
  costPerMillionOutput: number
}

const modelTierMap: Record<ModelTier, ModelConfig[]> = {
  [ModelTier.OPUS]: [
    { vendor: AIVendor.ANTHROPIC, modelId: 'claude-opus-4', description: '复杂推理', costPerMillionInput: 15, costPerMillionOutput: 75 },
    { vendor: AIVendor.OPENAI, modelId: 'gpt-4o', description: '高级推理', costPerMillionInput: 2.5, costPerMillionOutput: 10 },
  ],
  [ModelTier.SONNET]: [
    { vendor: AIVendor.ANTHROPIC, modelId: 'claude-sonnet-4', description: '常规写作', costPerMillionInput: 3, costPerMillionOutput: 15 },
    { vendor: AIVendor.DEEPSEEK, modelId: 'deepseek-chat', description: '经济写作', costPerMillionInput: 0.27, costPerMillionOutput: 1.1 },
    { vendor: AIVendor.MIMO, modelId: 'mimo-v2.5', description: '长文写作', costPerMillionInput: 1.0, costPerMillionOutput: 2.0 },
    { vendor: AIVendor.OPENAI, modelId: 'gpt-4o-mini', description: '快速写作', costPerMillionInput: 0.15, costPerMillionOutput: 0.6 },
  ],
  [ModelTier.HAIKU]: [
    { vendor: AIVendor.ANTHROPIC, modelId: 'claude-haiku-4', description: '轻量检查', costPerMillionInput: 0.8, costPerMillionOutput: 4 },
    { vendor: AIVendor.DEEPSEEK, modelId: 'deepseek-chat', description: '经济检查', costPerMillionInput: 0.27, costPerMillionOutput: 1.1 },
    { vendor: AIVendor.MIMO, modelId: 'mimo-v2-flash', description: '轻量检查', costPerMillionInput: 1.0, costPerMillionOutput: 2.0 },
  ],
}

export function getModelForTier(tier: ModelTier, preferredVendor?: AIVendor): ModelConfig {
  const configs = modelTierMap[tier]
  if (!configs || configs.length === 0) {
    throw new Error(`No models configured for tier: ${tier}`)
  }

  if (preferredVendor) {
    const match = configs.find(c => c.vendor === preferredVendor)
    if (match) return match
  }

  return configs[0]
}

export async function getModelForProject(tier: ModelTier, projectId: number): Promise<ModelConfig> {
  const project = await prisma.novelProject.findUnique({
    where: { id: projectId },
    include: { aiModelConfig: true },
  })

  if (project?.aiModelConfig) {
    const preferredVendor = project.aiModelConfig.vendor as AIVendor
    const configs = modelTierMap[tier]
    const match = configs?.find(c => c.vendor === preferredVendor)
    if (match) return match
  }

  return getModelForTier(tier)
}

export function getAvailableModels(): Record<ModelTier, ModelConfig[]> {
  return { ...modelTierMap }
}
