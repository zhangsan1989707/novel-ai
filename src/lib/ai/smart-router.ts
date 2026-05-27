/**
 * 多模型智能路由系统
 * 根据任务类型自动选择最优模型
 */
import { AIVendor } from '@/types'
import { getModelPricing as getModelPricingFromTracker } from '@/lib/cost-tracker'

interface ModelMetrics {
  totalRequests: number
  successRate: number
  avgLatency: number
  avgCost: number
  lastUsed: Date
}

interface ModelCapability {
  type: 'WRITER' | 'PLANNER' | 'POLISHER' | 'VALIDATOR' | 'SUMMARIZER' | 'ANALYZER'
  strengths: string[]
  weaknesses: string[]
  recommendedFor: string[]
}

interface ModelInfo {
  vendor: AIVendor
  modelId: string
  displayName: string
  capabilities: ModelCapability[]
  contextWindow: number
  costPer1K: { input: number; output: number }
  isAvailable: boolean
  metrics?: ModelMetrics
}

interface RouteConfig {
  preferQuality: boolean
  preferCost: boolean
  preferSpeed: boolean
  fallbackEnabled: boolean
  maxRetries: number
}

interface RouteResult {
  selectedModel: ModelInfo
  fallbackModels: ModelInfo[]
  reasoning: string
  estimatedCost: number
  estimatedTime: number
}

// 模型能力矩阵
const MODEL_CAPABILITIES: Record<string, ModelCapability[]> = {
  'gpt-4o': [
    { type: 'WRITER', strengths: ['文笔优美', '情感丰富'], weaknesses: ['可能过度华丽'], recommendedFor: ['感情戏', '高潮场景'] },
    { type: 'PLANNER', strengths: ['结构清晰', '逻辑严密'], weaknesses: ['创意一般'], recommendedFor: ['大框架设计'] },
    { type: 'VALIDATOR', strengths: ['眼光敏锐', '建议实用'], weaknesses: [], recommendedFor: ['质量把控'] },
  ],
  'gpt-4o-mini': [
    { type: 'WRITER', strengths: ['速度快', '价格低'], weaknesses: ['质量一般'], recommendedFor: ['草稿生成'] },
    { type: 'SUMMARIZER', strengths: ['简洁', '抓重点'], weaknesses: ['细节不足'], recommendedFor: ['快速摘要'] },
  ],
  'deepseek-chat': [
    { type: 'WRITER', strengths: ['文风多样', '创意强'], weaknesses: ['一致性稍差'], recommendedFor: ['风格尝试', '创意写作'] },
    { type: 'PLANNER', strengths: ['创意丰富', '角度新颖'], weaknesses: ['可能过于天马行空'], recommendedFor: ['创新剧情'] },
    { type: 'POLISHER', strengths: ['润色自然'], weaknesses: [], recommendedFor: ['文风优化'] },
  ],
  'deepseek-v4-flash': [
    { type: 'WRITER', strengths: ['速度极快', '价格最低'], weaknesses: ['质量有限'], recommendedFor: ['快速迭代'] },
    { type: 'SUMMARIZER', strengths: ['速度极快'], weaknesses: ['质量一般'], recommendedFor: ['大批量处理'] },
  ],
  'claude-3-5-sonnet': [
    { type: 'WRITER', strengths: ['文笔顶级', '创意丰富', '一致性极佳'], weaknesses: ['价格较高'], recommendedFor: ['核心章节', '重要场景'] },
    { type: 'ANALYZER', strengths: ['分析深入', '洞察力强'], weaknesses: [], recommendedFor: ['拆书分析', '风格分析'] },
    { type: 'VALIDATOR', strengths: ['标准严格', '建议详细'], weaknesses: [], recommendedFor: ['质量校验'] },
  ],
  'qwen-plus': [
    { type: 'WRITER', strengths: ['中文优化', '网文熟悉'], weaknesses: ['英文内容一般'], recommendedFor: ['中文网文'] },
    { type: 'SUMMARIZER', strengths: ['中文理解好'], weaknesses: [], recommendedFor: ['中文摘要'] },
  ],
  'mimo-v2.5-pro': [
    { type: 'WRITER', strengths: ['长文生成稳定', '推理能力强'], weaknesses: ['生态较新'], recommendedFor: ['长篇写作', 'Agent 任务'] },
    { type: 'PLANNER', strengths: ['结构规划清晰'], weaknesses: [], recommendedFor: ['大纲设计', '阶段规划'] },
    { type: 'POLISHER', strengths: ['语义润色自然'], weaknesses: [], recommendedFor: ['内容润色'] },
    { type: 'VALIDATOR', strengths: ['检查细致'], weaknesses: [], recommendedFor: ['质量校验'] },
    { type: 'SUMMARIZER', strengths: ['压缩摘要能力稳定'], weaknesses: [], recommendedFor: ['章节摘要', '全书摘要'] },
    { type: 'ANALYZER', strengths: ['分析能力强'], weaknesses: [], recommendedFor: ['拆解分析'] },
  ],
  'mimo-v2.5': [
    { type: 'WRITER', strengths: ['长文速度与质量均衡'], weaknesses: ['复杂审稿不如 pro'], recommendedFor: ['日常正文生成'] },
    { type: 'PLANNER', strengths: ['规划稳定'], weaknesses: [], recommendedFor: ['蓝图与阶段规划'] },
    { type: 'SUMMARIZER', strengths: ['摘要稳定'], weaknesses: [], recommendedFor: ['章节摘要'] },
  ],
  'mimo-v2-flash': [
    { type: 'PLANNER', strengths: ['响应快'], weaknesses: ['深度有限'], recommendedFor: ['快速规划小样'] },
    { type: 'VALIDATOR', strengths: ['检查快'], weaknesses: ['细节有限'], recommendedFor: ['轻量质量门'] },
    { type: 'SUMMARIZER', strengths: ['压缩快'], weaknesses: ['表达一般'], recommendedFor: ['批量摘要'] },
  ],
}

