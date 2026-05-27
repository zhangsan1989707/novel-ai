import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { AIVendor } from '@/types'
import { Decimal } from '@prisma/client/runtime/library'

// 默认定价（每百万 token，CNY）
const DEFAULT_PRICINGS: {
  vendor: AIVendor
  modelId: string
  inputPrice: number
  outputPrice: number
}[] = [
  { vendor: AIVendor.DEEPSEEK, modelId: 'deepseek-chat', inputPrice: 1.0, outputPrice: 2.0 },
  { vendor: AIVendor.DEEPSEEK, modelId: 'deepseek-v4-flash', inputPrice: 1.0, outputPrice: 2.0 },
  { vendor: AIVendor.DEEPSEEK, modelId: 'deepseek-v4-pro', inputPrice: 3.0, outputPrice: 6.0 }, // 2.5 折优惠价
  { vendor: AIVendor.OPENAI, modelId: 'gpt-4o', inputPrice: 5.0, outputPrice: 15.0 },
  { vendor: AIVendor.OPENAI, modelId: 'gpt-4o-mini', inputPrice: 0.15, outputPrice: 0.6 },
  { vendor: AIVendor.ANTHROPIC, modelId: 'claude-3-5-sonnet-20241022', inputPrice: 3.0, outputPrice: 15.0 },
  { vendor: AIVendor.ALIBABA, modelId: 'qwen-max', inputPrice: 2.0, outputPrice: 6.0 },
  { vendor: AIVendor.MINIMAX, modelId: 'MiniMax-Text-01', inputPrice: 0.5, outputPrice: 1.5 },
  { vendor: AIVendor.MIMO, modelId: 'mimo-v2-flash', inputPrice: 1.0, outputPrice: 2.0 },
  { vendor: AIVendor.MIMO, modelId: 'mimo-v2.5', inputPrice: 1.0, outputPrice: 2.0 },
  { vendor: AIVendor.MIMO, modelId: 'mimo-v2.5-pro', inputPrice: 1.0, outputPrice: 2.0 },
  { vendor: AIVendor.VOLCENGINE, modelId: 'doubao-pro-32k', inputPrice: 1.5, outputPrice: 4.5 },
  { vendor: AIVendor.ZHIPU, modelId: 'glm-4-0520', inputPrice: 1.0, outputPrice: 1.0 },
  { vendor: AIVendor.ZHIPU, modelId: 'glm-4-flash', inputPrice: 0.1, outputPrice: 0.1 },
  { vendor: AIVendor.ZHIPU, modelId: 'glm-4-airx', inputPrice: 0.6, outputPrice: 0.6 },
]

/**
 * 计算成本
 */
export function calculateCost(
  promptTokens: number,
  completionTokens: number,
  inputPrice: number,
  outputPrice: number
): { inputCost: number; outputCost: number; totalCost: number } {
  const inputCost = (promptTokens / 1_000_000) * inputPrice
  const outputCost = (completionTokens / 1_000_000) * outputPrice
  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
  }
}

/**
 * 获取模型定价
 */
export async function getModelPricing(vendor: AIVendor, modelId: string) {
  let pricing = await prisma.modelPricing.findUnique({
    where: { vendor_modelId: { vendor, modelId } },
  })

  if (!pricing) {
    // 使用默认定价
    const defaultPricing = DEFAULT_PRICINGS.find(
      (p) => p.vendor === vendor && p.modelId === modelId
    )
    if (defaultPricing) {
      // 插入默认定价到数据库
      pricing = await prisma.modelPricing.create({
        data: {
          vendor,
          modelId,
          inputPrice: new Decimal(defaultPricing.inputPrice),
          outputPrice: new Decimal(defaultPricing.outputPrice),
          currency: 'CNY',
        },
      })
    } else {
      // 如果没有默认定价，使用通用默认值
      pricing = await prisma.modelPricing.create({
        data: {
          vendor,
          modelId,
          inputPrice: new Decimal(1.0),
          outputPrice: new Decimal(2.0),
          currency: 'CNY',
        },
      })
    }
  }

  return pricing
}

/**
 * 记录 AI 使用
 */
export async function recordUsage(options: {
  userId: number
  projectId?: number | null
  vendor: AIVendor
  modelId: string
  usageType: string
  promptTokens: number
  completionTokens: number
}) {
  const { userId, projectId, vendor, modelId, usageType, promptTokens, completionTokens } = options

  const pricing = await getModelPricing(vendor, modelId)
  const costs = calculateCost(
    promptTokens,
    completionTokens,
    pricing.inputPrice.toNumber(),
    pricing.outputPrice.toNumber()
  )

  const now = new Date()
  const usageMonth = now.getFullYear() * 100 + (now.getMonth() + 1)

  const usage = await prisma.aIUsage.create({
    data: {
      userId,
      projectId: projectId ?? undefined,
      vendor,
      modelId,
      usageType,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      inputCost: new Decimal(costs.inputCost),
      outputCost: new Decimal(costs.outputCost),
      totalCost: new Decimal(costs.totalCost),
      usageMonth,
    },
  })

  return { usage, costs }
}

