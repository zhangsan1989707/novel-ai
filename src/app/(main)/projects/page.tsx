'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input, Pagination, Modal, Card, CardContent, FilterChip, FilterChipGroup, EnhancedProjectsEmptyState, toast } from '@/components/ui'
import { ProjectCard, genreOptions, AnalyzeWizard } from '@/components/project'
import { Plus, Search, Sparkles, SlidersHorizontal } from 'lucide-react'
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
    stats?: {
      totalProjects: number
      totalWordCount: number
      aiCallCount: number
    }
  }
}

const statusChips = [
  { label: '全部', value: '' },
  { label: '草稿', value: 'DRAFT' },
  { label: '连载中', value: 'WRITING' },
  { label: '已完结', value: 'COMPLETED' },
  { label: '暂停', value: 'PAUSED' },
]

const genreChips = genreOptions.map(opt => ({ label: opt.label, value: opt.value }))

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalWordCount, setTotalWordCount] = useState(0)
  const [aiCallCount, setAiCallCount] = useState(0)

  const [statusFilter, setStatusFilter] = useState('')
  const [genreFilter, setGenreFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilterPanel, setShowFilterPanel] = useState(false)

  const [showAnalyzeModal, setShowAnalyzeModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteProjectId, setDeleteProjectId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

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
        if (data.data.stats) {
          setTotalWordCount(data.data.stats.totalWordCount)
          setAiCallCount(data.data.stats.aiCallCount)
        }
      }
    } catch (error) {
      console.error('获取小说列表失败:', error)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, genreFilter, searchQuery])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

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
        toast.success('小说已删除')
      } else {
        toast.error(result.error?.message || '删除失败')
      }
    } catch (error) {
      console.error('删除小说失败:', error)
      toast.error('删除失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">我的小说</h1>
          <p className="text-sm text-muted-foreground">{total} 部小说</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAnalyzeModal(true)}>
            <Sparkles className="h-4 w-4 mr-1.5" />
            拆解小说
          </Button>
          <Button size="sm" onClick={() => router.push('/projects/new')}>
            <Plus className="h-4 w-4 mr-1.5" />
            创作小说
          </Button>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="mb-6 flex flex-col gap-3">
        {/* 搜索 + 筛选按钮同行 */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索小说..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
              className="pl-10 w-full"
            />
          </div>
          <Button
            variant={showFilterPanel ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="gap-1.5 shrink-0"
          >
            <SlidersHorizontal className="h-4 w-4" />
            筛选
          </Button>
        </div>

        {/* 标签式筛选 - 状态 + 类型合并 */}
        {(showFilterPanel || statusFilter || genreFilter) && (
          <FilterChipGroup>
            <div className="text-xs text-muted-foreground self-center mr-1">状态：</div>
            {statusChips.map((chip) => (
              <FilterChip
                key={chip.value}
                label={chip.label}
                active={statusFilter === chip.value}
                onClick={() => {
                  setStatusFilter(chip.value)
                  setPage(1)
                }}
              />
            ))}
            <div className="w-px h-5 bg-border mx-1" />
            <div className="text-xs text-muted-foreground self-center mr-1">类型：</div>
            {genreChips.map((chip) => (
              <FilterChip
                key={chip.value}
                label={chip.label}
                active={genreFilter === chip.value}
                onClick={() => {
                  setGenreFilter(genreFilter === chip.value ? '' : chip.value)
                  setPage(1)
                }}
              />
            ))}
          </FilterChipGroup>
        )}
      </div>

      {/* 小说列表 */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-32 bg-muted" />
              <CardContent className="p-4 space-y-3">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
                <div className="h-2 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EnhancedProjectsEmptyState
          onCreate={() => router.push('/projects/new')}
          onAnalyze={() => setShowAnalyzeModal(true)}
          stats={{
            projectCount: total,
            totalWordCount,
            aiCallCount,
          }}
        />
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
        title="删除小说"
        description="确定要删除这本小说吗？此操作不可撤销，所有章节内容也将被删除。"
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
    </>
  )
}