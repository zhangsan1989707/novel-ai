'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button, Input, Card, CardContent, Badge, Progress, Modal } from '@/components/ui'
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Settings,
  RefreshCw,
  PieChart,
  Calendar,
  Target,
  Zap,
} from 'lucide-react'
import { AIVendor } from '@/types'

interface CostData {
  quota: QuotaStatus
  usage: UsageData
  pricings: Pricing[]
}

interface QuotaStatus {
  quota: {
    monthlyLimit: number
    alertThreshold: number
    isLocked: boolean
  }
  usage: {
    totalTokens: number
    totalCost: number
  }
  usagePercent: number
  isOverLimit: boolean
  isWarning: boolean
  remaining: number
}

interface UsageData {
  month: number
  totalTokens: number
  totalCost: number
  byProject: Record<number, { tokens: number; cost: number }>
  usageCount: number
}

interface Pricing {
  id: number
  vendor: AIVendor
  modelId: string
  inputPrice: number | string
  outputPrice: number | string
  currency: string
}

const vendorLabels: Record<AIVendor, string> = {
  [AIVendor.OPENAI]: 'OpenAI',
  [AIVendor.ANTHROPIC]: 'Anthropic',
  [AIVendor.ALIBABA]: '阿里云',
  [AIVendor.DEEPSEEK]: 'DeepSeek',
  [AIVendor.MINIMAX]: 'MiniMax',
  [AIVendor.MIMO]: '小米 MiMo',
  [AIVendor.VOLCENGINE]: '火山引擎',
  [AIVendor.ZHIPU]: '智谱 AI',
}

