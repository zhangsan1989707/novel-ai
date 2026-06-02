'use client'

import { Button, Modal, Badge, toast } from '@/components/ui'
import { BookOpen, Search, Image, BarChart3, Shield, Wand2, Layers } from 'lucide-react'
import { ProjectBaseInfoForm } from '@/components/project'
import { ResearchPanel, ReviewPanel, DeslopPanel, BatchDeslopPanel, ExportPanel, AnalysisWorkbench, CoverGenerator, Toolbox } from '@/components/ai'
import type { ProjectChapter } from '@/hooks/useProjectDetail'
import { chapterStatusMap } from './constants'
import { formatLargeNumber } from '@/lib/utils'

type ModalKey = 'edit' | 'delete' | 'toolbox' | 'chapterPreview' | 'research' | 'cover' | 'plotAnalysis' | 'review' | 'deslop' | 'batchDeslop' | 'export'

interface ProjectModalsProps {
  projectId: number
  project: {
    title: string
    chapters: ProjectChapter[]
    chapterWordCount: number
  }
  modals: Record<ModalKey, boolean>
  closeModal: (key: ModalKey) => void
  openToolModal: (key: Exclude<ModalKey, 'toolbox' | 'edit' | 'delete' | 'chapterPreview' | 'export'>) => void
  previewChapter: ProjectChapter | null
  setPreviewChapter: (chapter: ProjectChapter | null) => void
  submitting: boolean
  handleUpdate: (formData: { title: string }) => Promise<void>
  handleDelete: () => Promise<void>
  fetchProject: () => Promise<void>
  openChapterEditor: (chapterId: number) => void
  openChapterGenerate: (chapterId: number) => void
  getReviewingReason: (chapter: ProjectChapter) => string
}

