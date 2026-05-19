import { prisma } from '@/lib/prisma'
import { StorySteering, Platform } from '@/types'
import { applySteering, getSteeringSummary } from '@/lib/engine/story-steering'
import { getPlatformTemplate } from '@/lib/engine/platform-style'

interface DirectorContext {
  chapterNumber: number
  steeringPrompt: string
  platformConfig: string
  arcInfo: string
  villainInfo: string
  worldInfo: string
  progressInfo: string
  fullDirective: string
}

export async function directChapter(chapterNumber: number, projectId: number): Promise<DirectorContext> {
  const project = await prisma.novelProject.findUnique({
    where: { id: projectId },
    include: {
      arcPlans: { orderBy: { arcNumber: 'asc' } },
      villains: true,
      worldState: true,
      bookBlueprint: true,
      chapters: { orderBy: { chapterNumber: 'asc' } },
    },
  })

  if (!project) throw new Error(`项目 ${projectId} 不存在`)

  const currentArc = project.arcPlans.find(a => !a.isCompleted) || project.arcPlans[0]
  const steering: StorySteering = {
    pace: project.pace || 0.5,
    darkness: project.darkness || 0.3,
    humor: project.humor || 0.3,
    romance: project.romance || 0.2,
    powerGrowth: project.powerGrowth || 0.5,
    conflictIntensity: project.conflictIntensity || 0.5,
    mysteryDensity: project.mysteryDensity || 0.3,
  }

  const platform = (project.platform || 'qidian') as Platform
  const template = getPlatformTemplate(platform)

  const totalChapters = project.chapters.length
  const estimatedTotal = project.targetWordCount
    ? Math.ceil(project.targetWordCount / project.chapterWordCount)
    : 100
  const progressRatio = estimatedTotal > 0 ? totalChapters / estimatedTotal : 0

  const activeVillains = project.villains.filter(v => v.lifecycle === 'active')
  const escapedVillains = project.villains.filter(v => v.lifecycle === 'escaped')

  const steeringSummary = getSteeringSummary(steering)
  const steeringPrompt = applySteering('', steering)

  const platformConfig = `[平台配置]
平台：${platform}
节奏：${template.pace}
每章字数：${template.chapterWordTarget}字
爽点密度：${template.slapFaceDensity}
钩子密度：${template.cliffhangerDensity}`

  const arcInfo = currentArc
    ? `[当前阶段]
Arc ${currentArc.arcNumber}: ${currentArc.name}
阶段：${currentArc.stage}
批次大小：${currentArc.batchSize}
目标：${currentArc.goals.join('、')}
关键事件：${currentArc.keyEvents.join('、')}`
    : `[当前阶段]
初始阶段，尚未规划Arc`

  const villainInfo = `[反派状态]
活跃反派：${activeVillains.length > 0 ? activeVillains.map(v => v.name).join('、') : '暂无'}
${escapedVillains.length > 0 ? `逃脱反派（可复用）：${escapedVillains.map(v => v.name).join('、')}` : ''}
${progressRatio < 0.7 ? '当前进度低于70%，终极Boss暂不出场' : '可考虑引入终极Boss线索'}`

  const worldInfo = project.worldState
    ? `[世界状态]
地图层级：${project.worldState.mapLevel}/10
势力数量：${project.worldState.factionCount}
修炼上限：${project.worldState.powerLevel}/10
文明层级：${project.worldState.civilizationLevel}/10`
    : `[世界状态]
初始世界，待扩张`

  const blueprintInfo = project.bookBlueprint
    ? `[蓝图]
核心卖点：${project.bookBlueprint.corePitch}
世界方向：${project.bookBlueprint.worldDirection || '待定'}
主线方向：${project.bookBlueprint.mainlineDirection || '待定'}`
    : ''

  const progressInfo = `[进度]
当前章节：第${chapterNumber}章
总已完成：${totalChapters}章
预估总章：${estimatedTotal}章
进度：${Math.round(progressRatio * 100)}%
风格：${steeringSummary}`

  const fullDirective = [
    `第${chapterNumber}章 导演指令`,
    blueprintInfo,
    arcInfo,
    platformConfig,
    worldInfo,
    villainInfo,
    progressInfo,
    steeringPrompt,
  ].filter(Boolean).join('\n\n')

  return {
    chapterNumber,
    steeringPrompt,
    platformConfig,
    arcInfo,
    villainInfo,
    worldInfo,
    progressInfo,
    fullDirective,
  }
}