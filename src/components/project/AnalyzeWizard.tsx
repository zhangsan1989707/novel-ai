'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, CardHeader, CardTitle, CardContent, toast } from '@/components/ui'
import { ProjectForm, type ProjectFormData } from '@/components/project'
import { BookOpen, Sparkles, FileText, CheckCircle, Upload, File, Loader2 } from 'lucide-react'
import { BookAnalysisPanel, AnalysisTaskPanel } from '@/components/ai'

type WizardStep = 'upload' | 'uploading' | 'confirm' | 'analyzing' | 'complete'

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
  } | null>(null)

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
    if (file) handleFileSelect(file)
  }, [])

  const handleFileSelect = useCallback((file: File) => {
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
  }, [])

  const handleStartUpload = async () => {
    if (!selectedFile) return

    setSubmitting(true)
    setStep('uploading')
    setError('')

    try {
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
        setSubmitting(false)
        return
      }

      const newProjectId = uploadData.data.projectId
      setProjectId(newProjectId)

      const projectRes = await fetch(`/api/novel/projects/${newProjectId}`)
      const projectData = await projectRes.json()
      if (projectData.success) {
        const p = projectData.data
        setExtractedMeta({
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
        })
      }

      setStep('confirm')
    } catch (err) {
      console.error('Error:', err)
      setError('操作失败，请重试')
      setStep('upload')
      setSubmitting(false)
    }
  }

  const startTaskPolling = (tid: string) => {
    setTaskId(tid)
    setTaskPollingActive(true)

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
    }

    pollIntervalRef.current = setInterval(async () => {
      if (!tid) return
      try {
        const res = await fetch(`/api/novel/projects/${projectId}/analysis-task`)
        const data = await res.json()
        if (data.success && data.data) {
          if (data.data.status === 'COMPLETED') {
            setAnalysisCount(data.data.totalDimensions || 0)
            clearInterval(pollIntervalRef.current!)
            pollIntervalRef.current = null
            setTaskPollingActive(false)

            // 触发后续流程
            await postAnalysisTasks()
            setStep('complete')
          } else if (data.data.status === 'FAILED') {
            setError(data.data.errorMessage || '分析任务失败')
            clearInterval(pollIntervalRef.current!)
            pollIntervalRef.current = null
            setTaskPollingActive(false)
            setStep('confirm')
          }
        }
      } catch (err) {
        console.error('Poll error:', err)
      }
    }, 2000)
  }

  const postAnalysisTasks = async () => {
    if (!projectId) return

    // RAG 索引重建
    await fetch(`/api/novel/projects/${projectId}/rag/rebuild`, {
      method: 'POST',
    }).catch(() => {
      console.warn('RAG 索引重建失败')
    })

    // 提取角色档案
    const charRes = await fetch('/api/novel/ai/extract-characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    }).catch(() => null)

    if (charRes) {
      const charData = await charRes.json().catch(() => null)
      if (charData?.success) {
        setCharactersCount(charData.data.charactersCreated || 0)
      }
    }
  }

  const handleConfirmProject = async (formData: ProjectFormData) => {
    if (!projectId || !extractedMeta) return

    setSubmitting(true)
    setStep('analyzing')
    setError('')

    try {
      const updateRes = await fetch(`/api/novel/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title || extractedMeta.title,
          description: formData.description,
          genre: formData.genre,
          writingStyle: formData.writingStyle,
          targetWordCount: formData.targetWordCount,
          chapterWordCount: formData.chapterWordCount,
          totalVolumes: formData.totalVolumes,
          targetAudience: formData.targetAudience,
          aiModelId: formData.aiModelId,
          worldSetting: formData.worldSetting,
          powerSystem: formData.powerSystem,
          protagonistProfile: formData.protagonistProfile,
          protagonistGoal: formData.protagonistGoal,
          antagonistSetting: formData.antagonistSetting,
          endingPlan: formData.endingPlan,
          writingPrompt: formData.writingPrompt,
        }),
      })

      const updateData = await updateRes.json()
      if (!updateData.success) {
        console.warn('Project update failed:', updateData.error)
      }

      // 使用异步任务 API
      const res = await fetch(`/api/novel/projects/${projectId}/analysis-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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

      const data = await res.json()
      if (data.success) {
        if (data.data.task.status === 'COMPLETED') {
          // 已有完成的任务（复用）
          setAnalysisCount(data.data.task.totalDimensions || 0)
          await postAnalysisTasks()
          setStep('complete')
        } else {
          // 开始轮询任务状态
          startTaskPolling(data.data.task.id)
        }
      } else {
        setError(data.error?.message || '创建分析任务失败')
        setStep('confirm')
      }
    } catch (err) {
      console.error('Error:', err)
      setError('分析处理失败，请重试')
      setStep('confirm')
    } finally {
      setSubmitting(false)
    }
  }

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
    { key: 'confirm', label: '确认信息' },
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
        </div>
      )}

      {/* Step: 确认/编辑信息 */}
      {step === 'confirm' && extractedMeta && (
        <div>
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">AI 已自动识别以下信息</p>
                <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                  请检查并修改以下内容，确认后开始深度分析。文件「{selectedFile?.name}」已导入，共 {extractedMeta.chapterCount || '?'} 章。
                </p>
              </div>
            </div>
          </div>

          <ProjectForm
            defaultValues={{
              title: extractedMeta.title,
              description: extractedMeta.description,
              genre: extractedMeta.genre,
              writingStyle: extractedMeta.writingStyle,
              targetWordCount: extractedMeta.targetWordCount,
              chapterWordCount: extractedMeta.chapterWordCount || 3000,
              totalVolumes: extractedMeta.totalVolumes || 4,
              targetAudience: extractedMeta.targetAudience,
              worldSetting: '',
              powerSystem: '',
              protagonistProfile: '',
              protagonistGoal: '',
              antagonistSetting: '',
              endingPlan: '',
              writingPrompt: '',
            }}
            onSubmit={handleConfirmProject}
            onCancel={onCancel}
            loading={submitting}
            submitLabel="确认并开始分析"
            showAdvancedFields={true}
          />
        </div>
      )}

      {/* Step: AI 分析中 */}
      {step === 'analyzing' && projectId && (
        <div className="space-y-6">
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
                    <div className="font-medium">{extractedMeta?.title || selectedFile?.name}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">小说类型</div>
                    <div className="font-medium">{extractedMeta?.genre || '未识别'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">写作风格</div>
                    <div className="font-medium">{extractedMeta?.writingStyle || '未识别'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">章节数</div>
                    <div className="font-medium">{extractedMeta?.chapterCount || '-'} 章</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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
