import { redirect } from 'next/navigation'

export default async function ChaptersPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  redirect(`/projects/${projectId}`)
}
