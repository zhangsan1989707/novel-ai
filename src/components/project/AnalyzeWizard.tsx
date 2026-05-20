'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input, Select } from '@/components/ui'
import { BookOpen, Sparkles, FileText, CheckCircle, ArrowLeft, ArrowRight, Upload, File } from 'lucide-react'
import { AnalysisDimension } from '@/types'
import { genreOptions, writingStyleOptions } from './ProjectForm'

interface AnalyzeWizardProps {
  onCancel?: () => void
}

type WizardStep = 'info' | 'upload' | 'uploading' | 'analyzing' | 'complete'

interface AnalysisResult {
  dimension: AnalysisDimension
  data: Record<string, unknown>
}

export function AnalyzeWizard({ onCancel }: AnalyzeWizardProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<WizardStep>('info')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Step 1: 基本信息
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('')
  const [writingStyle, setWritingStyle] = useState('')
  const [sourceName, setSourceName] = useState('')

  // Step 2: 文件上传
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Step 3: 分析中
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeProgress, setAnalyzeProgress] = useState('')
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([])

  // Step 4: 完成
  const [projectId, setProjectId] = useState<number | null>(null)

  const canProceedToUpload = title.trim().length > 0
  const canProceedToAnalyze = selectedFile !== null

  // 处理文件选择
  const handleFileSelect = useCallback((file: File) => {
    const validTypes = ['text/plain', 'application/epub+zip']
    const validExtensions = ['.txt', '.epub']
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))

    if (!validTypes.includes(file.type) && !validExtensions.includes(extension)) {
      setError('请上传 .txt 或 .epub 格式的文件')
      return
    }

    // 限制文件大小 100MB
    if (file.size > 100 * 1024 * 1024) {
      setError('文件大小不能超过 100MB')
      return
    }

    setSelectedFile(file)
    setError('')
  }, [])

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
  }, [handleFileSelect])

  // 创建小说并上传文件
  const handleCreateAndAnalyze = async () => {
    if (!selectedFile) return

    setSubmitting(true)
    setStep('uploading')
    setError('')

    try {
      // 1. 先创建小说获取 ID
      const createRes = await fetch('/api/novel/projects/analyze-mode', {
        method: 'POST',
        headers: { 'Content-Type': "application/json" },
        body: JSON.stringify({
          title,
          genre: genre || undefined,
          writingStyle: writingStyle || undefined,
          sourceName: sourceName || undefined,
        }),
      })

      const createData = await createRes.json()
      if (!createData.success) {
        setError(createData.error?.message || '创建小说失败')
        setStep('upload')
        return
      }

      const newProjectId = createData.data.id
      setProjectId(newProjectId)

      // 2. 上传文件
      setStep('uploading')
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('projectId', String(newProjectId))

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

      // 3. 执行分段分析
      setStep('analyzing')
      setAnalyzing(true)

      const analyzeRes = await fetch('/api/novel/ai/analyze-plot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: newProjectId,
          volumeNumber: -1,
          dimensions: [
            AnalysisDimension.CHARACTER_RELATION,
            AnalysisDimension.PLOT_LINE,
            AnalysisDimension.FORESHADOWING,
            AnalysisDimension.CHAPTER_STRUCTURE,
            AnalysisDimension.WORLD_SETTING,
          ],
          contextChapterCount: 3,
        }),
      })

      const analyzeData = await analyzeRes.json()
      if (analyzeData.success) {
        setAnalysisResults(analyzeData.data.results)
      } else {
        setError(analyzeData.error?.message || '分析失败')
      }

      setAnalyzing(false)
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

  const stepIndicators = [
    { key: 'info', label: '基本信息' },
    { key: 'upload', label: '上传文件' },
    { key: 'analyzing', label: 'AI 分析' },
    { key: 'complete', label: '完成' },
  ]

  const currentStepIndex = stepIndicators.findIndex(s => s.key === step)

  return (
    <div className="space-y-6">
      {/* 步骤指示器 */}
      <div className="flex items-center justify-center gap-2">
        {stepIndicators.map((indicator, index) => (
          <div key={indicator.key} className="flex items-center">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                index < currentStepIndex
                  ? 'bg-green-500 text-white'
                  : index === currentStepIndex
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {index < currentStepIndex ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                index + 1
              )}
            </div>
            <span className={`ml-2 text-sm ${
              index <= currentStepIndex ? 'text-gray-900 dark:text-white' : 'text-gray-400'
            }`}>
              {indicator.label}
            </span>
            {index < stepIndicators.length - 1 && (
              <div className={`w-8 h-0.5 mx-2 ${
                index < currentStepIndex ? 'bg-green-500' : 'bg-gray-200'
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

      {/* Step 1: 基本信息 */}
      {step === 'info' && (
        <div className="space-y-4">
          <div className="text-center mb-6">
            <h3 className="text-lg font-medium">拆解小说</h3>
            <p className="text-sm text-gray-500 mt-1">
              导入小说文件，AI 将分析人物关系、剧情线、伏笔等结构
            </p>
          </div>

          <Input
            label="小说标题"
            placeholder="给这个拆解小说起个名字"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <Input
            label="原著名称（可选）"
            placeholder="如《斗破苍穹》《全职高手》"
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="类型（可选）"
              options={genreOptions}
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              placeholder="选择类型"
            />
            <Select
              label="写作风格（可选）"
              options={writingStyleOptions}
              value={writingStyle}
              onChange={(e) => setWritingStyle(e.target.value)}
              placeholder="选择风格"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                取消
              </Button>
            )}
            <Button
              onClick={() => setStep('upload')}
              disabled={!canProceedToUpload}
            >
              下一步
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: 上传文件 */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div className="text-center mb-6">
            <h3 className="text-lg font-medium">上传小说文件</h3>
            <p className="text-sm text-gray-500 mt-1">
              支持 .txt 和 .epub 格式，文件大小不超过 100MB
            </p>
          </div>

          {/* 隐藏的文件输入 */}
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

          {/* 拖拽区域 */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-150 cursor-pointer ${
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
                  支持 .txt, .epub 格式
                </p>
              </div>
            )}
          </div>

          {/* 替换文件按钮 */}
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
            <Button variant="outline" onClick={() => setStep('info')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              上一步
            </Button>
            <Button
              onClick={handleCreateAndAnalyze}
              disabled={!canProceedToAnalyze || submitting}
              loading={submitting}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {submitting ? '上传并分析中...' : '上传并分析'}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: 上传/分析中 */}
      {(step === 'uploading' || (step === 'analyzing' && analyzing)) && (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
            <Sparkles className="w-8 h-8 text-blue-500 animate-pulse" />
          </div>
          <h3 className="text-lg font-medium mb-2">
            {step === 'uploading' ? '正在上传文件...' : 'AI 正在分析中...'}
          </h3>
          <p className="text-sm text-gray-500">
            {step === 'uploading'
              ? '大文件可能需要较长时间，请耐心等待'
              : '正在分析人物关系、剧情线、伏笔等结构，请稍候'}
          </p>
        </div>
      )}

      {/* Step 4: 完成 */}
      {step === 'complete' && (
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h3 className="text-lg font-medium mb-2">拆解完成！</h3>
          <p className="text-sm text-gray-500 mb-6">
            已成功分析 {analysisResults.length} 个维度的内容
          </p>

          <div className="flex justify-center gap-3">
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
