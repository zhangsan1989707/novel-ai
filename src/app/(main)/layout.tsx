import { TopNavigation } from '@/components/layout/TopNavigation'

export default async function MainLayout({
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
