'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, CardHeader, CardTitle, CardContent, toast } from '@/components/ui'
import { BookOpen, Sparkles, FileText, CheckCircle, Upload, File, Loader2 } from 'lucide-react'
import { BookAnalysisPanel } from '@/components/ai'

type WizardStep = 'upload' | 'uploading' | 'extracting' | 'analyzing' | 'complete'

export function AnalyzeWizard({ onCancel }: { onCancel?: () => void }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<WizardStep>('upload')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [projectId, setProjectId] = useState<number | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [analysisCount, setAnalysisCount] = useState(0)
  const [extractionResult, setExtractionResult] = useState<{
    title?: string
    genre?: string
    writingStyle?: string
    sourceName?: string
    wordCount?: number
    chapterCount?: number
  } | null>(null)

  // 拖拽处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }, [])

  const handleFileSelect = useCallback((file: File) => {
    const validTypes = ['text/plain', 'application/epub+zip']
    const validExtensions = ['.txt', '.epub']
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))

    if (!validTypes.includes(file.type) && !validExtensions.includes(extension)) {
      setError('请上传 .txt 或 .epub 格式的文件')
      return
    }

    if (file.size > 100 * 1024 * 1024) {
      setError('文件大小不能超过 100MB')
      return
    }

    setSelectedFile(file)
    setError('')
  }, [])

  const handleStartAnalyze = async () => {
    if (!selectedFile) return

    setSubmitting(true)
    setStep('uploading')
    setStatusMessage('正在上传文件...')
    setError('')

    try {
      // 1. 上传文件并自动创建项目
      const formData = new FormData()
      formData.append('file', selectedFile)

      const uploadRes = await fetch('/api/novel/projects/analyze-mode/upload', {
        method: 'POST',
        body: formData,
      })

      const uploadData = await uploadRes.json()
      if (!uploadData.success) {
        setError(uploadData.error?.message || '文件上传失败')
        setStep('upload')
        return
      }

      const newProjectId = uploadData.data.projectId
      setProjectId(newProjectId)
      setStatusMessage('正在提取书籍元数据...')
      setStep('extracting')

      // 2. AI 提取元数据（标题、类型、风格等）
      const extractRes = await fetch('/api/novel/ai/extract-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: newProjectId }),
      })

      const extractData = await extractRes.json()
      if (extractData.success) {
        setExtractionResult(extractData.data)
      }

      setStatusMessage('正在深度分析小说结构...')
      setStep('analyzing')

      // 3. 执行多维度分析
      const analyzeRes = await fetch('/api/novel/ai/analyze-plot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: newProjectId,
          volumeNumber: -1,
          dimensions: [
            'CHARACTER_RELATION',
            'PLOT_LINE',
            'FORESHADOWING',
            'CHAPTER_STRUCTURE',
            'WORLD_SETTING',
          ],
          contextChapterCount: 3,
        }),
      })

      const analyzeData = await analyzeRes.json()
      if (analyzeData.success) {
        setAnalysisCount(analyzeData.data.results.length)
      } else {
        setError(analyzeData.error?.message || '分析失败')
      }

      setStatusMessage('正在构建 RAG 索引...')

      // 4. 触发 RAG 索引重建
      await fetch(`/api/novel/projects/${newProjectId}/rag/rebuild`, {
        method: 'POST',
      }).catch(() => {
        // RAG 重建可能失败但不影响主流程
        console.warn('RAG 索引重建失败')
      })

      // 5. 自动提取角色档案
      await fetch('/api/novel/ai/extract-characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: newProjectId }),
      }).catch(() => {
        console.warn('角色提取失败')
      })

      setStep('complete')
    } catch (err) {
      console.error('Error:', err)
      setError('操作失败，请重试')
      setStep('upload')
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoToProject = () => {
    if (projectId) {
      router.push(`/projects/${projectId}`)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const steps = [
    { key: 'upload', label: '上传文件' },
    { key: 'extracting', label: '提取信息' },
    { key: 'analyzing', label: 'AI 分析' },
    { key: 'complete', label: '完成' },
  ]

  const currentStepIndex = steps.findIndex(s => s.key === step)

  return (
    <div className="space-y-6">
      {/* 步骤指示器 */}
      <div className="flex items-center justify-center gap-2">
        {steps.map((s, index) => (
          <div key={s.key} className="flex items-center">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                index < currentStepIndex
                  ? 'bg-green-500 text-white'
                  : index === currentStepIndex
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
              }`}
            >
              {index < currentStepIndex ? <CheckCircle className="w-5 h-5" /> : index + 1}
            </div>
            <span className={`ml-2 text-sm transition-colors ${
              index <= currentStepIndex ? 'text-gray-900 dark:text-white' : 'text-gray-400'
            }`}>
              {s.label}
            </span>
            {index < steps.length - 1 && (
              <div className={`w-8 h-0.5 mx-2 transition-colors ${
                index < currentStepIndex ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: 上传文件 */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div className="text-center mb-6">
            <h3 className="text-lg font-medium">导入小说</h3>
            <p className="text-sm text-gray-500 mt-1">
              AI 将自动识别小说信息并分析人物关系、剧情线、伏笔等结构
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.epub,text/plain,application/epub+zip"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileSelect(file)
            }}
          />

          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-150 cursor-pointer ${
              isDragging
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.02]'
                : selectedFile
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <File className="w-10 h-10 text-green-500" />
                <div className="text-left">
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
                </div>
              </div>
            ) : (
              <div>
                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600 dark:text-gray-300">
                  拖拽文件到此处，或点击选择文件
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  支持 .txt, .epub 格式，最大 100MB
                </p>
              </div>
            )}
          </div>

          {selectedFile && (
            <div className="text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  fileInputRef.current?.click()
                }}
              >
                更换文件
              </Button>
            </div>
          )}

          <div className="flex justify-between gap-3 pt-4">
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                取消
              </Button>
            )}
            {!onCancel && <div />}
            <Button
              onClick={handleStartAnalyze}
              disabled={!selectedFile || submitting}
              loading={submitting}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {submitting ? '处理中...' : '开始分析'}
            </Button>
          </div>
        </div>
      )}

      {/* 处理中状态 */}
      {step === 'uploading' && (
        <div className="text-center py-12">
          <Loader2 className="w-12 h-12 mx-auto text-blue-500 animate-spin mb-4" />
          <h3 className="text-lg font-medium mb-2">正在上传文件...</h3>
          <p className="text-sm text-gray-500">大文件可能需要较长时间，请耐心等待</p>
        </div>
      )}

      {step === 'extracting' && (
        <div className="text-center py-12">
          <Loader2 className="w-12 h-12 mx-auto text-purple-500 animate-spin mb-4" />
          <h3 className="text-lg font-medium mb-2">AI 正在提取书籍信息...</h3>
          <p className="text-sm text-gray-500">正在自动识别标题、类型、写作风格等信息</p>
        </div>
      )}

      {step === 'analyzing' && (
        <div className="text-center py-12">
          <Loader2 className="w-12 h-12 mx-auto text-orange-500 animate-spin mb-4" />
          <h3 className="text-lg font-medium mb-2">AI 正在深度分析...</h3>
          <p className="text-sm text-gray-500">正在分析人物关系、剧情线、伏笔等结构，请稍候</p>
        </div>
      )}

      {/* Step: 完成 - 展示多维度信息 */}
      {step === 'complete' && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-lg font-medium mb-1">分析完成！</h3>
            <p className="text-sm text-gray-500">
              已成功分析 {analysisCount} 个维度的内容
            </p>
          </div>

          {/* 提取的元数据 */}
          {extractionResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-500" />
                  自动识别信息
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500 mb-1">小说标题</div>
                    <div className="font-medium">{extractionResult.title || selectedFile?.name}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">小说类型</div>
                    <div className="font-medium">{extractionResult.genre || '未识别'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">写作风格</div>
                    <div className="font-medium">{extractionResult.writingStyle || '未识别'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">总字数</div>
                    <div className="font-medium">
                      {extractionResult.wordCount ? `${(extractionResult.wordCount / 10000).toFixed(1)}万字` : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">章节数</div>
                    <div className="font-medium">{extractionResult.chapterCount || '-'} 章</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 多维度分析结果 */}
          {projectId && (
            <BookAnalysisPanel projectId={projectId} />
          )}

          <div className="flex justify-center gap-3 pt-4">
            <Button variant="outline" onClick={onCancel}>
              返回列表
            </Button>
            <Button onClick={handleGoToProject}>
              <BookOpen className="w-4 h-4 mr-2" />
              查看小说详情
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
