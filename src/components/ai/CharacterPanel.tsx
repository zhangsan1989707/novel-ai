'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, Badge, Button, toast } from '@/components/ui'
import { Users, Trash2, Loader2 } from 'lucide-react'

interface CharacterProfile {
  id: number
  name: string
  role: string
  appearance?: string | null
  personality?: string | null
  background?: string | null
  catchphrases?: string[]
  aliases?: string[]
  firstChapter?: number | null
  lastUpdated?: number | null
  relationships?: Record<string, string>
  currentState?: Record<string, unknown>
}

interface CharacterPanelProps {
  projectId: number
}

const ROLE_LABELS: Record<string, string> = {
  PROTAGONIST: '主角',
  ANTAGONIST: '反派',
  SUPPORTING: '配角',
  MINOR: '次要角色',
}

const ROLE_COLORS: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'> = {
  PROTAGONIST: 'success',
  ANTAGONIST: 'danger',
  SUPPORTING: 'primary',
  MINOR: 'secondary',
}

export function CharacterPanel({ projectId }: CharacterPanelProps) {
  const [characters, setCharacters] = useState<CharacterProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCharacters()
  }, [projectId])

  const fetchCharacters = async () => {
    try {
      const res = await fetch(`/api/novel/engine/${projectId}/characters`)
      const data = await res.json()
      if (data.success) {
        setCharacters(data.data || [])
      }
    } catch {
      console.error('获取角色列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (characterId: number) => {
    try {
      const res = await fetch(`/api/novel/engine/${projectId}/characters/${characterId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        toast.success('角色已删除')
        fetchCharacters()
      } else {
        toast.error(data.error?.message || '删除失败')
      }
    } catch {
      toast.error('删除失败')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    )
  }

  if (characters.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Users className="h-10 w-10 mx-auto mb-3 text-gray-300" />
        <p className="text-sm">暂无角色档案</p>
        <p className="text-xs text-gray-400 mt-1">AI 分析小说后会自动提取角色</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {characters.map((char) => (
        <Card key={char.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium text-gray-900 dark:text-white">{char.name}</h4>
                  <Badge variant={ROLE_COLORS[char.role] || 'default'}>
                    {ROLE_LABELS[char.role] || char.role}
                  </Badge>
                  {char.aliases && char.aliases.length > 0 && (
                    <span className="text-xs text-gray-400">
                      别名：{char.aliases.join('、')}
                    </span>
                  )}
                  {char.firstChapter && (
                    <span className="text-xs text-gray-400">
                      第{char.firstChapter}章出场
                    </span>
                  )}
                </div>

                {char.appearance && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span className="font-medium">外貌：</span>{char.appearance}
                  </p>
                )}
                {char.personality && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span className="font-medium">性格：</span>{char.personality}
                  </p>
                )}
                {char.background && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 line-clamp-2">
                    <span className="font-medium">背景：</span>{char.background}
                  </p>
                )}
                {char.catchphrases && char.catchphrases.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {char.catchphrases.map((cp, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        「{cp}」
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(char.id)}
                  className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
