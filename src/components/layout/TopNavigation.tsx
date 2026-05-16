'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui'
import { BookOpen, Plus, Settings, DollarSign, HelpCircle, Bell, Search } from 'lucide-react'

interface TopNavigationProps {
  children: React.ReactNode
}

const navItems = [
  { label: '我的小说', href: '/projects', icon: BookOpen },
  { label: '创作小说', href: '/projects/new', icon: Plus },
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/projects')}>
              <BookOpen className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">SoulKey</span>
            </div>

            {/* 导航菜单 */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Button
                    key={item.href}
                    variant={active ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => router.push(item.href)}
                    className={active ? 'bg-blue-600 hover:bg-blue-700' : ''}
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
              <div className="hidden sm:flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-1.5">
                <Search className="h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索项目..."
                  className="bg-transparent border-none outline-none text-sm ml-2 w-32 focus:w-48 transition-all"
                />
              </div>

              {/* 通知 */}
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors relative">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              {/* 帮助 */}
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <HelpCircle className="h-5 w-5" />
              </button>
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