const DEFAULT_CONFIG: RouteConfig = {
  preferQuality: true,
  preferCost: false,
  preferSpeed: false,
  fallbackEnabled: true,
  maxRetries: 2,
}

/**
 * 获取模型信息
 */
async function getModelInfo(vendor: AIVendor, modelId: string): Promise<ModelInfo> {
  const capabilities = MODEL_CAPABILITIES[modelId] || [
    { type: 'WRITER', strengths: ['通用'], weaknesses: [], recommendedFor: ['基础写作'] },
  ]

  // 获取成本信息
  const pricingData = await getModelPricingFromTracker(vendor, modelId)
  const pricing = pricingData ? {
    input: pricingData.inputPrice.toNumber(),
    output: pricingData.outputPrice.toNumber(),
  } : { input: 0.01, output: 0.03 }

  return {
    vendor,
    modelId,
    displayName: `${vendor}-${modelId}`,
    capabilities,
    contextWindow: 128000,
    costPer1K: pricing,
    isAvailable: true,
  }
}

/**
 * 评估任务与模型的匹配度
 */
function evaluateMatch(
  task: string,
  agentType: string,
  model: ModelInfo
): number {
  const agentCapabilities = model.capabilities.filter(c => c.type === agentType)
  
  if (agentCapabilities.length === 0) {
    return 0.3 // 基础分
  }

  let score = 0.7 // 基础分

  for (const capability of agentCapabilities) {
    // 检查是否推荐用于此任务
    for (const recommended of capability.recommendedFor) {
      if (task.includes(recommended)) {
        score += 0.1
      }
    }
  }

  return Math.min(score, 1.0)
}

/**
 * 智能路由选择
 */
