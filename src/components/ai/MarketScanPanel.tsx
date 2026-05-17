'use client'

import { useState } from 'react'
import { Button, Badge, Card, CardHeader, CardTitle, CardContent, CardDescription, toast } from '@/components/ui'
import { TrendingUp, TrendingDown, Minus, Sparkles, Lightbulb, Loader2, X, Plus } from 'lucide-react'

interface MarketAnalysisResult {
  genre: string
  platform: string
  trendDirection: string
  hotTags: string[]
  readerPreferences: string[]
  competitorAnalysis: string
  recommendations: { genre: string; reason: string; difficulty: string }[]
}

interface GenreRecommendation {
  genre: string
  subGenre: string
  reason: string
  targetAudience: string
  difficulty: 'easy' | 'medium' | 'hard'
  marketSaturation: 'low' | 'medium' | 'high'
}

const PLATFORMS = [
  { value: 'qidian', label: '起点中文网' },
  { value: 'tomato', label: '番茄小说' },
  { value: 'jinjiang', label: '晋江文学城' },
  { value: 'qimao', label: '七猫小说' },
  { value: 'ciweimao', label: '刺猬猫' },
]

const GENRES = [
  { value: '玄幻', label: '玄幻' },
  { value: '奇幻', label: '奇幻' },
  { value: '仙侠', label: '仙侠' },
  { value: '都市', label: '都市' },
  { value: '科幻', label: '科幻' },
  { value: '历史', label: '历史' },
  { value: '军事', label: '军事' },
  { value: '游戏', label: '游戏' },
  { value: '悬疑', label: '悬疑' },
  { value: '言情', label: '言情' },
  { value: '轻小说', label: '轻小说' },
  { value: '体育', label: '体育' },
]

const AUDIENCES = [
  { value: 'MALE', label: '男频' },
  { value: 'FEMALE', label: '女频' },
]

const TREND_ICONS = {
  rising: TrendingUp,
  stable: Minus,
  declining: TrendingDown,
}

const TREND_LABELS: Record<string, string> = {
  rising: '上升',
  stable: '稳定',
  declining: '下降',
}

const TREND_COLORS: Record<string, string> = {
  rising: 'text-green-600 dark:text-green-400',
  stable: 'text-yellow-600 dark:text-yellow-400',
  declining: 'text-red-600 dark:text-red-400',
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: '容易',
  medium: '中等',
  hard: '困难',
}

const DIFFICULTY_VARIANTS: Record<string, 'success' | 'warning' | 'danger'> = {
  easy: 'success',
  medium: 'warning',
  hard: 'danger',
}

const SATURATION_LABELS: Record<string, string> = {
  low: '蓝海',
  medium: '适中',
  high: '红海',
}

const SATURATION_VARIANTS: Record<string, 'success' | 'warning' | 'danger'> = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
}

