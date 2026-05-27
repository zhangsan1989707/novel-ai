import { notFound } from 'next/navigation'
import ProjectDetailClient from '@/components/project/ProjectDetailClient'
import { fetchInternalApi } from '@/lib/server/internal-api'

async function fetchProject(projectId: number) {
  const res = await fetchInternalApi(`/api/novel/projects/${projectId}`, {
    cache: 'no-store',
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

  return <ProjectDetailClient key={projectId} initialProject={project} />
}
