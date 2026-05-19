'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui'
import { BookOpen, Settings, DollarSign, Search, TrendingUp } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { HelpModal } from './HelpModal'

interface TopNavigationProps {
  children: React.ReactNode
}

const primaryNavItems = [
  { label: '我的小说', href: '/projects', icon: BookOpen },
]

const secondaryNavItems = [
  { label: '扫榜选材', href: '/market', icon: TrendingUp },
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
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/projects')}>
              <BookOpen className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold text-foreground">SoulKey</span>
            </div>

            <nav className="hidden md:flex items-center gap-1">
              {[...primaryNavItems, ...secondaryNavItems].map((item) => {
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

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center bg-muted rounded-lg px-3 py-1.5">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="搜索项目..."
                  className="bg-transparent border-none outline-none text-sm ml-2 w-32 focus:w-48 transition-all text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <HelpModal />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  )
}
