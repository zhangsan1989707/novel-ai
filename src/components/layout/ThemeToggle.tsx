'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'

type Theme = 'light' | 'dark' | 'system'

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('system')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('theme') as Theme | null
    if (stored) {
      setTheme(stored)
      applyTheme(stored)
    } else {
      applyTheme('system')
    }
  }, [])

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement
    if (newTheme === 'system') {
      root.classList.remove('dark', 'light')
      root.style.removeProperty('color-scheme')
    } else {
      root.classList.remove('dark', 'light')
      root.classList.add(newTheme)
      root.style.colorScheme = newTheme
    }
  }

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    applyTheme(newTheme)
  }

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className={cn('w-9 h-9 rounded-lg bg-gray-200 dark:bg-gray-700', className)} />
    )
  }

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        'relative w-9 h-9 rounded-lg flex items-center justify-center',
        'bg-gray-100 dark:bg-gray-700',
        'hover:bg-gray-200 dark:hover:bg-gray-600',
        'transition-colors duration-200',
        className
      )}
      aria-label={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
    >
      <Sun
        className={cn(
          'h-4 w-4 transition-all duration-300',
          theme === 'dark' ? 'rotate-0 scale-100 text-amber-500' : 'rotate-90 scale-0 text-gray-400'
        )}
      />
      <Moon
        className={cn(
          'absolute h-4 w-4 transition-all duration-300',
          theme === 'light' ? 'rotate-0 scale-100 text-indigo-400' : '-rotate-90 scale-0 text-gray-400'
        )}
      />
    </button>
  )
}
