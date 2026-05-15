import type { Metadata } from 'next'
import { ToastContainer } from '@/components/ui'

export const metadata: Metadata = {
  title: 'SoulKey 小说生成器',
  description: '基于 AI 的智能小说创作平台',
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {children}
      <ToastContainer />
    </div>
  )
}
