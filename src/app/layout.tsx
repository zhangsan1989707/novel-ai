import type { Metadata } from 'next'
import './globals.css'
import { ToastContainer } from '@/components/ui/Toast'
import { VersionInfo } from '@/components/common/VersionInfo'
import '@/lib/agents/adapters'

export const metadata: Metadata = {
  title: '灵章AI',
  description: '基于 AI 的智能小说创作平台',
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/favicon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-full antialiased" suppressHydrationWarning>
        {children}
        <ToastContainer />
        <VersionInfo />
      </body>
    </html>
  )
}