export default function CostPage() {
  const [data, setData] = useState<CostData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [settingsForm, setSettingsForm] = useState({
    monthlyLimit: 50,
    alertThreshold: 80,
  })
  const [savingSettings, setSavingSettings] = useState(false)

  const fetchCostData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/novel/cost')
      const result = await res.json()
      if (result.success) {
        setData(result.data)
        setSettingsForm({
          monthlyLimit: result.data.quota.quota.monthlyLimit,
          alertThreshold: result.data.quota.quota.alertThreshold * 100,
        })
      }
    } catch (error) {
      console.error('获取成本数据失败:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCostData()
  }, [fetchCostData])

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      const res = await fetch('/api/novel/cost', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthlyLimit: settingsForm.monthlyLimit,
          alertThreshold: settingsForm.alertThreshold / 100,
        }),
      })
      const result = await res.json()
      if (result.success) {
        setShowSettingsModal(false)
        fetchCostData()
      }
    } catch (error) {
      console.error('保存设置失败:', error)
    } finally {
      setSavingSettings(false)
    }
  }

  const estimateBookCost = (chapters: number, wordsPerChapter: number) => {
    const avgTokensPerChapter = wordsPerChapter * 1.5
    const estimatedInputTokens = avgTokensPerChapter * 2
    const estimatedOutputTokens = avgTokensPerChapter
    const totalInputTokens = estimatedInputTokens * chapters
    const totalOutputTokens = estimatedOutputTokens * chapters

    const inputPrice = 1.0 / 1000000
    const outputPrice = 2.0 / 1000000

    return (totalInputTokens * inputPrice + totalOutputTokens * outputPrice).toFixed(2)
  }

  return (
    <>
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">成本管理</h1>
          <p className="text-sm text-gray-500">追踪 AI 调用成本和配额</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchCostData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button onClick={() => setShowSettingsModal(true)}>
            <Settings className="h-4 w-4 mr-2" />
            配额设置
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {loading ? (
          <div className="text-center py-12 text-gray-500">加载中...</div>
        ) : data ? (
          <>
            {/* 状态概览卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 本月使用 */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">本月已用</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        ¥{(data.usage.totalCost ?? 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {data.usage.totalTokens.toLocaleString()} tokens
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 剩余配额 */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <Target className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">剩余配额</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        ¥{(data.quota.remaining ?? 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-400">
                        限额 ¥{(data.quota.quota.monthlyLimit ?? 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 使用进度 */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-500">使用率</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {((data.quota.usagePercent ?? 0) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <Progress
                        value={data.quota.usagePercent * 100}
                        max={100}
                        className="h-2"
                        color={
                          data.quota.isOverLimit
                            ? 'danger'
                            : data.quota.isWarning
                            ? 'primary'
                            : 'success'
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 调用次数 */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                      <Zap className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">本月调用</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {data.usage.usageCount}
                      </p>
                      <p className="text-xs text-gray-400">次 AI 调用</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 状态警告 */}
            {(data.quota.isWarning || data.quota.isOverLimit) && (
              <Card
                className={
                  data.quota.isOverLimit
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                    : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                }
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      className={`h-5 w-5 mt-0.5 ${
                        data.quota.isOverLimit ? 'text-red-500' : 'text-yellow-500'
                      }`}
                    />
                    <div>
                      <h3 className="font-medium">
                        {data.quota.isOverLimit ? '配额已用尽' : '配额预警'}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {data.quota.isOverLimit
                          ? '您本月的 AI 调用配额已用尽，新的生成请求将被拒绝。请调整配额设置或等待下月。'
                          : `您已使用了 ${((data.quota.usagePercent ?? 0) * 100).toFixed(
                              1
                            )}% 的配额，请合理控制使用量。`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 成本预估计算器 */}
              <Card>
                <CardContent className="p-4">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    成本预估
                  </h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="预计章节数"
                        type="number"
                        placeholder="50"
                        defaultValue={50}
                        id="chapters-input"
                      />
                      <Input
                        label="每章字数"
                        type="number"
                        placeholder="3000"
                        defaultValue={3000}
                        id="words-input"
                      />
                    </div>
                    <Button
                      onClick={() => {
                        const chaptersInput = document.getElementById(
                          'chapters-input'
                        ) as HTMLInputElement
                        const wordsInput = document.getElementById(
                          'words-input'
                        ) as HTMLInputElement
                        const chapters = parseInt(chaptersInput.value) || 50
                        const words = parseInt(wordsInput.value) || 3000
                        const estimatedCost = estimateBookCost(chapters, words)
                        alert(
                          `预计成本：¥${estimatedCost}\n\n* 此为估算值，实际成本取决于具体内容和模型选择`
                        )
                      }}
                    >
                      计算预估
                    </Button>
                    <p className="text-xs text-gray-500">
                      * 此估算基于默认模型价格，实际成本可能有所不同
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* 模型定价 */}
              <Card>
                <CardContent className="p-4">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    模型定价
                  </h2>
                  <div className="space-y-2">
                    {data.pricings.map((pricing) => (
                      <div
                        key={pricing.id}
                        className="flex items-center justify-between py-2 border-b last:border-0"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{vendorLabels[pricing.vendor]}</Badge>
                            <span className="font-medium text-sm">{pricing.modelId}</span>
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <p>
                            输入: ¥{Number(pricing.inputPrice).toFixed(2)}/M tokens
                          </p>
                          <p className="text-gray-500">
                            输出: ¥{Number(pricing.outputPrice).toFixed(2)}/M tokens
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-500">无法加载成本数据</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 配额设置弹窗 */}
      <Modal
        open={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        title="配额设置"
      >
        <div className="space-y-4">
          <Input
            label="月度配额（元）"
            type="number"
            placeholder="50"
            value={settingsForm.monthlyLimit}
            onChange={(e) =>
              setSettingsForm({ ...settingsForm, monthlyLimit: parseFloat(e.target.value) || 0 })
            }
          />
          <Input
            label="预警阈值（%）"
            type="number"
            placeholder="80"
            min="0"
            max="100"
            value={settingsForm.alertThreshold}
            onChange={(e) =>
              setSettingsForm({ ...settingsForm, alertThreshold: parseFloat(e.target.value) || 80 })
            }
          />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowSettingsModal(false)}>
              取消
            </Button>
            <Button onClick={handleSaveSettings} loading={savingSettings}>
              保存
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
