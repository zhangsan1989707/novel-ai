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

export function exportAsTxt(project: ExportProject): string {
  let content = `${project.title}\n\n`
  content += '='.repeat(40) + '\n\n'

  for (const chapter of project.chapters) {
    content += `第${chapter.chapterNumber}章 ${chapter.title}\n\n`
    content += chapter.content || ''
    content += '\n\n'
  }

  return content
}

export function exportAsMarkdown(project: ExportProject): string {
  let content = `# ${project.title}\n\n`

  if (project.outline) {
    content += `## 大纲\n\n${project.outline}\n\n---\n\n`
  }

  for (const chapter of project.chapters) {
    content += `## 第${chapter.chapterNumber}章 ${chapter.title}\n\n`
    content += chapter.content || ''
    content += '\n\n---\n\n'
  }

  return content
}

export function downloadFile(content: string, filename: string, mimeType: string) {
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

export function exportProjectAsTxt(project: ExportProject) {
  const content = exportAsTxt(project)
  const filename = `${project.title}.txt`
  downloadFile(content, filename, 'text/plain;charset=utf-8')
}

export function exportProjectAsMarkdown(project: ExportProject) {
  const content = exportAsMarkdown(project)
  const filename = `${project.title}.md`
  downloadFile(content, filename, 'text/markdown;charset=utf-8')
}
