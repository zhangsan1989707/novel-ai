import { notFound } from 'next/navigation'
import { ChapterEditor } from '@/components/chapter'

export default async function NewChapterPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const resolvedParams = await params
  const projectId = Number(resolvedParams.projectId)

  if (!Number.isFinite(projectId)) {
    notFound()
  }

  return <ChapterEditor projectId={projectId} />
}
