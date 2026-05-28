'use client'

import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/DropdownMenu'
import { Download } from 'lucide-react'
import { toast } from '@/components/ui'

interface ExportChapter {
  chapterNumber: number
  title: string
  content?: string | null
}

interface ExportProject {
  id: number
  title: string
  outline?: string | null
  chapters: ExportChapter[]
}

interface ExportData {
  id: number
  title: string
  outline?: string | null
  chapters: ExportChapter[]
}

interface ExportMenuProps {
  project: ExportProject
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function exportAsTxt(data: ExportData): string {
  let content = `${data.title}\n\n`
  content += '='.repeat(40) + '\n\n'

  for (const chapter of data.chapters) {
    content += `第${chapter.chapterNumber}章 ${chapter.title}\n\n`
    content += chapter.content || ''
    content += '\n\n'
  }

  return content
}

function exportAsMarkdown(data: ExportData): string {
  let content = `# ${data.title}\n\n`

  if (data.outline) {
    content += `## 大纲\n\n${data.outline}\n\n---\n\n`
  }

  for (const chapter of data.chapters) {
    content += `## 第${chapter.chapterNumber}章 ${chapter.title}\n\n`
    content += chapter.content || ''
    content += '\n\n---\n\n'
  }

  return content
}

export function ExportMenu({ project }: ExportMenuProps) {
  const handleExportTxt = async () => {
    try {
      const res = await fetch(`/api/novel/projects/${project.id}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ view: 'data' }),
      })
      if (!res.ok) throw new Error('获取数据失败')

      const data = await res.json()
      if (!data.success) throw new Error(data.error?.message || '获取数据失败')

      const content = exportAsTxt(data.data)
      downloadFile(content, `${project.title}.txt`, 'text/plain;charset=utf-8')
      toast.success('导出 TXT 成功')
    } catch (error) {
      console.error('导出TXT失败:', error)
      toast.error('导出 TXT 失败')
    }
  }

  const handleExportMarkdown = async () => {
    try {
      const res = await fetch(`/api/novel/projects/${project.id}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ view: 'data' }),
      })
      if (!res.ok) throw new Error('获取数据失败')

      const data = await res.json()
      if (!data.success) throw new Error(data.error?.message || '获取数据失败')

      const content = exportAsMarkdown(data.data)
      downloadFile(content, `${project.title}.md`, 'text/markdown;charset=utf-8')
      toast.success('导出 Markdown 成功')
    } catch (error) {
      console.error('导出Markdown失败:', error)
      toast.error('导出 Markdown 失败')
    }
  }

  const handleExportEpub = async () => {
    try {
      const res = await fetch(`/api/novel/projects/${project.id}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'epub' }),
      })

      if (!res.ok) throw new Error('导出失败')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project.title}.epub`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('导出 EPUB 成功')
    } catch (error) {
      console.error('导出EPUB失败:', error)
      toast.error('导出 EPUB 失败，请稍后重试')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 h-8 px-3 text-sm"
        >
          <Download className="h-4 w-4 mr-2" />
          导出
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={handleExportTxt}>
          导出为 TXT
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportMarkdown}>
          导出为 Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportEpub}>
          导出为 EPUB
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}