/**
 * 获取用户月度使用统计
 */
export async function getMonthlyUsage(userId: number, yearMonth?: number) {
  const now = new Date()
  const targetMonth = yearMonth || now.getFullYear() * 100 + (now.getMonth() + 1)

  const usages = await prisma.aIUsage.findMany({
    where: {
      userId,
      usageMonth: targetMonth,
    },
  })

  const totalTokens = usages.reduce((sum, u) => sum + u.totalTokens, 0)
  const totalCost = usages.reduce((sum, u) => sum + u.totalCost.toNumber(), 0)

  // 按项目统计
  const byProject = usages.reduce<
    Record<number, { tokens: number; cost: number }>
  >((acc, u) => {
    if (u.projectId) {
      if (!acc[u.projectId]) {
        acc[u.projectId] = { tokens: 0, cost: 0 }
      }
      acc[u.projectId].tokens += u.totalTokens
      acc[u.projectId].cost += u.totalCost.toNumber()
    }
    return acc
  }, {})

  return {
    month: targetMonth,
    totalTokens,
    totalCost,
    byProject,
    usageCount: usages.length,
  }
}

/**
 * 获取或创建用户配额
 */
export async function getUserQuota(userId: number) {
  let quota = await prisma.userQuota.findUnique({
    where: { userId },
  })

  if (!quota) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      await prisma.user.create({
        data: {
          id: userId,
          name: 'Default User',
          email: 'default@novel-ai.local',
          password: 'default-not-used',
        },
      })
    }

    quota = await prisma.userQuota.create({
      data: {
        userId,
        monthlyLimit: 50.0,
        alertThreshold: 0.8,
        isLocked: false,
      },
    })
  }

  return quota
}

/**
 * 检查配额状态
 */
export async function checkQuotaStatus(userId: number) {
  const [quota, usage] = await Promise.all([
    getUserQuota(userId),
    getMonthlyUsage(userId),
  ])

  const usagePercent = quota.monthlyLimit.toNumber() > 0
    ? usage.totalCost / quota.monthlyLimit.toNumber()
    : 0

  return {
    quota: {
      monthlyLimit: quota.monthlyLimit.toNumber(),
      alertThreshold: quota.alertThreshold.toNumber(),
      isLocked: quota.isLocked,
    },
    usage,
    usagePercent,
    isOverLimit: usagePercent >= 1.0,
    isWarning: usagePercent >= quota.alertThreshold.toNumber() && usagePercent < 1.0,
    remaining: Math.max(0, quota.monthlyLimit.toNumber() - usage.totalCost),
  }
}

// 定义类型别名
type QuotaStatusResult = Awaited<ReturnType<typeof checkQuotaStatus>>

/**
 * 检查是否可以继续调用（在调用前检查）
 */
export async function canProceedWithGeneration(userId: number): Promise<{
  allowed: boolean
  reason?: string
  status?: QuotaStatusResult
}> {
  const status = await checkQuotaStatus(userId)

  if (status.quota.isLocked) {
    return {
      allowed: false,
      reason: '账户已被锁定，请联系管理员',
      status,
    }
  }

  if (status.isOverLimit) {
    return {
      allowed: false,
      reason: `本月配额已用完（已使用 ${status.usage.totalCost.toFixed(2)} 元，限额 ${status.quota.monthlyLimit.toFixed(2)} 元）`,
      status,
    }
  }

  return {
    allowed: true,
    status,
  }
}

/**
 * 预估成本
 */
export function estimateCost(
  promptTokens: number,
  estimatedCompletionTokens: number,
  inputPrice: number,
  outputPrice: number
) {
  return calculateCost(promptTokens, estimatedCompletionTokens, inputPrice, outputPrice)
}

/**
 * 初始化默认定价
 */
export async function initializeDefaultPricings() {
  for (const pricing of DEFAULT_PRICINGS) {
    await prisma.modelPricing.upsert({
      where: {
        vendor_modelId: {
          vendor: pricing.vendor as AIVendor,
          modelId: pricing.modelId,
        },
      },
      update: {},
      create: {
        vendor: pricing.vendor as AIVendor,
        modelId: pricing.modelId,
        inputPrice: pricing.inputPrice,
        outputPrice: pricing.outputPrice,
        currency: 'CNY',
      },
    })
  }
  logger.info('Default model pricings initialized')
}