export async function selectModel(
  task: string,
  agentType: 'WRITER' | 'PLANNER' | 'POLISHER' | 'VALIDATOR' | 'SUMMARIZER' | 'ANALYZER',
  projectId: number,
  options: {
    config?: Partial<RouteConfig>
    preferredVendors?: AIVendor[]
    contextLength?: number
  } = {}
): Promise<RouteResult> {
  const config = { ...DEFAULT_CONFIG, ...options.config }

  // 1. 获取可用模型列表
  const availableModels: ModelInfo[] = []

  const vendors = options.preferredVendors || [
    AIVendor.DEEPSEEK,
    AIVendor.OPENAI,
    AIVendor.ANTHROPIC,
    AIVendor.ALIBABA,
    AIVendor.MINIMAX,
    AIVendor.MIMO,
    AIVendor.ZHIPU,
  ]

  // 根据不同 Agent 类型推荐不同模型
  const modelPriority: Record<string, AIVendor[]> = {
    WRITER: [AIVendor.ANTHROPIC, AIVendor.DEEPSEEK, AIVendor.MIMO, AIVendor.OPENAI],
    PLANNER: [AIVendor.DEEPSEEK, AIVendor.MIMO, AIVendor.OPENAI, AIVendor.ANTHROPIC],
    POLISHER: [AIVendor.DEEPSEEK, AIVendor.MIMO, AIVendor.OPENAI],
    VALIDATOR: [AIVendor.ANTHROPIC, AIVendor.OPENAI, AIVendor.DEEPSEEK, AIVendor.MIMO],
    SUMMARIZER: [AIVendor.DEEPSEEK, AIVendor.MIMO, AIVendor.ALIBABA, AIVendor.OPENAI],
    ANALYZER: [AIVendor.ANTHROPIC, AIVendor.OPENAI, AIVendor.DEEPSEEK, AIVendor.MIMO],
  }

  const priorityOrder = modelPriority[agentType] || vendors

  for (const vendor of priorityOrder) {
    // 获取该厂商推荐的模型
    const modelIds = getRecommendedModels(vendor, agentType)
    for (const modelId of modelIds) {
      try {
        const modelInfo = await getModelInfo(vendor, modelId)
        if (modelInfo.isAvailable) {
          availableModels.push(modelInfo)
        }
      } catch {
        // 模型不可用，跳过
      }
    }
  }

  // 2. 计算每个模型的评分
  const scoredModels = availableModels.map(model => {
    const matchScore = evaluateMatch(task, agentType, model)
    const costScore = config.preferCost ? calculateCostScore(model.costPer1K) : 0.5
    const speedScore = config.preferSpeed ? calculateSpeedScore(model.modelId) : 0.5

    // 综合评分
    const weights = {
      match: 0.5,
      cost: config.preferCost ? 0.3 : 0.1,
      speed: config.preferSpeed ? 0.3 : 0.1,
      quality: config.preferQuality ? 0.3 : 0.1,
    }

    const qualityScore = calculateQualityScore(model)

    const totalScore = 
      matchScore * weights.match +
      costScore * weights.cost +
      speedScore * weights.speed +
      qualityScore * weights.quality

    return { model, score: totalScore }
  })

  // 3. 排序并选择最佳模型
  scoredModels.sort((a, b) => b.score - a.score)

  const selectedModel = scoredModels[0].model
  const fallbackModels = scoredModels.slice(1, config.maxRetries + 1).map(s => s.model)

  // 4. 生成推理说明
  const reasoning = generateReasoning(selectedModel, scoredModels[0].score, agentType)

  return {
    selectedModel,
    fallbackModels,
    reasoning,
    estimatedCost: selectedModel.costPer1K.output * 3, // 估算3K输出
    estimatedTime: calculateEstimatedTime(selectedModel),
  }
}

/**
 * 获取推荐模型列表
 */
function getRecommendedModels(
  vendor: AIVendor,
  agentType: string
): string[] {
  const models: Record<AIVendor, Record<string, string[]>> = {
    [AIVendor.OPENAI]: {
      WRITER: ['gpt-4o', 'gpt-4o-mini'],
      PLANNER: ['gpt-4o', 'gpt-4o-mini'],
      POLISHER: ['gpt-4o', 'gpt-4o-mini'],
      VALIDATOR: ['gpt-4o', 'gpt-4o-mini'],
      SUMMARIZER: ['gpt-4o-mini'],
      ANALYZER: ['gpt-4o'],
    },
    [AIVendor.ANTHROPIC]: {
      WRITER: ['claude-3-5-sonnet-20240620', 'claude-3-sonnet-20240229'],
      PLANNER: ['claude-3-5-sonnet-20240620'],
      POLISHER: ['claude-3-5-sonnet-20240620'],
      VALIDATOR: ['claude-3-5-sonnet-20240620'],
      SUMMARIZER: ['claude-3-sonnet-20240229'],
      ANALYZER: ['claude-3-5-sonnet-20240620'],
    },
    [AIVendor.DEEPSEEK]: {
      WRITER: ['deepseek-chat', 'deepseek-v4-flash'],
      PLANNER: ['deepseek-chat', 'deepseek-v4-flash'],
      POLISHER: ['deepseek-chat'],
      VALIDATOR: ['deepseek-chat'],
      SUMMARIZER: ['deepseek-chat', 'deepseek-v4-flash'],
      ANALYZER: ['deepseek-chat'],
    },
    [AIVendor.ALIBABA]: {
      WRITER: ['qwen-plus', 'qwen-turbo'],
      PLANNER: ['qwen-plus'],
      POLISHER: ['qwen-plus'],
      VALIDATOR: ['qwen-plus'],
      SUMMARIZER: ['qwen-turbo'],
      ANALYZER: ['qwen-plus'],
    },
    [AIVendor.MINIMAX]: {
      WRITER: ['abab6-chat'],
      PLANNER: ['abab6-chat'],
      POLISHER: ['abab6-chat'],
      VALIDATOR: ['abab6-chat'],
      SUMMARIZER: ['abab6-chat'],
      ANALYZER: ['abab6-chat'],
    },
    [AIVendor.MIMO]: {
      WRITER: ['mimo-v2.5', 'mimo-v2.5-pro'],
      PLANNER: ['mimo-v2.5', 'mimo-v2-flash'],
      POLISHER: ['mimo-v2.5-pro', 'mimo-v2.5'],
      VALIDATOR: ['mimo-v2-flash', 'mimo-v2.5-pro'],
      SUMMARIZER: ['mimo-v2-flash', 'mimo-v2.5'],
      ANALYZER: ['mimo-v2.5', 'mimo-v2.5-pro'],
    },
    [AIVendor.VOLCENGINE]: {
      WRITER: ['doubao-pro-32k'],
      PLANNER: ['doubao-pro-32k'],
      POLISHER: ['doubao-pro-32k'],
      VALIDATOR: ['doubao-pro-32k'],
      SUMMARIZER: ['doubao-pro-32k'],
      ANALYZER: ['doubao-pro-32k'],
    },
    [AIVendor.ZHIPU]: {
      WRITER: ['glm-4-0520', 'glm-4-flash'],
      PLANNER: ['glm-4-0520'],
      POLISHER: ['glm-4-0520'],
      VALIDATOR: ['glm-4-0520'],
      SUMMARIZER: ['glm-4-flash'],
      ANALYZER: ['glm-4-0520'],
    },
  }

  return models[vendor]?.[agentType] || []
}

