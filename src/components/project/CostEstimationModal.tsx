'use client'

import { useState, useEffect } from 'react'
import { Button, Modal, Card, CardContent } from '@/components/ui'
import { DollarSign, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react'

interface CostEstimation {
  estimatedInputTokens: number
  estimatedOutputTokens: number
  estimatedCost: number
  modelId: string
  chapterCount: number
  quotaRemaining?: number
  quotaUsed?: number
  willExceedQuota?: boolean
}

interface CostEstimationModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  projectId: number
  chapterCount: number
  targetWordCount?: number
  loading?: boolean
}

export function CostEstimationModal({ 
  open, 
  onClose, 
  onConfirm, 
  projectId, 
  chapterCount, 
  targetWordCount = 3000,
  loading = false 
}: CostEstimationModalProps) {
  const [estimation, setEstimation] = useState<CostEstimation | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)

  // 预估成本
  const calculateEstimation = async () => {
    setIsCalculating(true)
    try {
      // 调用 API 获取预估信息
      const res = await fetch(`/api/novel/cost/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          chapterCount,
          targetWordCount
        })
      })
      
      const data = await res.json()
      if (data.success) {
        setEstimation(data.data)
      } else {
        // 失败时使用简单估算
        setEstimation(fallbackEstimation(chapterCount, targetWordCount))
      }
    } catch (error) {
      console.error('计算预估失败:', error)
      setEstimation(fallbackEstimation(chapterCount, targetWordCount))
    } finally {
      setIsCalculating(false)
    }
  }

  // 简单的后备估算
  const fallbackEstimation = (chapters: number, words: number): CostEstimation => {
    const avgTokensPerWord = 1.5
    const estimatedOutputTokens = Math.round(words * avgTokensPerWord * chapters)
    const estimatedInputTokens = estimatedOutputTokens * 2 // 输入约为输出的2倍
    // 使用 DeepSeek 默认价格计算：每百万输入 token 1.0 元，输出 2.0 元
    const estimatedCost = (estimatedInputTokens / 1000000 * 1.0) + (estimatedOutputTokens / 1000000 * 2.0)
    
    return {
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedCost,
      modelId: 'deepseek-chat',
      chapterCount: chapters
    }
  }

  useEffect(() => {
    if (open) {
      calculateEstimation()
    }
  }, [open, projectId, chapterCount, targetWordCount])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-blue-500" />
          <span>成本预估与确认</span>
        </div>
      }
      className="max-w-md"
    >
      <div className="space-y-4">
        {isCalculating ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3" />
            <p className="text-gray-500">正在计算预估...</p>
          </div>
        ) : estimation ? (
          <>
            <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">预估章节数</span>
                    <span className="font-medium">{chapterCount} 章</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">目标字数</span>
                    <span className="font-medium">{targetWordCount} 字/章</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">使用模型</span>
                    <span className="font-medium">{estimation.modelId}</span>
                  </div>
                  
                  <div className="border-t border-dashed pt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">预估输入 tokens</span>
                      <span className="font-medium">{estimation.estimatedInputTokens.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">预估输出 tokens</span>
                      <span className="font-medium">{estimation.estimatedOutputTokens.toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <div className="border-t border-dashed pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-base font-semibold text-gray-700 dark:text-gray-300">预估总费用</span>
                      <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        ¥{estimation.estimatedCost.toFixed(4)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      包含 5 个 Agent 调用：策划 → 写作 → 润色 → 校验 → 摘要
                    </p>
                  </div>
                  
                  {estimation.willExceedQuota ? (
                    <div className="flex items-start gap-2 mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-300">
                      <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">配额警告</p>
                        <p className="text-sm">本次生成可能会超出您的月度配额。已使用 ¥{estimation.quotaUsed?.toFixed(2) || '0.00'} / 剩余 ¥{estimation.quotaRemaining?.toFixed(2) || '50.00'}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-300">
                      <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">配额充足</p>
                        <p className="text-sm">已使用 ¥{estimation.quotaUsed?.toFixed(2) || '0.00'} / 剩余 ¥{estimation.quotaRemaining?.toFixed(2) || '50.00'}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <p className="text-xs text-gray-500 dark:text-gray-400">
              注：以上预估为基于 Agent 流水线的估算，实际成本可能因内容复杂度有所不同。价格以百万 tokens 为单位（输入/输出分别计费）。
            </p>
          </>
        ) : null}

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isCalculating || loading}>
            取消
          </Button>
          <Button 
            variant="primary" 
            onClick={onConfirm} 
            loading={loading || isCalculating}
            disabled={isCalculating}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            {isCalculating ? '计算中' : '确认生成'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
