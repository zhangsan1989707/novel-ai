'use client'

import { TopNavigation } from '@/components/layout/TopNavigation'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <TopNavigation>
      {children}
    </TopNavigation>
  )
}