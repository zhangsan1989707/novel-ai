import { notFound } from 'next/navigation'
import { ChapterEditor } from '@/components/chapter'
import { fetchInternalApi } from '@/lib/server/internal-api'

async function fetchChapter(projectId: number, chapterId: number) {
  const res = await fetchInternalApi(`/api/novel/projects/${projectId}/chapters/${chapterId}`, {
    cache: 'no-store',
  })

  if (res.status === 404) {
    return null
  }

  if (!res.ok) {
    throw new Error(`Failed to load chapter: ${res.status}`)
  }

  const data = await res.json()
  if (!data?.success) return null
  return data.data
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ projectId: string; chapterId: string }>
}) {
  const resolvedParams = await params
  const projectId = Number(resolvedParams.projectId)
  const chapterId = Number(resolvedParams.chapterId)

  if (!Number.isFinite(projectId) || !Number.isFinite(chapterId)) {
    notFound()
  }

  const chapter = await fetchChapter(projectId, chapterId)
  if (!chapter) {
    notFound()
  }

  return <ChapterEditor projectId={projectId} chapterId={chapterId} initialChapter={chapter} />
}
