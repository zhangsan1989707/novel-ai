'use client'

import { use } from 'react'
import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ projectId: string }>
}

export default function ChaptersPage({ params }: PageProps) {
  const { projectId } = use(params)
  redirect(`/projects/${projectId}`)
}
