import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AIVendor } from '@/types'

// 默认定价 (每百万 tokens，元)
const DEFAULT_PRICING = {
  [AIVendor.DEEPSEEK]: { 
    input: 1.0, 
    output: 2.0, 
    defaultModel: 'deepseek-chat',
    models: {
      'deepseek-chat': { input: 1.0, output: 2.0 },
      'deepseek-v4-flash': { input: 1.0, output: 2.0 },
      'deepseek-v4-pro': { input: 3.0, output: 6.0 } // 2.5 折优惠价
    }
  },
  [AIVendor.OPENAI]: { 
    input: 5.0, 
    output: 15.0, 
    defaultModel: 'gpt-4o-mini',
    models: {
      'gpt-4o': { input: 5.0, output: 15.0 },
      'gpt-4o-mini': { input: 0.15, output: 0.6 }
    }
  },
  [AIVendor.ANTHROPIC]: { 
    input: 3.0, 
    output: 15.0, 
    defaultModel: 'claude-3-5-sonnet-20241022',
    models: {
      'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 }
    }
  },
  [AIVendor.ALIBABA]: { 
    input: 2.0, 
    output: 6.0, 
    defaultModel: 'qwen-max',
    models: {
      'qwen-max': { input: 2.0, output: 6.0 }
    }
  },
  [AIVendor.MINIMAX]: { 
    input: 0.5, 
    output: 1.5, 
    defaultModel: 'MiniMax-Text-01',
    models: {
      'MiniMax-Text-01': { input: 0.5, output: 1.5 }
    }
  },
  [AIVendor.VOLCENGINE]: { 
    input: 1.5, 
    output: 4.5, 
    defaultModel: 'doubao-pro-32k',
    models: {
      'doubao-pro-32k': { input: 1.5, output: 4.5 }
    }
  },
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
          const modelPricing = (defaultPricing.models as Record<string, { input: number; output: number }>)?.[modelId] || { 
            input: defaultPricing.input, 
            output: defaultPricing.output 
          }
          inputPricePerMTokens = modelPricing.input
          outputPricePerMTokens = modelPricing.output
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
            const modelPricing = (defaultPricing.models as Record<string, { input: number; output: number }>)?.[modelId] || { 
              input: defaultPricing.input, 
              output: defaultPricing.output 
            }
            inputPricePerMTokens = modelPricing.input
            outputPricePerMTokens = modelPricing.output
          }
        }
      }
    }
    
    // 计算预估 tokens
    // 考虑完整的 Agent 流水线（planner → writer → polisher → validator → summarizer）
    const wordsPerAgent = wordsPerChapter * 1.2 // 每个 Agent 处理会有一些额外内容
    
    // Planner Agent
    const plannerInputTokens = Math.round(wordsPerAgent * avgTokensPerWord * 2 * chapterCount)
    const plannerOutputTokens = Math.round(wordsPerAgent * avgTokensPerWord * 0.3 * chapterCount) // 大纲较短
    
    // Writer Agent (主要生成内容)
    const writerInputTokens = Math.round(wordsPerAgent * avgTokensPerWord * 2 * chapterCount)
    const writerOutputTokens = Math.round(wordsPerAgent * avgTokensPerWord * chapterCount)
    
    // Polisher Agent
    const polisherInputTokens = Math.round(wordsPerAgent * avgTokensPerWord * 2 * chapterCount)
    const polisherOutputTokens = Math.round(wordsPerAgent * avgTokensPerWord * chapterCount)
    
    // Validator Agent
    const validatorInputTokens = Math.round(wordsPerAgent * avgTokensPerWord * 2 * chapterCount)
    const validatorOutputTokens = Math.round(wordsPerAgent * avgTokensPerWord * 0.2 * chapterCount) // 验证报告较短
    
    // Summarizer Agent
    const summarizerInputTokens = Math.round(wordsPerAgent * avgTokensPerWord * 2 * chapterCount)
    const summarizerOutputTokens = Math.round(wordsPerAgent * avgTokensPerWord * 0.2 * chapterCount) // 摘要较短
    
    const estimatedInputTokens = plannerInputTokens + writerInputTokens + polisherInputTokens + validatorInputTokens + summarizerInputTokens
    const estimatedOutputTokens = plannerOutputTokens + writerOutputTokens + polisherOutputTokens + validatorOutputTokens + summarizerOutputTokens
    
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
