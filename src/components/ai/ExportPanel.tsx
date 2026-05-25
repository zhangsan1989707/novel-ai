'use client'

import { useState } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle, toast } from '@/components/ui'
import { Book, Flame, Zap, Heart, Cat, BookOpen, FileText, Download, Loader2, CheckCircle2 } from 'lucide-react'

interface ExportPanelProps {
  projectId: number
  projectTitle: string
  chapterCount: number
}

const platforms = [
  { id: 'qidian', name: '起点中文网', icon: Book, format: 'TXT', desc: '支持分卷导出' },
  { id: 'fanqie', name: '番茄小说', icon: Flame, format: 'TXT', desc: '章节自动编号' },
  { id: 'feilu', name: '飞卢小说', icon: Zap, format: 'TXT', desc: '飞卢特有格式' },
  { id: 'jinjiang', name: '晋江文学城', icon: Heart, format: 'TXT', desc: '标准段落格式' },
  { id: 'qimao', name: '七猫小说', icon: Cat, format: 'TXT', desc: '推荐新书格式' },
  { id: 'epub', name: 'EPUB电子书', icon: BookOpen, format: 'EPUB', desc: '通用电子书' },
  { id: 'generic', name: '通用格式', icon: FileText, format: 'TXT/MD', desc: '多格式支持' },
] as const

type PlatformId = typeof platforms[number]['id']

export function ExportPanel({ projectId, projectTitle, chapterCount }: ExportPanelProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId | null>(null)
  const [loading, setLoading] = useState(false)
  const [exportResult, setExportResult] = useState<{
    fileName: string
    content?: string
    downloadUrl?: string
  } | null>(null)
  const [includeMetadata, setIncludeMetadata] = useState(true)

  const selectedPlatformData = platforms.find(p => p.id === selectedPlatform)

  const handleExport = async () => {
    if (!selectedPlatform) {
      toast.error('请先选择导出平台')
      return
    }

    setLoading(true)
    setExportResult(null)

    try {
      const body: Record<string, unknown> = {
        platform: selectedPlatform,
        includeMetadata,
      }

      if (selectedPlatform === 'generic') {
        body.includeChapterTitles = true
        body.format = 'txt'
      }

      if (selectedPlatform === 'epub') {
        const res = await fetch(`/api/novel/projects/${projectId}/export`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => null)
          toast.error(errData?.error?.message || '导出失败')
          setLoading(false)
          return
        }

        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${projectTitle}.epub`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        setExportResult({ fileName: `${projectTitle}.epub` })
        toast.success('EPUB 导出成功')
        setLoading(false)
        return
      }

      const res = await fetch(`/api/novel/projects/${projectId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!data.success) {
        toast.error(data.error?.message || '导出失败')
        setLoading(false)
        return
      }

      const { fileName, content, downloadUrl } = data.data

      if (content) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        setExportResult({ fileName, content })
        toast.success('导出成功')
      } else if (downloadUrl) {
        setExportResult({ fileName, downloadUrl })
        toast.success('导出成功')
      }
    } catch {
      toast.error('导出失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!exportResult) return

    if (exportResult.content) {
      const blob = new Blob([exportResult.content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = exportResult.fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } else if (exportResult.downloadUrl) {
      const a = document.createElement('a')
      a.href = exportResult.downloadUrl
      a.download = exportResult.fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            选择导出平台
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {platforms.map((platform) => {
              const Icon = platform.icon
              const isSelected = selectedPlatform === platform.id

              return (
                <button
                  key={platform.id}
                  onClick={() => {
                    setSelectedPlatform(platform.id as PlatformId)
                    setExportResult(null)
                  }}
                  className={`flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                  }`}
                >
                  <div className={`mt-0.5 shrink-0 rounded-lg p-1.5 ${
                    isSelected
                      ? 'bg-blue-100 text-blue-600 dark:bg-blue-800 dark:text-blue-300'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {platform.name}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {platform.desc}
                    </div>
                    <div className="mt-1">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        isSelected
                          ? 'bg-blue-200 text-blue-700 dark:bg-blue-800 dark:text-blue-200'
                          : 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                      }`}>
                        {platform.format}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {selectedPlatformData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-600" />
              导出选项
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500 dark:text-gray-400">选中平台：</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {selectedPlatformData.name}
                </span>
                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  {selectedPlatformData.format}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                共 {chapterCount} 个章节将被导出
              </p>
            </div>

            <label className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeMetadata}
                onChange={(e) => setIncludeMetadata(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  包含元数据
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  包含作者、标签、简介等信息
                </div>
              </div>
            </label>

            <Button
              variant="primary"
              className="w-full gap-2"
              onClick={handleExport}
              loading={loading}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在导出...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  一键导出
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {exportResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              导出完成
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900/40 dark:bg-green-950/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">
                    {exportResult.fileName}
                  </span>
                </div>
                <a
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 transition-colors cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  下载
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}