export function ProjectModals({
  projectId,
  project,
  modals,
  closeModal,
  openToolModal,
  previewChapter,
  setPreviewChapter,
  submitting,
  handleUpdate,
  handleDelete,
  fetchProject,
  openChapterEditor,
  openChapterGenerate,
  getReviewingReason,
}: ProjectModalsProps) {
  const toolboxTools = [
    {
      id: 'research',
      label: '资料研究',
      description: '搜索相关资料辅助创作',
      icon: <Search className="h-4 w-4" />,
      onClick: () => openToolModal('research'),
    },
    {
      id: 'cover',
      label: '封面生成',
      description: 'AI 生成小说封面图',
      icon: <Image className="h-4 w-4" />,
      onClick: () => openToolModal('cover'),
    },
    {
      id: 'plotAnalysis',
      label: '拆书分析',
      description: '分析现有文本结构',
      icon: <BarChart3 className="h-4 w-4" />,
      onClick: () => openToolModal('plotAnalysis'),
    },
    {
      id: 'review',
      label: '对抗式审稿',
      description: 'AI 多角色交叉审稿',
      icon: <Shield className="h-4 w-4" />,
      onClick: () => openToolModal('review'),
    },
    {
      id: 'deslop',
      label: '文风精修',
      description: '优化单章文本自然度',
      icon: <Wand2 className="h-4 w-4" />,
      onClick: () => openToolModal('deslop'),
    },
    {
      id: 'batchDeslop',
      label: '批量精修',
      description: '批量精修已完成章节',
      icon: <Layers className="h-4 w-4" />,
      onClick: () => openToolModal('batchDeslop'),
    },
  ]

  return (
    <>
      <Modal
        open={modals.chapterPreview}
        onClose={() => {
          closeModal('chapterPreview')
          setPreviewChapter(null)
        }}
        title={previewChapter ? `第${previewChapter.chapterNumber}章 · ${previewChapter.title || '无标题'}` : ''}
        className="max-w-3xl"
      >
        {previewChapter && (
          <div className="space-y-4 mt-4">
            <div className="flex items-center gap-3">
              <Badge variant={chapterStatusMap[previewChapter.status].variant}>
                {chapterStatusMap[previewChapter.status].label}
              </Badge>
              <span className="text-sm text-gray-500">
                {formatLargeNumber(previewChapter.wordCount || 0)} 字
              </span>
            </div>

            {previewChapter.status === 'REVIEWING' && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                {getReviewingReason(previewChapter)}
              </div>
            )}

            {previewChapter.summary && (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 uppercase tracking-wide">
                  章节概要
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {previewChapter.summary}
                </p>
              </div>
            )}

            {previewChapter.content ? (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-6 max-h-[60vh] overflow-y-auto">
                <div className="text-sm text-gray-800 dark:text-gray-200 leading-[2] whitespace-pre-wrap">
                  {previewChapter.content}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">暂无正文内容</p>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              {previewChapter.id ? (
                <>
                  {previewChapter.status === 'REVIEWING' ? (
                    <>
                      <Button variant="outline" onClick={() => openChapterGenerate(previewChapter.id)}>
                        重新生成
                      </Button>
                      <Button variant="primary" onClick={() => openChapterEditor(previewChapter.id)}>
                        去审稿
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" onClick={() => openChapterEditor(previewChapter.id)}>
                      打开章节
                    </Button>
                  )}
                </>
              ) : null}
              <Button variant="outline" onClick={() => {
                closeModal('chapterPreview')
                setPreviewChapter(null)
              }}>
                关闭
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={modals.edit}
        onClose={() => closeModal('edit')}
        title="编辑小说标题"
        description="这里只允许修改小说标题，其余设定由 AI 设定中枢维护。"
        className="max-w-xl"
      >
        <ProjectBaseInfoForm
          defaultValues={{
            title: project.title,
          }}
          onSubmit={handleUpdate}
          onCancel={() => closeModal('edit')}
          loading={submitting}
        />
      </Modal>

      <Modal
        open={modals.delete}
        onClose={() => closeModal('delete')}
        title="删除小说"
        description="确定要删除这本小说吗？此操作不可撤销，所有章节内容也将被删除。"
      >
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => closeModal('delete')}>
            取消
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={submitting}>
            删除
          </Button>
        </div>
      </Modal>

      <Modal
        open={modals.research}
        onClose={() => closeModal('research')}
        title="资料研究"
        className="max-w-3xl"
      >
        <ResearchPanel projectId={projectId} />
      </Modal>

      <Modal
        open={modals.cover}
        onClose={() => closeModal('cover')}
        title="封面生成"
        className="max-w-4xl"
      >
        <CoverGenerator projectId={projectId} onCoverApplied={fetchProject} />
      </Modal>

      <Modal
        open={modals.plotAnalysis}
        onClose={() => closeModal('plotAnalysis')}
        title="拆书分析"
        className="max-w-4xl"
      >
        <AnalysisWorkbench projectId={projectId} />
      </Modal>

      <Modal
        open={modals.review}
        onClose={() => closeModal('review')}
        title="对抗式审稿"
        className="max-w-4xl"
      >
        <ReviewPanel
          projectId={projectId}
          chapters={project.chapters.map(ch => ({
            id: ch.id,
            chapterNumber: ch.chapterNumber,
            title: ch.title,
          }))}
        />
      </Modal>

      <Modal
        open={modals.deslop}
        onClose={() => closeModal('deslop')}
        title="文风精修"
        className="max-w-4xl"
      >
        <DeslopPanel projectId={projectId} />
      </Modal>

      <Modal
        open={modals.batchDeslop}
        onClose={() => closeModal('batchDeslop')}
        title="批量精修"
        description={`选择已完成章节进行批量精修。共 ${project.chapters.filter(c => c.status === 'COMPLETED' && c.content).length} 章可处理。`}
        className="max-w-3xl"
      >
        <BatchDeslopPanel
          projectId={projectId}
          chapters={project.chapters}
          onCompleted={fetchProject}
        />
      </Modal>

      <Modal
        open={modals.export}
        onClose={() => closeModal('export')}
        title="多平台导出"
        className="max-w-2xl"
      >
        <ExportPanel
          projectId={projectId}
          projectTitle={project.title}
          chapterCount={project.chapters.length}
        />
      </Modal>

      <Toolbox
        open={modals.toolbox}
        onClose={() => closeModal('toolbox')}
        tools={toolboxTools}
      />
    </>
  )
}
