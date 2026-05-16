import { prisma } from '../prisma'
import { logger } from '../logger'
import type { AgentType, NovelChapter } from '@prisma/client'

// ================================
// 草稿状态类型
// ================================

export interface DraftState {
  projectId: number
  chapterNo: number
  currentAgent: AgentType | null
  completedAgents: AgentType[]
  partialOutputs: Partial<Record<AgentType, unknown>>
  metadata: Record<string, unknown>
  lastUpdatedAt: number
}

// ================================
// 草稿管理器
// ================================

export class DraftManager {
  private static readonly DRAFT_PREFIX = 'novel-draft'

  private static getKey(projectId: number, chapterNo: number): string {
    return `${this.DRAFT_PREFIX}:${projectId}:${chapterNo}`
  }

  // ================================
  // 保存阶段输出
  // ================================

  static async saveStageOutput(
    projectId: number,
    chapterNo: number,
    agentType: AgentType,
    output: unknown
  ): Promise<void> {
    try {
      // 1. 更新数据库中的中间状态
      await this.updateChapterState(
        projectId,
        chapterNo,
        agentType,
        output
      )

      logger.info(
        { projectId, chapterNo, agentType },
        'Stage output SAVED'
      )
    } catch (error) {
      logger.error(
        { projectId, chapterNo, agentType, error },
        'Failed to save stage output'
      )
    }
  }

  // ================================
  // 更新章节状态
  // ================================

  private static async updateChapterState(
    projectId: number,
    chapterNo: number,
    agentType: AgentType,
    output: unknown
  ): Promise<void> {
    const chapter = await prisma.novelChapter.findUnique({
      where: {
        projectId_chapterNumber: {
          projectId,
          chapterNumber: chapterNo
        }
      }
    })

    if (!chapter) {
      throw new Error('Chapter not found')
    }

    // 根据 Agent 类型更新对应字段
    const updateData: any = {
      lastAgentType: agentType
    }

    switch (agentType) {
      case 'PLANNER':
        updateData.chapterOutline = output as any
        break
      case 'WRITER':
        updateData.content = typeof output === 'string' 
          ? output 
          : (output as any)?.content
        break
      case 'POLISHER':
        updateData.content = typeof output === 'string' 
          ? output 
          : (output as any)?.content
        break
      case 'VALIDATOR':
        updateData.validationReport = output as any
        break
      case 'SUMMARIZER':
        // 摘要由单独的流程处理
        break
    }

    await prisma.novelChapter.update({
      where: { id: chapter.id },
      data: updateData
    })
  }

  // ================================
  // 获取草稿状态
  // ================================

  static async getDraftState(
    projectId: number,
    chapterNo: number
  ): Promise<DraftState | null> {
    try {
      const chapter = await prisma.novelChapter.findUnique({
        where: {
          projectId_chapterNumber: {
            projectId,
            chapterNumber: chapterNo
          }
        }
      })

      if (!chapter) {
        return null
      }

      const completedAgents: AgentType[] = []
      const partialOutputs: Partial<Record<AgentType, unknown>> = {}

      if (chapter.chapterOutline) {
        completedAgents.push('PLANNER')
        partialOutputs.PLANNER = chapter.chapterOutline
      }

      if (chapter.content && !chapter.validationReport) {
        completedAgents.push('WRITER')
        partialOutputs.WRITER = chapter.content
      }

      if (chapter.validationReport) {
        completedAgents.push('POLISHER', 'VALIDATOR')
        partialOutputs.POLISHER = chapter.content
        partialOutputs.VALIDATOR = chapter.validationReport
      }

      return {
        projectId,
        chapterNo,
        currentAgent: chapter.lastAgentType || null,
        completedAgents,
        partialOutputs,
        metadata: {},
        lastUpdatedAt: chapter.updatedAt.getTime()
      }
    } catch (error) {
      logger.error(
        { projectId, chapterNo, error },
        'Failed to get draft state'
      )
      return null
    }
  }

  // ================================
  // 从断点恢复
  // ================================

  static async resumeFromBreakpoint(
    projectId: number,
    chapterNo: number
  ): Promise<{ draftState: DraftState | null; resumeFrom: AgentType | null }> {
    const draftState = await this.getDraftState(projectId, chapterNo)

    if (!draftState) {
      return { draftState: null, resumeFrom: null }
    }

    // 确定从哪里恢复
    let resumeFrom: AgentType | null = null

    if (!draftState.completedAgents.includes('PLANNER')) {
      resumeFrom = 'PLANNER'
    } else if (!draftState.completedAgents.includes('WRITER')) {
      resumeFrom = 'WRITER'
    } else if (!draftState.completedAgents.includes('POLISHER')) {
      resumeFrom = 'POLISHER'
    } else if (!draftState.completedAgents.includes('VALIDATOR')) {
      resumeFrom = 'VALIDATOR'
    }

    logger.info(
      { projectId, chapterNo, resumeFrom, completed: draftState.completedAgents },
      'Resuming from breakpoint'
    )

    return { draftState, resumeFrom }
  }

  // ================================
  // 清除草稿
  // ================================

  static async clearDraft(projectId: number, chapterNo: number): Promise<void> {
    try {
      logger.info(
        { projectId, chapterNo },
        'Clearing draft'
      )
    } catch (error) {
      logger.error(
        { projectId, chapterNo, error },
        'Failed to clear draft'
      )
    }
  }

  // ================================
  // 获取可以恢复的章节
  // ================================

  static async getRecoverableChapters(
    projectId: number
  ): Promise<Array<{ chapterNo: number; lastAgent: AgentType | null; canResume: boolean }>> {
    try {
      const chapters = await prisma.novelChapter.findMany({
        where: {
          projectId,
          OR: [
            { status: 'GENERATING' },
            { status: 'DRAFT', lastAgentType: { not: null } }
          ]
        },
        orderBy: { chapterNumber: 'asc' }
      })

      return chapters.map(chapter => ({
        chapterNo: chapter.chapterNumber,
        lastAgent: chapter.lastAgentType,
        canResume: true
      }))
    } catch (error) {
      logger.error(
        { projectId, error },
        'Failed to get recoverable chapters'
      )
      return []
    }
  }
}

// ================================
// 导出单例
// ================================

export { DraftManager as default }
