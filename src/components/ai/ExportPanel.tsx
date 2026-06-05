'use client'

import { useState } from 'react'
import { Button, toast } from '@/components/ui'
import { FileText, Download, Loader2, CheckCircle2 } from 'lucide-react'

interface ExportPanelProps {
  projectId: number
  projectTitle: string
  chapterCount: number
}

const platforms = [
  { id: 'qidian', name: '起点中文网', format: 'TXT', desc: '支持分卷导出' },
  { id: 'fanqie', name: '番茄小说', format: 'TXT', desc: '章节自动编号' },
  { id: 'feilu', name: '飞卢小说', format: 'TXT', desc: '飞卢特有格式' },
  { id: 'jinjiang', name: '晋江文学城', format: 'TXT', desc: '标准段落格式' },
  { id: 'qimao', name: '七猫小说', format: 'TXT', desc: '推荐新书格式' },
  { id: 'epub', name: 'EPUB电子书', format: 'EPUB', desc: '通用电子书' },
  { id: 'generic', name: '通用格式', format: 'TXT/MD', desc: '多格式支持' },
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
    <div className="flex gap-4 min-h-[320px]">
      {/* 左侧：平台列表 */}
      <div className="w-48 shrink-0 border-r border-gray-200 dark:border-gray-700 pr-4">
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-2">
          选择平台
        </div>
        <div className="space-y-1">
          {platforms.map((platform) => {
            const isSelected = selectedPlatform === platform.id

            return (
              <button
                key={platform.id}
                onClick={() => {
                  setSelectedPlatform(platform.id as PlatformId)
                  setExportResult(null)
                }}
                className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-all ${
                  isSelected
                    ? 'bg-blue-50 text-blue-700 border-l-2 border-blue-500 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-400'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                <span className="font-medium">{platform.name}</span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  isSelected
                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-800 dark:text-blue-200'
                    : 'bg-gray-200 text-gray-500 dark:bg-gray-600 dark:text-gray-400'
                }`}>
                  {platform.format}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 右侧：详情 + 选项 */}
      <div className="flex-1 flex flex-col">
        {!selectedPlatformData ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
            <div className="text-center">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              请选择导出平台
            </div>
          </div>
        ) : exportResult ? (
          /* 导出完成态 */
          <div className="flex-1 flex flex-col justify-center">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900/40 dark:bg-green-950/20">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-700 dark:text-green-300">
                  导出完成
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-green-600 dark:text-green-400 truncate mr-3">
                  {exportResult.fileName}
                </span>
                <button
                  onClick={handleDownload}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  下载
                </button>
              </div>
            </div>
            <button
              onClick={() => setExportResult(null)}
              className="mt-3 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 text-center"
            >
              继续导出其他格式
            </button>
          </div>
        ) : (
          /* 导出选项 */
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <div className="mb-4">
                <div className="text-base font-medium text-gray-900 dark:text-white">
                  {selectedPlatformData.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {selectedPlatformData.desc}
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">导出格式</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {selectedPlatformData.format}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-gray-500 dark:text-gray-400">章节数量</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {chapterCount} 章
                  </span>
                </div>
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
            </div>

            <Button
              variant="primary"
              className="w-full gap-2 mt-4"
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
          </div>
        )}
      </div>
    </div>
  )
}
