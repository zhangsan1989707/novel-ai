import { prisma } from '@/lib/prisma'
import { ProjectStatus } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import type { HookContext, HookResult } from './types'
import { countChapterWords, syncProjectChapterWordCount } from '@/lib/novel/chapter-word-count'

export async function onProjectCreate(context: HookContext): Promise<HookResult> {
  const { projectId } = context
  if (!projectId) {
    return { action: 'continue' }
  }

  const project = await prisma.novelProject.findUnique({
    where: { id: projectId },
  })

  if (!project) {
    return { action: 'continue' }
  }

  const missingSettings: string[] = []
  if (!project.worldSetting) missingSettings.push('世界观设定')
  if (!project.protagonistProfile) missingSettings.push('主角人设')
  if (!project.outline) missingSettings.push('大纲')

  if (missingSettings.length > 0) {
    return {
      action: 'warn',
      message: `项目缺少以下设定：${missingSettings.join('、')}，建议补充后再开始生成`,
      data: { missingSettings },
    }
  }

  return { action: 'continue' }
}

export async function onChapterGenerateStart(context: HookContext): Promise<HookResult> {
  const { projectId, chapterNo } = context
  if (!projectId || !chapterNo) {
    return { action: 'continue' }
  }

  const project = await prisma.novelProject.findUnique({
    where: { id: projectId },
  })

  if (!project) {
    return { action: 'block', message: '项目不存在' }
  }

  const warnings: string[] = []
  if (!project.worldSetting) warnings.push('世界观未设定')
  if (!project.protagonistProfile) warnings.push('主角未设定')
  if (!project.outline) warnings.push('大纲不存在')

  if (warnings.length > 0) {
    return {
      action: 'warn',
      message: `检测到设定缺口：${warnings.join('、')}`,
      data: { warnings },
    }
  }

  if (chapterNo > 1) {
    const previousReport = await prisma.chapterCompletionReport.findUnique({
      where: {
        projectId_chapterNo: {
          projectId,
          chapterNo: chapterNo - 1,
        },
      },
    })

    const previousChapter = await prisma.novelChapter.findUnique({
      where: {
        projectId_chapterNumber: {
          projectId,
          chapterNumber: chapterNo - 1,
        },
      },
      select: { status: true },
    })

    if (!previousChapter || previousChapter.status !== 'COMPLETED' || (previousReport && previousReport.completionScore < 80)) {
      return {
        action: 'block',
        message: `第${chapterNo - 1}章未满足完成条件，不允许自动进入下一章`,
        data: {
          previousChapterStatus: previousChapter?.status ?? null,
          previousCompletionScore: previousReport?.completionScore ?? null,
        },
      }
    }
  }

  return { action: 'continue' }
}

export async function onChapterGenerateEnd(context: HookContext): Promise<HookResult> {
  const { projectId, content } = context
  if (!projectId) {
    return { action: 'continue' }
  }

  await prisma.novelProject.update({
    where: { id: projectId },
    data: { status: ProjectStatus.WRITING },
  })

  if (content) {
    await syncProjectChapterWordCount(prisma, projectId)
  }

  return {
    action: 'continue',
    message: '章节生成完成，项目状态已更新',
    data: { wordCount: countChapterWords(content) },
  }
}

export async function onStoryGapDetect(context: HookContext): Promise<HookResult> {
  const { projectId, chapterNo } = context
  if (!projectId) {
    return { action: 'continue' }
  }

  const warnings: string[] = []

  const openPlotlines = await prisma.plotline.findMany({
    where: {
      projectId,
      status: 'OPEN',
      plantedAt: { lt: (chapterNo || 0) - 30 },
    },
  })
  if (openPlotlines.length > 0) {
    warnings.push(`${openPlotlines.length}个伏笔已超过30章未回收，可能已过期`)
  }

  const characters = await prisma.character.findMany({
    where: { projectId },
  })
  const stateConflicts: string[] = []
  for (const char of characters) {
    const state = char.currentState as Record<string, unknown> | null
    if (state && state.location && typeof state.location === 'string') {
      const sameLocation = characters.filter(c => {
        const s = c.currentState as Record<string, unknown> | null
        return s && s.location === state.location && c.id !== char.id
      })
      if (sameLocation.length > 0 && char.role === 'PROTAGONIST') {
        const names = sameLocation.map(c => c.name).join('、')
        stateConflicts.push(`${char.name}和${names}在同一位置但无互动记录`)
      }
    }
  }
  if (stateConflicts.length > 0) {
    warnings.push(`角色状态可能矛盾：${stateConflicts.join('；')}`)
  }

  if (warnings.length > 0) {
    return {
      action: 'warn',
      message: `检测到故事缺口：${warnings.join('；')}`,
      data: { warnings, expiredPlotlineCount: openPlotlines.length },
    }
  }

  return { action: 'continue', message: '未检测到故事缺口' }
}

export async function onPreContextCompress(context: HookContext): Promise<HookResult> {
  const { projectId } = context
  if (!projectId) {
    return { action: 'continue' }
  }

  const storyState = await prisma.storyState.findUnique({
    where: { projectId },
  })

  if (storyState) {
    await prisma.storyEvent.create({
      data: {
        projectId,
        eventType: 'CONTEXT_COMPRESS_SNAPSHOT',
        description: '上下文压缩前保存进度快照',
        metadata: {
          currentChapter: storyState.currentChapter,
          emotionalArc: storyState.emotionalArc,
          mainConflict: storyState.mainConflict,
        } as unknown as Prisma.InputJsonValue,
      },
    })
  }

  return {
    action: 'continue',
    message: '进度快照已保存',
    data: { snapshotChapter: storyState?.currentChapter },
  }
}

export async function onPostContextCompress(): Promise<HookResult> {
  return {
    action: 'warn',
    message: '上下文已压缩，建议读取进度快照以恢复关键信息',
    data: { suggestion: 'read_snapshot' },
  }
}

export async function onPreCommit(context: HookContext): Promise<HookResult> {
  const { content, metadata } = context
  const issues: string[] = []

  if (content) {
    const hardcodedPatterns = /身高\d+cm|体重\d+kg|年龄\d+岁/g
    const matches = content.match(hardcodedPatterns)
    if (matches && matches.length > 3) {
      issues.push('角色属性可能存在硬编码数值过多')
    }
  }

  if (metadata) {
    const requiredFields = ['worldSetting', 'protagonistProfile']
    for (const field of requiredFields) {
      if (!metadata[field]) {
        issues.push(`设定字段 ${field} 未填写`)
      }
    }

    const plotlines = metadata.plotlines as Array<{ planted: boolean; resolved: boolean }> | undefined
    if (plotlines) {
      const unresolved = plotlines.filter(p => p.planted && !p.resolved)
      if (unresolved.length > plotlines.length * 0.8) {
        issues.push('伏笔回收率过低，请检查是否有始有终')
      }
    }
  }

  if (issues.length > 0) {
    return {
      action: 'warn',
      message: `提交前验证发现问题：${issues.join('；')}`,
      data: { issues },
    }
  }

  return { action: 'continue', message: '提交前验证通过' }
}
