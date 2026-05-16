import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AIVendor } from '@/types'

// 默认定价 (每百万 tokens，元)
const DEFAULT_PRICING = {
  [AIVendor.DEEPSEEK]: { input: 1.0, output: 2.0, defaultModel: 'deepseek-chat' },
  [AIVendor.OPENAI]: { input: 5.0, output: 15.0, defaultModel: 'gpt-4o-mini' },
  [AIVendor.ANTHROPIC]: { input: 3.0, output: 15.0, defaultModel: 'claude-3-5-sonnet-20241022' },
  [AIVendor.ALIBABA]: { input: 2.0, output: 6.0, defaultModel: 'qwen-max' },
  [AIVendor.MINIMAX]: { input: 0.5, output: 1.5, defaultModel: 'MiniMax-Text-01' },
  [AIVendor.VOLCENGINE]: { input: 1.5, output: 4.5, defaultModel: 'doubao-pro-32k' },
}

export async function POST(request: Request) {
  try {
    const { projectId, chapterCount, targetWordCount } = await request.json()
    
    // 基础估算参数
    const wordsPerChapter = targetWordCount || 3000
    const avgTokensPerWord = 1.5
    
    // 获取项目配置的模型和价格
    let vendor = AIVendor.DEEPSEEK
    let modelId = 'deepseek-chat'
    let inputPricePerMTokens = 1.0
    let outputPricePerMTokens = 2.0
    
    if (projectId) {
      const project = await prisma.novelProject.findUnique({
        where: { id: projectId },
        include: { aiModelConfig: true },
      })
      
      if (project?.aiModelConfig) {
        vendor = project.aiModelConfig.vendor as AIVendor
        
        // 获取模型定价
        const pricing = await prisma.modelPricing.findUnique({
          where: { 
            vendor_modelId: { 
              vendor, 
              modelId: project.aiModelConfig.modelId 
            } 
          },
        })
        
        modelId = project.aiModelConfig.modelId
        if (pricing) {
          inputPricePerMTokens = pricing.inputPrice.toNumber()
          outputPricePerMTokens = pricing.outputPrice.toNumber()
        } else {
          // 使用默认定价
          const defaultPricing = DEFAULT_PRICING[vendor] || DEFAULT_PRICING[AIVendor.DEEPSEEK]
          inputPricePerMTokens = defaultPricing.input
          outputPricePerMTokens = defaultPricing.output
        }
      } else {
        // 使用全局默认配置
        const defaultConfig = await prisma.aIModelConfig.findFirst({
          where: { isDefault: true },
        })
        
        if (defaultConfig) {
          vendor = defaultConfig.vendor as AIVendor
          modelId = defaultConfig.modelId
          
          const pricing = await prisma.modelPricing.findUnique({
            where: { 
              vendor_modelId: { 
                vendor, 
                modelId 
              } 
            },
          })
          
          if (pricing) {
            inputPricePerMTokens = pricing.inputPrice.toNumber()
            outputPricePerMTokens = pricing.outputPrice.toNumber()
          } else {
            const defaultPricing = DEFAULT_PRICING[vendor] || DEFAULT_PRICING[AIVendor.DEEPSEEK]
            inputPricePerMTokens = defaultPricing.input
            outputPricePerMTokens = defaultPricing.output
          }
        }
      }
    }
    
    // 计算预估 tokens
    const estimatedOutputTokens = Math.round(wordsPerChapter * avgTokensPerWord * chapterCount)
    const estimatedInputTokens = estimatedOutputTokens * 2 // 输入通常约为输出的2倍
    
    // 计算成本
    const inputCost = (estimatedInputTokens / 1000000) * inputPricePerMTokens
    const outputCost = (estimatedOutputTokens / 1000000) * outputPricePerMTokens
    const totalCost = inputCost + outputCost
    
    // 获取配额信息
    let quotaRemaining = 50.0 // 默认剩余配额
    let quotaUsed = 0.0
    let willExceedQuota = false
    
    try {
      // 临时：使用默认用户 ID
      const DEFAULT_USER_ID = 1
      
      const quota = await prisma.userQuota.findUnique({
        where: { userId: DEFAULT_USER_ID },
      })
      
      const month = new Date()
      const monthStr = month.getFullYear() * 100 + (month.getMonth() + 1)
      
      const usageStats = await prisma.aIUsage.aggregate({
        where: {
          userId: DEFAULT_USER_ID,
          usageMonth: monthStr
        },
        _sum: {
          totalCost: true
        }
      })
      
      quotaUsed = usageStats._sum.totalCost?.toNumber() || 0
      quotaRemaining = (quota?.monthlyLimit?.toNumber() || 50.0) - quotaUsed
      willExceedQuota = totalCost > quotaRemaining
    } catch (error) {
      console.warn('获取配额信息失败:', error)
    }
    
    return NextResponse.json({
      success: true,
      data: {
        estimatedInputTokens,
        estimatedOutputTokens,
        estimatedCost: totalCost,
        modelId,
        chapterCount,
        quotaRemaining: Math.max(0, quotaRemaining),
        quotaUsed,
        willExceedQuota
      }
    })
  } catch (error) {
    console.error('预估成本失败:', error)
    return NextResponse.json(
      { success: false, error: { code: 'ESTIMATION_FAILED', message: '成本预估失败' } },
      { status: 500 }
    )
  }
}
