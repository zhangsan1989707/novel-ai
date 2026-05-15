'use client'

import { use } from 'react'
import { ChapterEditor } from '@/components/chapter'

interface PageProps {
  params: Promise<{ projectId: string }>
}

export default function NewChapterPage({ params }: PageProps) {
  const { projectId } = use(params)
  const projectIdNum = parseInt(projectId)

  return <ChapterEditor projectId={projectIdNum} />
}