export function MarketScanPanel() {
  const [platform, setPlatform] = useState('qidian')
  const [genre, setGenre] = useState('玄幻')
  const [targetAudience, setTargetAudience] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<MarketAnalysisResult | null>(null)

  const [userStrengths, setUserStrengths] = useState<string[]>([''])
  const [preferredGenres, setPreferredGenres] = useState<string[]>(['玄幻'])
  const [recommendPlatform, setRecommendPlatform] = useState('qidian')
  const [recommending, setRecommending] = useState(false)
  const [recommendations, setRecommendations] = useState<GenreRecommendation[]>([])

  const [activeTab, setActiveTab] = useState<'analysis' | 'recommend'>('analysis')

  const handleAnalyze = async () => {
    setAnalyzing(true)
    setAnalysisResult(null)
    try {
      const res = await fetch('/api/market/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genre,
          platform,
          targetAudience: targetAudience || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        const raw = data.data
        setAnalysisResult({
          ...raw,
          hotTags: Array.isArray(raw?.hotTags) ? raw.hotTags : [],
          readerPreferences: Array.isArray(raw?.readerPreferences) ? raw.readerPreferences : [],
          recommendations: Array.isArray(raw?.recommendations) ? raw.recommendations : [],
        })
      } else {
        toast.error(data.error?.message || '分析失败')
      }
    } catch {
      toast.error('分析失败，请稍后重试')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleRecommend = async () => {
    const validStrengths = userStrengths.filter((s) => s.trim())
    if (validStrengths.length === 0) {
      toast.error('请至少输入一个作者优势')
      return
    }
    if (preferredGenres.length === 0) {
      toast.error('请至少选择一个偏好题材')
      return
    }

    setRecommending(true)
    setRecommendations([])
    try {
      const res = await fetch('/api/market/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userStrengths: validStrengths,
          targetPlatform: recommendPlatform,
          preferredGenres,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setRecommendations(Array.isArray(data.data) ? data.data : [])
      } else {
        toast.error(data.error?.message || '推荐失败')
      }
    } catch {
      toast.error('推荐失败，请稍后重试')
    } finally {
      setRecommending(false)
    }
  }

  const addStrength = () => {
    setUserStrengths([...userStrengths, ''])
  }

  const removeStrength = (index: number) => {
    setUserStrengths(userStrengths.filter((_, i) => i !== index))
  }

  const updateStrength = (index: number, value: string) => {
    const updated = [...userStrengths]
    updated[index] = value
    setUserStrengths(updated)
  }

  const togglePreferredGenre = (g: string) => {
    setPreferredGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    )
  }

  const TrendIcon = analysisResult
    ? TREND_ICONS[analysisResult.trendDirection as keyof typeof TREND_ICONS] || Minus
    : Minus

  return (
    <div className="space-y-6">
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'analysis'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('analysis')}
        >
          <TrendingUp className="h-4 w-4 inline-block mr-1.5" />
          市场趋势分析
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'recommend'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('recommend')}
        >
          <Lightbulb className="h-4 w-4 inline-block mr-1.5" />
          题材推荐
        </button>
      </div>

      {activeTab === 'analysis' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>市场趋势分析</CardTitle>
              <CardDescription>选择平台和题材，AI 将分析当前市场趋势并给出选题建议</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      平台
                    </label>
                    <select
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                    >
                      {PLATFORMS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      题材
                    </label>
                    <select
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                    >
                      {GENRES.map((g) => (
                        <option key={g.value} value={g.value}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      目标受众
                    </label>
                    <select
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                    >
                      <option value="">不限</option>
                      {AUDIENCES.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleAnalyze} loading={analyzing} variant="primary">
                    <Sparkles className="h-4 w-4 mr-2" />
                    开始分析
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {analyzing && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
              <span className="ml-3 text-gray-600 dark:text-gray-400">AI 正在分析市场趋势...</span>
            </div>
          )}

          {analysisResult && !analyzing && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>趋势概览</CardTitle>
                    <div className="flex items-center gap-2">
                      <TrendIcon className={`h-5 w-5 ${TREND_COLORS[analysisResult.trendDirection] || ''}`} />
                      <span className={`font-semibold ${TREND_COLORS[analysisResult.trendDirection] || ''}`}>
                        {TREND_LABELS[analysisResult.trendDirection] || '未知'}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">热门标签</h4>
                      <div className="flex flex-wrap gap-2">
                        {analysisResult.hotTags.map((tag, i) => (
                          <Badge key={i} variant="primary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">读者偏好</h4>
                      <ul className="space-y-1">
                        {analysisResult.readerPreferences.map((pref, i) => (
                          <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                            <span className="text-blue-500 mt-0.5">•</span>
                            {pref}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {analysisResult.competitorAnalysis && (
                <Card>
                  <CardHeader>
                    <CardTitle>竞品分析</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                      {analysisResult.competitorAnalysis}
                    </p>
                  </CardContent>
                </Card>
              )}

              {analysisResult.recommendations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>选题建议</CardTitle>
                    <CardDescription>基于市场分析生成的选题方向</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analysisResult.recommendations.map((rec, i) => (
                        <div
                          key={i}
                          className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900 dark:text-white">{rec.genre}</h4>
                            <Badge variant={DIFFICULTY_VARIANTS[rec.difficulty] || 'default'}>
                              {DIFFICULTY_LABELS[rec.difficulty] || rec.difficulty}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{rec.reason}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'recommend' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>题材推荐</CardTitle>
              <CardDescription>输入你的优势和偏好，AI 将推荐最适合的题材方向</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    你的优势
                  </label>
                  <div className="space-y-2">
                    {userStrengths.map((strength, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={strength}
                          onChange={(e) => updateStrength(index, e.target.value)}
                          placeholder={`优势 ${index + 1}，如：擅长写热血战斗场面`}
                          className="flex-1 h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                        />
                        {userStrengths.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeStrength(index)}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {userStrengths.length < 5 && (
                      <button
                        type="button"
                        onClick={addStrength}
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        <Plus className="h-4 w-4" />
                        添加优势
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    目标平台
                  </label>
                  <select
                    value={recommendPlatform}
                    onChange={(e) => setRecommendPlatform(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    偏好题材
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {GENRES.map((g) => (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => togglePreferredGenre(g.value)}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                          preferredGenres.includes(g.value)
                            ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-400'
                            : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleRecommend} loading={recommending} variant="primary">
                    <Lightbulb className="h-4 w-4 mr-2" />
                    获取推荐
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {recommending && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
              <span className="ml-3 text-gray-600 dark:text-gray-400">AI 正在生成推荐...</span>
            </div>
          )}

          {recommendations.length > 0 && !recommending && (
            <div className="space-y-4">
              {recommendations.map((rec, i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {rec.genre}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{rec.subGenre}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={DIFFICULTY_VARIANTS[rec.difficulty] || 'default'}>
                            难度: {DIFFICULTY_LABELS[rec.difficulty] || rec.difficulty}
                          </Badge>
                          <Badge variant={SATURATION_VARIANTS[rec.marketSaturation] || 'default'}>
                            市场: {SATURATION_LABELS[rec.marketSaturation] || rec.marketSaturation}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{rec.reason}</p>
                      <div className="text-sm text-gray-500 dark:text-gray-500">
                        <span className="font-medium">目标读者：</span>
                        {rec.targetAudience}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
