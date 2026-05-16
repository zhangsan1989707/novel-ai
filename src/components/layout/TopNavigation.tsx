'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui'
import { BookOpen, Settings, DollarSign, Search } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { NotificationDropdown } from './NotificationDropdown'
import { HelpModal } from './HelpModal'

interface TopNavigationProps {
  children: React.ReactNode
}

const navItems = [
  { label: '我的小说', href: '/projects', icon: BookOpen },
  { label: 'AI 配置', href: '/settings', icon: Settings },
  { label: '成本管理', href: '/cost', icon: DollarSign },
]

export function TopNavigation({ children }: TopNavigationProps) {
  const router = useRouter()
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/projects') {
      return pathname === '/projects' || pathname.startsWith('/projects/')
    }
    return pathname === href
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/projects')}>
              <BookOpen className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold text-foreground">SoulKey</span>
            </div>

            {/* 导航菜单 */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Button
                    key={item.href}
                    variant={active ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => router.push(item.href)}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </Button>
                )
              })}
            </nav>

            {/* 右侧操作 */}
            <div className="flex items-center gap-3">
              {/* 搜索 */}
              <div className="hidden sm:flex items-center bg-muted rounded-lg px-3 py-1.5">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="搜索项目..."
                  className="bg-transparent border-none outline-none text-sm ml-2 w-32 focus:w-48 transition-all text-foreground placeholder:text-muted-foreground"
                />
              </div>

              {/* 通知 */}
              <NotificationDropdown />

              {/* 帮助 */}
              <HelpModal />

              {/* 主题切换 */}
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  )
}