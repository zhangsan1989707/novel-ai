'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, Check, CheckCheck, AlertCircle, Info, AlertTriangle, Clock } from 'lucide-react'
import { formatDisplayDate } from '@/lib/helpers'

interface Notification {
  id: number
  type: 'SYSTEM' | 'TASK' | 'QUOTA' | 'ERROR'
  priority: 'LOW' | 'NORMAL' | 'HIGH'
  title: string
  content: string
  link?: string
  isRead: boolean
  createdAt: string
}

const typeIcons = {
  SYSTEM: Info,
  TASK: Clock,
  QUOTA: AlertCircle,
  ERROR: AlertTriangle,
}

const typeColors = {
  SYSTEM: 'text-blue-500',
  TASK: 'text-purple-500',
  QUOTA: 'text-yellow-500',
  ERROR: 'text-red-500',
}

const priorityColors = {
  LOW: 'border-l-gray-400',
  NORMAL: 'border-l-blue-500',
  HIGH: 'border-l-red-500',
}

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 加载通知
  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications?limit=10')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.data)
        setUnreadCount(data.unreadCount)
      }
    } catch (error) {
      console.error('获取通知失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()

    // 定时刷新通知（每 30 秒）
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // 标记单条已读
  const markAsRead = async (id: number) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
      if (res.ok) {
        setNotifications(prev =>
          prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('标记已读失败:', error)
    }
  }

  // 标记全部已读
  const markAllAsRead = async () => {
    try {
      const res = await fetch('/api/notifications/read-all', { method: 'PATCH' })
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
        setUnreadCount(0)
      }
    } catch (error) {
      console.error('标记全部已读失败:', error)
    }
  }

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes} 分钟前`
    if (hours < 24) return `${hours} 小时前`
    if (days < 7) return `${days} 天前`
    return formatDisplayDate(date)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 通知按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-muted rounded-lg transition-colors relative"
        aria-label="通知"
      >
        <Bell className="h-5 w-5 text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-xs font-medium rounded-full px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* 下拉面板 */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50">
          {/* 头部 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground">通知</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                全部已读
              </button>
            )}
          </div>

          {/* 通知列表 */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                加载中...
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Bell className="h-8 w-8 mb-2 opacity-50" />
                <span className="text-sm">暂无通知</span>
              </div>
            ) : (
              notifications.map(notification => {
                const Icon = typeIcons[notification.type]
                return (
                  <div
                    key={notification.id}
                    className={`relative px-4 py-3 border-l-4 ${priorityColors[notification.priority]} ${
                      notification.isRead ? 'bg-transparent' : 'bg-muted/30'
                    } hover:bg-muted/50 transition-colors cursor-pointer`}
                    onClick={() => {
                      if (!notification.isRead) {
                        markAsRead(notification.id)
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${typeColors[notification.type]}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className={`text-sm font-medium truncate ${notification.isRead ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {notification.title}
                          </h4>
                          {!notification.isRead && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {notification.content}
                        </p>
                        <span className="text-xs text-muted-foreground mt-1.5 block">
                          {formatTime(notification.createdAt)}
                        </span>
                      </div>
                      {notification.isRead && (
                        <Check className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* 底部 */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-border">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                查看全部通知
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
