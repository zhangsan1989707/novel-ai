import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { ToastContainer } from '@/components/ui/Toast'
import '@/lib/agents/adapters'

export const metadata: Metadata = {
  title: 'SoulKey 小说生成器',
  description: '基于 AI 的智能小说创作平台',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-full antialiased">
        {children}
        <ToastContainer />
        <Analytics />
      </body>
    </html>
  )
}
