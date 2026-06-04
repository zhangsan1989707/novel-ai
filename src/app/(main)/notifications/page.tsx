'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, CardContent } from '@/components/ui'
import { Bell, CheckCheck, Trash2 } from 'lucide-react'
import {
  NOTIFICATION_TYPE_ICONS,
  NOTIFICATION_TYPE_COLORS,
  NOTIFICATION_PRIORITY_COLORS,
  formatNotificationTime,
} from '@/lib/notifications/constants'

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

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(unreadOnly ? { unreadOnly: 'true' } : {}),
      })
      const res = await fetch(`/api/notifications?${params}`)
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.data)
        setTotalPages(data.pagination?.totalPages || 1)
        setUnreadCount(data.unreadCount || 0)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [page, unreadOnly])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const markAllAsRead = async () => {
    await fetch('/api/notifications/read-all', { method: 'PATCH' })
    fetchNotifications()
  }

  const deleteNotification = async (id: number) => {
    await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
    fetchNotifications()
  }

  const markAsRead = async (id: number) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">通知中心</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} 条未读通知` : '所有通知已读'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={unreadOnly ? 'primary' : 'outline'}
            size="sm"
            onClick={() => { setUnreadOnly(!unreadOnly); setPage(1) }}
          >
            未读
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <CheckCheck className="h-4 w-4 mr-1" />
              全部已读
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">加载中...</div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">{unreadOnly ? '没有未读通知' : '暂无通知'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map(notification => {
            const Icon = NOTIFICATION_TYPE_ICONS[notification.type] || Bell
            return (
              <Card
                key={notification.id}
                className={`border-l-4 ${NOTIFICATION_PRIORITY_COLORS[notification.priority]} ${
                  notification.isRead ? 'opacity-70' : ''
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${NOTIFICATION_TYPE_COLORS[notification.type]}`} />
                    <div
                      className={`flex-1 min-w-0 ${notification.link ? 'cursor-pointer' : ''}`}
                      onClick={() => {
                        if (!notification.isRead) markAsRead(notification.id)
                        if (notification.link) router.push(notification.link)
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <h3 className={`text-sm font-medium ${notification.isRead ? 'text-muted-foreground' : ''}`}>
                          {notification.title}
                        </h3>
                        {!notification.isRead && <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{notification.content}</p>
                      <span className="text-xs text-muted-foreground mt-1.5 block">
                        {formatNotificationTime(notification.createdAt)}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteNotification(notification.id)}
                      className="shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            上一页
          </Button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            下一页
          </Button>
        </div>
      )}
    </div>
  )
}
