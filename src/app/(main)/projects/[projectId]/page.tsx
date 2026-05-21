import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import ProjectDetailClient from '@/components/project/ProjectDetailClient'

async function fetchProject(projectId: number) {
  const headerList = await headers()
  const host = headerList.get('x-forwarded-host') || headerList.get('host') || '127.0.0.1:3200'
  const forwardedProto = headerList.get('x-forwarded-proto')
  const protocol = forwardedProto?.split(',')[0]?.trim()
    || (host.includes('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')
  const cookie = headerList.get('cookie')
  const authorization = headerList.get('authorization')
  const res = await fetch(new URL(`/api/novel/projects/${projectId}`, `${protocol}://${host}`), {
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
    throw new Error(`Failed to load project: ${res.status}`)
  }

  const data = await res.json()
  if (!data?.success) {
    return null
  }

  return data.data
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const resolvedParams = await params
  const projectId = Number(resolvedParams.projectId)

  if (!Number.isFinite(projectId)) {
    notFound()
  }

  const project = await fetchProject(projectId)
  if (!project) {
    notFound()
  }

  return <ProjectDetailClient initialProject={project} />
}
