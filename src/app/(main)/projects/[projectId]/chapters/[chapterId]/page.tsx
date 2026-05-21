import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { ChapterEditor } from '@/components/chapter'

async function fetchChapter(projectId: number, chapterId: number) {
  const headerList = await headers()
  const host = headerList.get('x-forwarded-host') || headerList.get('host') || '127.0.0.1:3200'
  const forwardedProto = headerList.get('x-forwarded-proto')
  const protocol = forwardedProto?.split(',')[0]?.trim()
    || (host.includes('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')
  const cookie = headerList.get('cookie')
  const authorization = headerList.get('authorization')
  const res = await fetch(new URL(`/api/novel/projects/${projectId}/chapters/${chapterId}`, `${protocol}://${host}`), {
    cache: 'no-store',
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(authorization ? { authorization } : {}),
    },
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
