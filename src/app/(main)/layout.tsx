import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { TopNavigation } from '@/components/layout/TopNavigation'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) {
    redirect('/login')
  }

  return (
    <TopNavigation>
      {children}
    </TopNavigation>
  )
}
