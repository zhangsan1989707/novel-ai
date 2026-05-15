'use client'

import { use } from 'react'
import { ChapterEditor } from '@/components/chapter'

interface PageProps {
  params: Promise<{ projectId: string; chapterId: string }>
}

export default function ChapterEditPage({ params }: PageProps) {
  const { projectId, chapterId } = use(params)
  const projectIdNum = parseInt(projectId)
  const chapterIdNum = parseInt(chapterId)

  return <ChapterEditor projectId={projectIdNum} chapterId={chapterIdNum} />
}
