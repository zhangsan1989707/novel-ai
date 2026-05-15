'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Select, Input, Pagination, Modal, Card, CardContent } from '@/components/ui'
import { ProjectCard, ProjectForm, ProjectFormData, genreOptions, AnalyzeWizard } from '@/components/project'
import { Plus, Search, BookOpen, Sparkles, Settings } from 'lucide-react'
import type { ProjectStatus } from '@/types'

interface Project {
  id: number
  title: string
  description?: string | null
  genre?: string | null
  writingStyle?: string | null
  targetWordCount?: number | null
  currentWordCount: number
  status: ProjectStatus
  coverImage?: string | null
  updatedAt: string
  _count?: {
    chapters: number
  }
}

interface ProjectsResponse {
  success: boolean
  data: {
    projects: Project[]
    pagination: {
      page: number
      pageSize: number
      total: number
      totalPages: number
    }
  }
}

const statusOptions = [
  { label: '全部状态', value: '' },
  { label: '草稿', value: 'DRAFT' },
  { label: '写作中', value: 'WRITING' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已暂停', value: 'PAUSED' },
]

const emptyGenreOption = { label: '全部类型', value: '' }

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // 筛选状态
  const [statusFilter, setStatusFilter] = useState('')
  const [genreFilter, setGenreFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Modal 状态
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAnalyzeModal, setShowAnalyzeModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteProjectId, setDeleteProjectId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // 获取项目列表
  const fetchProjects = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '12',
      })
      if (statusFilter) params.set('status', statusFilter)
      if (genreFilter) params.set('genre', genreFilter)
      if (searchQuery) params.set('search', searchQuery)

      const res = await fetch(`/api/novel/projects?${params}`)
      const data: ProjectsResponse = await res.json()

      if (data.success) {
        setProjects(data.data.projects)
        setTotalPages(data.data.pagination.totalPages)
        setTotal(data.data.pagination.total)
      }
    } catch (error) {
      console.error('获取项目列表失败:', error)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, genreFilter, searchQuery])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  // 创建项目
  const handleCreate = async (data: ProjectFormData) => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/novel/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (result.success) {
        setShowCreateModal(false)
        router.push(`/projects/${result.data.id}`)
      }
    } catch (error) {
      console.error('创建项目失败:', error)
    } finally {
      setSubmitting(false)
    }
  }

  // 删除项目
  const handleDelete = async () => {
    if (!deleteProjectId) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/novel/projects/${deleteProjectId}`, {
        method: 'DELETE',
      })
      const result = await res.json()
      if (result.success) {
        setShowDeleteModal(false)
        setDeleteProjectId(null)
        fetchProjects()
      }
    } catch (error) {
      console.error('删除项目失败:', error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b">
        <div className="mx-auto max-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">我的小说</h1>
              <p className="text-sm text-gray-500">{total} 个项目</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAnalyzeModal(true)}>
                <Sparkles className="h-4 w-4 mr-1.5" />
                拆解小说
              </Button>
              <Button variant="outline" size="sm" onClick={() => router.push('/settings')}>
                <Settings className="h-4 w-4 mr-1.5" />
                AI 配置
              </Button>
              <Button size="sm" onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                创作小说
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* 筛选栏 */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
          {/* 搜索 */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="搜索项目..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
              className="pl-10 w-full"
            />
          </div>

          {/* 筛选条件 */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-500">筛选：</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="h-10 px-3 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm appearance-none cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '16px' }}
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={genreFilter}
              onChange={(e) => {
                setGenreFilter(e.target.value)
                setPage(1)
              }}
              className="h-10 px-3 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm appearance-none cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '16px' }}
            >
              {[emptyGenreOption, ...genreOptions].map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 项目列表 */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-32 bg-gray-200 dark:bg-gray-700" />
                <CardContent className="p-4 space-y-3">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 mb-4">还没有任何项目</p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              创建第一个项目
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onEdit={(id) => router.push(`/projects/${id}`)}
                  onDelete={(id) => {
                    setDeleteProjectId(id)
                    setShowDeleteModal(true)
                  }}
                />
              ))}
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="mt-8 flex justify-center">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* 创建项目 Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="新建项目"
        className="max-w-2xl"
      >
        <ProjectForm
          onSubmit={handleCreate}
          onCancel={() => setShowCreateModal(false)}
          loading={submitting}
        />
      </Modal>

      {/* 拆解小说 Modal */}
      <Modal
        open={showAnalyzeModal}
        onClose={() => setShowAnalyzeModal(false)}
        title="拆解小说"
        className="max-w-2xl"
      >
        <AnalyzeWizard onCancel={() => setShowAnalyzeModal(false)} />
      </Modal>

      {/* 删除确认 Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="删除项目"
        description="确定要删除这个项目吗？此操作不可撤销，所有章节内容也将被删除。"
      >
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
            取消
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={submitting}>
            删除
          </Button>
        </div>
      </Modal>
    </div>
  )
}
