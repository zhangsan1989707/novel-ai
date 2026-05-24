'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Progress, toast } from '@/components/ui'
import { BookOpen, Sparkles, CheckCircle, Upload, File, Loader2 } from 'lucide-react'
import { BookAnalysisPanel, AnalysisTaskPanel } from '@/components/ai'
import { normalizeChapterReviewItems } from '@/lib/analysis/chapter-utils'

type WizardStep = 'upload' | 'uploading' | 'analyzing' | 'complete'

export function AnalyzeWizard({ onCancel }: { onCancel?: () => void }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<WizardStep>('upload')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [projectId, setProjectId] = useState<number | null>(null)
  const [analysisCount, setAnalysisCount] = useState(0)
  const [charactersCount, setCharactersCount] = useState(0)
  const [flowProgress, setFlowProgress] = useState(0)
  const [flowMessage, setFlowMessage] = useState('准备导入图书')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [taskPollingActive, setTaskPollingActive] = useState(false)
  const [extractedMeta, setExtractedMeta] = useState<{
    title: string
    genre?: string
    writingStyle?: string
    corePitch?: string
    description?: string
    targetWordCount?: number
    chapterWordCount?: number
    totalVolumes?: number
    targetAudience?: 'MALE' | 'FEMALE'
    chapterCount?: number
    worldSetting?: string
    powerSystem?: string
    protagonistProfile?: string
    antagonistSetting?: string
  } | null>(null)

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const readJsonResponse = useCallback(async <T,>(res: Response): Promise<T | null> => {
    const text = await res.text()
    if (!text.trim()) return null
    try {
      return JSON.parse(text) as T
    } catch (error) {
      console.warn('Unexpected non-JSON response:', error)
      return null
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileSelect = (file: File) => {
    const validTypes = ['text/plain', 'application/epub+zip']
    const validExtensions = ['.txt', '.epub']
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))

    if (!validTypes.includes(file.type) && !validExtensions.includes(extension)) {
      toast.error('请上传 .txt 或 .epub 格式的文件')
      return
    }

    if (file.size > 100 * 1024 * 1024) {
      toast.error('文件大小不能超过 100MB')
      return
    }

    setSelectedFile(file)
    setError('')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const handleStartUpload = async () => {
    if (!selectedFile) return

    setSubmitting(true)
    setStep('uploading')
    setFlowProgress(8)
    setFlowMessage('正在上传图书')
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const uploadRes = await fetch('/api/novel/projects/analyze-mode/upload', {
        method: 'POST',
        body: formData,
      })

      const uploadData = await readJsonResponse<{ success: boolean; data?: { projectId: number; chapterCount: number }; error?: { message?: string } }>(uploadRes)
      if (!uploadData) {
        setError('文件上传失败')
        setStep('upload')
        setSubmitting(false)
        return
      }
      if (!uploadData.success) {
        setError(uploadData.error?.message || '文件上传失败')
        setStep('upload')
        setSubmitting(false)
        return
      }
      if (!uploadData.data) {
        setError('文件上传失败')
        setStep('upload')
        setSubmitting(false)
        return
      }
      setFlowProgress(35)
      setFlowMessage('图书已上传，正在提取元数据')

      const newProjectId = uploadData.data.projectId
      setProjectId(newProjectId)

      let resolvedMeta = {
        title: selectedFile.name.replace(/\.(txt|epub)$/i, ''),
        genre: undefined as string | undefined,
        writingStyle: undefined as string | undefined,
        corePitch: undefined as string | undefined,
        description: undefined as string | undefined,
        targetWordCount: undefined as number | undefined,
        chapterWordCount: 3000 as number | undefined,
        totalVolumes: 4 as number | undefined,
        targetAudience: undefined as 'MALE' | 'FEMALE' | undefined,
        chapterCount: uploadData.data.chapterCount,
        worldSetting: undefined as string | undefined,
        powerSystem: undefined as string | undefined,
        protagonistProfile: undefined as string | undefined,
        antagonistSetting: undefined as string | undefined,
      }

      const projectRes = await fetch(`/api/novel/projects/${newProjectId}`)
      const projectData = await readJsonResponse<{ success: boolean; data?: any; error?: { message?: string } }>(projectRes)
      if (projectData?.success && projectData.data) {
        const p = projectData.data
        resolvedMeta = {
          title: p.title || selectedFile.name.replace(/\.(txt|epub)$/i, ''),
          genre: p.genre || undefined,
          writingStyle: p.writingStyle || undefined,
          corePitch: p.corePitch || undefined,
          description: p.description || undefined,
          targetWordCount: p.targetWordCount || undefined,
          chapterWordCount: p.chapterWordCount || 3000,
          totalVolumes: p.totalVolumes || 4,
          targetAudience: p.targetAudience || undefined,
          chapterCount: uploadData.data.chapterCount,
          worldSetting: p.worldSetting || undefined,
          powerSystem: p.powerSystem || undefined,
          protagonistProfile: p.protagonistProfile || undefined,
          antagonistSetting: p.antagonistSetting || undefined,
        }
      }
      setExtractedMeta(resolvedMeta)

      setFlowProgress(55)
      setFlowMessage('正在加载章节切分结果')
      const chapterRes = await fetch(`/api/novel/projects/${newProjectId}/chapters?includeContent=true`)
      const chapterData = await readJsonResponse<{ success: boolean; data?: Array<{ title: string; content?: string }> }>(chapterRes)
      if (!chapterData) {
        throw new Error('无法读取章节内容')
      }
      if (chapterData.success) {
        if (!chapterData.data) {
          throw new Error('无法读取章节内容')
        }
        const normalizedChapters = normalizeChapterReviewItems(
          chapterData.data.map((chapter: { title: string; content?: string }) => ({
            title: chapter.title,
            content: chapter.content || '',
          }))
        )
        setFlowProgress(70)
        setFlowMessage(`已自动识别 ${normalizedChapters.length} 章，正在启动 AI 分析`)
        await startAutoAnalysis(newProjectId, resolvedMeta)
        return
      }
      throw new Error('无法读取章节内容')
    } catch (err) {
      console.error('Error:', err)
      setError('操作失败，请重试')
      setStep('upload')
      setSubmitting(false)
    }
  }

  const startTaskPolling = (tid: string, targetProjectId: number) => {
    setTaskId(tid)
    setTaskPollingActive(true)

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
    }

    pollIntervalRef.current = setInterval(async () => {
      if (!tid) return
      try {
        const res = await fetch(`/api/novel/projects/${targetProjectId}/analysis-task?latest=true`)
        const data = await readJsonResponse<{
          success: boolean
          data?: {
            id: string
            status: string
            totalDimensions?: number
            progress?: number
            errorMessage?: string | null
          } | null
        }>(res)
        if (data?.success && data.data) {
        if (data.data.status === 'COMPLETED') {
          setAnalysisCount(data.data.totalDimensions || 0)
          setFlowProgress(100)
          setFlowMessage('AI 拆书分析完成')
          clearInterval(pollIntervalRef.current!)
          pollIntervalRef.current = null
          setTaskPollingActive(false)
          setStep('complete')
          void postAnalysisTasks(targetProjectId)
        } else if (data.data.status === 'FAILED') {
            setError(data.data.errorMessage || '分析任务失败')
            setFlowMessage('分析失败')
            clearInterval(pollIntervalRef.current!)
            pollIntervalRef.current = null
            setTaskPollingActive(false)
            setStep('analyzing')
          }
        } else if (data?.success && !data.data) {
          // 任务还在创建/切换过程中，继续轮询 latest 直到拿到任务
          return
        }
      } catch (err) {
        console.error('Poll error:', err)
      }
    }, 2000)
  }

  const postAnalysisTasks = async (targetProjectId: number) => {
    if (!targetProjectId) return

    try {
      // RAG 索引重建
      await fetch(`/api/novel/projects/${targetProjectId}/rag/rebuild`, {
        method: 'POST',
      }).catch(() => {
        console.warn('RAG 索引重建失败')
      })

      // 提取角色档案
      const charRes = await fetch('/api/novel/ai/extract-characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: targetProjectId }),
      }).catch(() => null)

      if (charRes) {
        const charData = await readJsonResponse<{ success: boolean; data?: { charactersCreated?: number } }>(charRes)
        if (charData?.success && charData.data) {
          setCharactersCount(charData.data.charactersCreated || 0)
        }
      }
    } catch (err) {
      console.warn('后处理任务执行失败:', err)
    }
  }

  const startAutoAnalysis = useCallback(async (
    targetProjectId: number,
    meta: NonNullable<typeof extractedMeta>,
  ) => {
    setProjectId(targetProjectId)
    setStep('analyzing')
    setFlowProgress(78)
    setFlowMessage('正在保存 AI 识别结果')

    try {
      setFlowProgress(84)
      setFlowMessage('正在保存项目设定')
      const updateRes = await fetch(`/api/novel/projects/${targetProjectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: meta.title,
          description: meta.description,
          genre: meta.genre,
          writingStyle: meta.writingStyle,
          targetWordCount: meta.targetWordCount,
          chapterWordCount: meta.chapterWordCount,
          totalVolumes: meta.totalVolumes,
          targetAudience: meta.targetAudience,
          worldSetting: meta.worldSetting,
          powerSystem: meta.powerSystem,
          protagonistProfile: meta.protagonistProfile,
          antagonistSetting: meta.antagonistSetting,
        }),
      })

      const updateData = await readJsonResponse<{ success: boolean; error?: { message?: string } }>(updateRes)
      if (!updateData) {
        throw new Error('项目设定保存失败')
      }
      if (!updateData.success) {
        console.warn('Project update failed:', updateData.error)
      }

      setFlowProgress(90)
      setFlowMessage('正在启动拆书分析任务')
      // 使用异步任务 API
      const res = await fetch(`/api/novel/projects/${targetProjectId}/analysis-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          volumeNumber: -1,
          dimensions: [
            'STORY_OVERVIEW',
            'CHARACTER_RELATION',
            'CHARACTER_ARC',
            'PLOT_LINE',
            'FORESHADOWING',
            'CHAPTER_STRUCTURE',
            'READING_EXPERIENCE',
            'WORLD_SETTING',
          ],
          contextChapterCount: 3,
        }),
      })

      const data = await readJsonResponse<{ success: boolean; data?: { task: { status: string; totalDimensions?: number; progress?: number; id: string } }; error?: { message?: string } }>(res)
      if (!data) {
        setError('创建分析任务失败')
        setStep('upload')
        return
      }
      if (data.success) {
        if (!data.data?.task) {
          setError('创建分析任务失败')
          setStep('upload')
          return
        }
        if (data.data.task.status === 'COMPLETED') {
          // 已有完成的任务（复用）
          setAnalysisCount(data.data.task.totalDimensions || 0)
          setFlowProgress(100)
          setFlowMessage('分析已完成')
          setStep('complete')
          void postAnalysisTasks(targetProjectId)
        } else {
          // 开始轮询任务状态
          setFlowProgress(Math.max(92, data.data.task.progress || 0))
          setFlowMessage('AI 正在拆书分析')
          startTaskPolling(data.data.task.id, targetProjectId)
        }
      } else {
        setError(data.error?.message || '创建分析任务失败')
        setStep('upload')
      }
    } catch (err) {
      console.error('Error:', err)
      setError('分析处理失败，请重试')
      setStep('upload')
    } finally {
      setSubmitting(false)
    }
  }, [postAnalysisTasks])

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [])

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

      {/* Step: 上传文件 */}
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
              onClick={handleStartUpload}
              disabled={!selectedFile || submitting}
              loading={submitting}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              上传并识别
            </Button>
          </div>
        </div>
      )}

      {/* Step: 上传中 */}
      {step === 'uploading' && (
        <div className="text-center py-12">
          <Loader2 className="w-12 h-12 mx-auto text-blue-500 animate-spin mb-4" />
          <h3 className="text-lg font-medium mb-2">正在上传并提取信息...</h3>
          <p className="text-sm text-gray-500">AI 正在自动识别小说标题、类型、写作风格等信息</p>
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 text-left dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{flowMessage}</span>
              <span className="text-gray-500">{flowProgress}%</span>
            </div>
            <Progress value={flowProgress} max={100} size="sm" className="mt-3" />
          </div>
        </div>
      )}

      {/* Step: AI 分析中 */}
      {step === 'analyzing' && projectId && (
        <div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
            <div className="flex items-center justify-between text-sm text-blue-900 dark:text-blue-200">
              <span className="font-medium">{flowMessage}</span>
              <span>{flowProgress}%</span>
            </div>
            <Progress value={flowProgress} max={100} size="sm" className="mt-3" />
          </div>
          <AnalysisTaskPanel projectId={projectId} compact={false} />
          {!taskPollingActive && !taskId && (
            <div className="text-center py-6">
              <Loader2 className="w-8 h-8 mx-auto text-orange-500 animate-spin mb-3" />
              <p className="text-sm text-gray-500">正在启动分析任务...</p>
            </div>
          )}
        </div>
      )}

      {/* Step: 完成 */}
      {step === 'complete' && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-lg font-medium mb-1">分析完成！</h3>
            <p className="text-sm text-gray-500">
              已成功分析 {analysisCount} 个维度，提取 {charactersCount} 个角色档案
            </p>
          </div>

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