/**
 * 计算成本评分
 */
function calculateCostScore(cost: { input: number; output: number }): number {
  const avgCost = (cost.input + cost.output) / 2
  if (avgCost < 0.001) return 1.0
  if (avgCost < 0.01) return 0.8
  if (avgCost < 0.1) return 0.5
  return 0.2
}

/**
 * 计算速度评分
 */
function calculateSpeedScore(modelId: string): number {
  if (modelId.includes('flash') || modelId.includes('mini') || modelId.includes('turbo')) {
    return 1.0
  }
  if (modelId.includes('pro') || modelId.includes('plus')) {
    return 0.7
  }
  return 0.5
}

/**
 * 计算质量评分
 */
function calculateQualityScore(model: ModelInfo): number {
  if (model.modelId.includes('claude-3-5') || model.modelId.includes('gpt-4o')) {
    return 1.0
  }
  if (model.modelId.includes('gpt-4') || model.modelId.includes('claude-3')) {
    return 0.9
  }
  if (model.modelId.includes('deepseek-chat') || model.modelId.includes('qwen-plus')) {
    return 0.8
  }
  return 0.6
}

/**
 * 生成推理说明
 */
function generateReasoning(
  model: ModelInfo,
  score: number,
  agentType: string
): string {
  const capability = model.capabilities.find(c => c.type === agentType)
  
  if (capability) {
    return `选择 ${model.displayName} 用于 ${agentType} 任务，因为它在${capability.strengths.join('、')}方面表现优秀（匹配度：${Math.round(score * 100)}%）`
  }
  
  return `选择 ${model.displayName} 用于 ${agentType} 任务（匹配度：${Math.round(score * 100)}%）`
}

/**
 * 计算预估时间
 */
function calculateEstimatedTime(model: ModelInfo): number {
  if (model.modelId.includes('flash') || model.modelId.includes('mini')) {
    return 5 // 5秒
  }
  if (model.modelId.includes('pro') || model.modelId.includes('plus')) {
    return 15 // 15秒
  }
  return 30 // 30秒
}

/**
 * 智能路由执行器
 * 支持自动降级和重试
 */
export async function executeWithSmartRouting<T>(
  task: string,
  agentType: 'WRITER' | 'PLANNER' | 'POLISHER' | 'VALIDATOR' | 'SUMMARIZER' | 'ANALYZER',
  projectId: number,
  executor: (model: ModelInfo) => Promise<T>,
  options: {
    config?: Partial<RouteConfig>
    preferredVendors?: AIVendor[]
  } = {}
): Promise<{ result: T; model: ModelInfo }> {
  const config = { ...DEFAULT_CONFIG, ...options.config }

  // 1. 选择模型
  const routeResult = await selectModel(task, agentType, projectId, {
    config,
    preferredVendors: options.preferredVendors,
  })

  // 2. 尝试执行
  const modelsToTry = [routeResult.selectedModel, ...routeResult.fallbackModels]
  
  let lastError: Error | null = null
  
  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i]
    
    try {
      const result = await executor(model)
      return { result, model }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.error(`模型 ${model.displayName} 执行失败:`, lastError.message)
      
      // 如果不是最后一次尝试，继续降级
      if (i < modelsToTry.length - 1) {
        console.log(`降级到备选模型: ${modelsToTry[i + 1].displayName}`)
      }
    }
  }

  // 所有模型都失败
  throw new Error(`所有模型执行失败，最后错误: ${lastError?.message || '未知错误'}`)
}

export type { ModelMetrics, ModelCapability, ModelInfo, RouteConfig, RouteResult }
