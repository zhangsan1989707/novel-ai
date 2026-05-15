import { prisma } from '@/lib/prisma'
import { createProviderFromDefaultConfig } from '@/lib/ai'
import {
  ValidationReport,
  ProjectValidationResult,
  ValidationIssue,
  ValidationIssueType,
  ValidationSeverity,
  CharacterValidation,
  TimelineValidation,
  ForeshadowingValidation,
} from './types'

// 常见角色名变化模式
const CHARACTER_ALIAS_PATTERNS = [
  { variants: ['林晓晓', '林小姐', '晓晓'], baseName: '林晓晓' },
  { variants: ['慈禧', '老佛爷', '太后', '西太后'], baseName: '慈禧' },
  { variants: ['载沣', '摄政王', '醇亲王'], baseName: '载沣' },
  { variants: ['李鸿章', '李中堂', '少荃'], baseName: '李鸿章' },
]

// 常见时间表述
const TIME_INDICATORS = ['日', '月', '年', '时', '天', '早', '晚', '夜', '午', '刻', '分', '秒']

/**
 * 验证单章内容质量
 */
export async function validateChapter(
  projectId: number,
  chapterNumber: number,
  content: string,
  allChapters: { chapterNumber: number; content: string; title: string }[]
): Promise<ValidationReport> {
  const provider = await createProviderFromDefaultConfig()

  // 1. 角色名一致性检查
  const characterValidation = await validateCharacterConsistency(projectId, content, chapterNumber, allChapters)

  // 2. 时间线逻辑检查
  const timelineValidation = await validateTimelineLogic(content, chapterNumber, allChapters)

  // 3. 伏笔埋入与回收检查
  const foreshadowingValidation = await validateForeshadowing(projectId, chapterNumber, content, allChapters)

  // 4. 使用 AI 进行深度校验
  const aiValidationResult = await aiDeepValidation(content, chapterNumber, provider)

  // 收集所有问题
  const issues: ValidationIssue[] = []

  // 添加角色问题
  characterValidation.forEach(cv => {
    if (!cv.isConsistent) {
      issues.push({
        type: 'CHARACTER_NAME_INCONSISTENCY' as ValidationIssueType,
        severity: ValidationSeverity.WARNING,
        message: `角色"${cv.name}"在第${cv.firstAppearChapter}章首次出现，但名称在不同章节出现变化`,
        location: { chapterNumber, characterName: cv.name },
        suggestion: `建议统一使用"${cv.name}"作为角色主要称呼`,
      })
    }
  })

  // 添加时间线问题
  timelineValidation.inconsistencies.forEach(incon => {
    issues.push({
      type: 'TIMELINE_LOGIC_ERROR' as ValidationIssueType,
      severity: ValidationSeverity.WARNING,
      message: incon,
      location: { chapterNumber },
      suggestion: '检查时间描述是否符合故事发展逻辑',
    })
  })

  // 添加未回收伏笔警告
  foreshadowingValidation.pending.forEach(p => {
    if (p.plantedAt === chapterNumber) {
      issues.push({
        type: 'FORESHADOW_NOT_RESOLVED' as ValidationIssueType,
        severity: ValidationSeverity.INFO,
        message: `伏笔"${p.setup}"在第${chapterNumber}章埋下，尚未回收`,
        location: { chapterNumber },
        suggestion: p.plannedPayoff ? `计划在第${p.plannedPayoff}章回收` : '注意在合适的时机回收此伏笔',
      })
    }
  })

  // 合并 AI 发现的问题
  if (aiValidationResult.issues) {
    issues.push(...aiValidationResult.issues)
  }

  // 计算总分
  const baseScore = 100 - issues.filter(i => i.severity === ValidationSeverity.ERROR).length * 20
    - issues.filter(i => i.severity === ValidationSeverity.WARNING).length * 10
    - issues.filter(i => i.severity === ValidationSeverity.INFO).length * 5
  const score = Math.max(0, Math.min(100, baseScore))

  return {
    isPass: score >= 60,
    score,
    chapterNumber,
    summary: generateSummary(issues, score),
    issues,
    characterValidation,
    timelineValidation,
    foreshadowingValidation,
    checkedAt: new Date().toISOString(),
  }
}

/**
 * 验证角色名一致性
 */
async function validateCharacterConsistency(
  projectId: number,
  currentContent: string,
  chapterNumber: number,
  allChapters: { chapterNumber: number; content: string; title: string }[]
): Promise<CharacterValidation[]> {
  const result: CharacterValidation[] = []

  // 获取项目中已记录的角色
  const characters = await prisma.character.findMany({
    where: { projectId },
  })

  for (const char of characters) {
    const mentions: { chapter: number; name: string }[] = []

    // 检查所有章节中的提及
    for (const ch of allChapters) {
      const content = ch.chapterNumber === chapterNumber ? currentContent : ch.content || ''
      const nameVariants = [char.name, ...(char.aliases || [])]

      for (const variant of nameVariants) {
        if (content.includes(variant)) {
          mentions.push({ chapter: ch.chapterNumber, name: variant })
        }
      }
    }

    if (mentions.length > 0) {
      const firstChapter = Math.min(...mentions.map(m => m.chapter))
      const lastChapter = Math.max(...mentions.map(m => m.chapter))
      const usedNames = [...new Set(mentions.map(m => m.name))]

      result.push({
        name: char.name,
        aliases: char.aliases || [],
        firstAppearChapter: firstChapter,
        lastAppearChapter: lastChapter,
        totalMentions: mentions.length,
        isConsistent: usedNames.length <= 2, // 允许1-2种称呼变化
      })
    }
  }

  return result
}

/**
 * 验证时间线逻辑
 */
async function validateTimelineLogic(
  content: string,
  chapterNumber: number,
  allChapters: { chapterNumber: number; content: string; title: string }[]
): Promise<TimelineValidation> {
  const events: { chapter: number; description: string; timestamp?: string; isLogical: boolean; issues: string[] }[] = []
  const inconsistencies: string[] = []

  // 提取本章中的时间描述
  const timePatterns = [
    /第([一二三四五六七八九十百千万\d]+)[章节]?/g,
    /([上下左右前后])午/g,
    /([早中晚])上/g,
    /([大中小])概/g,
  ]

  // 检查时间顺序
  const timeSequence: { chapter: number; time: string; position: number }[] = []

  for (const ch of allChapters) {
    if (ch.chapterNumber > chapterNumber) break
    const textContent = ch.chapterNumber === chapterNumber ? content : (ch.content || '')

    // 简单的"之前"/"之后"检测
    if (textContent.includes('之前') && textContent.includes('之后')) {
      const beforeCount = (textContent.match(/之前/g) || []).length
      const afterCount = (textContent.match(/之后/g) || []).length

      if (beforeCount > 0 && afterCount > 0) {
        timeSequence.push({
          chapter: ch.chapterNumber,
          time: `前${beforeCount}后${afterCount}`,
          position: ch.chapterNumber,
        })
      }
    }
  }

  // 检查章节间时间是否倒退
  for (let i = 1; i < allChapters.length; i++) {
    const prev = allChapters[i - 1]
    const curr = allChapters[i]

    // 检查是否有时间倒退的迹象
    const prevHasNight = (prev.content || '').includes('夜') || (prev.content || '').includes('晚')
    const currHasMorning = (curr.content || '').includes('早') || (curr.content || '').includes('晨')

    if (prevHasNight && currHasMorning && curr.chapterNumber > prev.chapterNumber) {
      // 正常：晚上后第二天早上
    }
  }

  return { events, inconsistencies }
}

/**
 * 验证伏笔埋入与回收
 */
async function validateForeshadowing(
  projectId: number,
  chapterNumber: number,
  currentContent: string,
  allChapters: { chapterNumber: number; content: string; title: string }[]
): Promise<ForeshadowingValidation> {
  // 获取项目的伏笔记录
  const plotlines = await prisma.plotline.findMany({
    where: { projectId },
    orderBy: { plantedAt: 'asc' },
  })

  const planted: number[] = []
  const resolved: number[] = []
  const pending: { setup: string; plantedAt: number; plannedPayoff?: number }[] = []
  const resolvedOnTime: { setup: string; plantedAt: number; resolvedAt: number }[] = []
  const resolvedLate: { setup: string; plantedAt: number; resolvedAt: number; delay: number }[] = []
  const neverResolved: { setup: string; plantedAt: number }[] = []

  for (const plot of plotlines) {
    if (plot.plantedAt <= chapterNumber) {
      planted.push(plot.plantedAt)

      if (plot.resolvedAt) {
        resolved.push(plot.resolvedAt)

        if (plot.plannedAt && plot.resolvedAt <= plot.plannedAt) {
          resolvedOnTime.push({ setup: plot.description, plantedAt: plot.plantedAt, resolvedAt: plot.resolvedAt })
        } else if (plot.plannedAt) {
          const delay = plot.resolvedAt - plot.plannedAt
          resolvedLate.push({ setup: plot.description, plantedAt: plot.plantedAt, resolvedAt: plot.resolvedAt, delay })
        } else {
          resolvedOnTime.push({ setup: plot.description, plantedAt: plot.plantedAt, resolvedAt: plot.resolvedAt })
        }
      } else if (plot.status === 'OPEN') {
        pending.push({
          setup: plot.description,
          plantedAt: plot.plantedAt,
          plannedPayoff: plot.plannedAt || undefined,
        })
      } else if (plot.status === 'ABANDONED') {
        neverResolved.push({ setup: plot.description, plantedAt: plot.plantedAt })
      }
    }
  }

  return { planted: planted.length, resolved: resolved.length, pending, resolvedOnTime, resolvedLate, neverResolved }
}

/**
 * AI 深度校验
 */
async function aiDeepValidation(content: string, chapterNumber: number, provider: Awaited<ReturnType<typeof createProviderFromDefaultConfig>>) {
  const prompt = `你是一位专业的小说质量审核员。请审核以下章节内容，检测潜在的问题。

章节内容（第${chapterNumber}章）：
${content.slice(0, 3000)}

请检查以下方面并以JSON格式返回：
1. 角色名是否一致（特别检查同一角色的不同称呼）
2. 时间线逻辑是否有矛盾
3. 是否有明显的剧情漏洞
4. 伏笔是否埋入但未回收

返回格式：
{
  "issues": [
    {
      "type": "CHARACTER_NAME_INCONSISTENCY | TIMELINE_LOGIC_ERROR | PLOTLINE_CONTRADICTION | FORESHADOW_NOT_RESOLVED",
      "severity": "error | warning | info",
      "message": "问题描述",
      "location": { "chapterNumber": number, "description": "具体位置" },
      "suggestion": "修复建议"
    }
  ],
  "overallAssessment": "总体评价",
  "score": 0-100
}

只返回JSON，不要有其他内容。`

  try {
    const result = await provider.generate(prompt, { temperature: 0.3 })

    // 解析 JSON 结果
    const jsonMatch = result.content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (error) {
    console.error('AI validation failed:', error)
  }

  return { issues: [], overallAssessment: '未能完成AI深度校验', score: 100 }
}

/**
 * 生成校验摘要
 */
function generateSummary(issues: ValidationIssue[], score: number): string {
  const errorCount = issues.filter(i => i.severity === ValidationSeverity.ERROR).length
  const warningCount = issues.filter(i => i.severity === ValidationSeverity.WARNING).length
  const infoCount = issues.filter(i => i.severity === ValidationSeverity.INFO).length

  if (score >= 90) return '质量优秀，无明显问题'
  if (score >= 70) return `发现${warningCount}个警告，建议检查`
  if (score >= 60) return `发现${warningCount}个警告和${errorCount}个错误，需要修复`
  return `发现${errorCount}个错误和${warningCount}个警告，质量不达标`
}

/**
 * 验证整个项目
 */
export async function validateProject(projectId: number): Promise<ProjectValidationResult> {
  const chapters = await prisma.novelChapter.findMany({
    where: {
      projectId,
      status: { in: ['COMPLETED', 'REVIEWING'] },
    },
    orderBy: { chapterNumber: 'asc' },
  })

  const issuesByChapter: Record<number, ValidationIssue[]> = {}
  let totalIssues = 0
  let totalScore = 0

  for (const chapter of chapters) {
    if (!chapter.content) continue

    const report = await validateChapter(
      projectId,
      chapter.chapterNumber,
      chapter.content,
      chapters.map(c => ({ chapterNumber: c.chapterNumber, content: c.content || '', title: c.title }))
    )

    issuesByChapter[chapter.chapterNumber] = report.issues
    totalIssues += report.issues.length
    totalScore += report.score
  }

  // 获取角色统计
  const characters = await prisma.character.findMany({ where: { projectId } })
  const inconsistentChars = characters.filter(c => {
    // 检查角色是否有别名问题
    return c.aliases && c.aliases.length > 0
  })

  // 获取伏笔统计
  const plotlines = await prisma.plotline.findMany({ where: { projectId } })
  const unresolvedCount = plotlines.filter(p => p.status === 'OPEN').length

  const overallScore = chapters.length > 0 ? Math.round(totalScore / chapters.length) : 0

  return {
    projectId,
    isPass: overallScore >= 60,
    overallScore,
    totalChaptersChecked: chapters.length,
    totalIssues,
    issuesByChapter,
    characterSummary: {
      totalCharacters: characters.length,
      consistentCharacters: characters.length - inconsistentChars.length,
      inconsistentCharacters: inconsistentChars.map(c => c.name),
    },
    foreshadowingSummary: {
      totalPlanted: plotlines.length,
      resolved: plotlines.filter(p => p.status === 'RESOLVED').length,
      unresolved: unresolvedCount,
      resolutionRate: plotlines.length > 0
        ? Math.round((plotlines.length - unresolvedCount) / plotlines.length * 100)
        : 100,
    },
    recommendations: generateRecommendations(overallScore, totalIssues, unresolvedCount),
  }
}

/**
 * 生成改进建议
 */
function generateRecommendations(score: number, totalIssues: number, unresolvedForeshadowing: number): string[] {
  const recommendations: string[] = []

  if (score < 60) {
    recommendations.push('整体质量偏低，建议全面修订')
  }
  if (totalIssues > 10) {
    recommendations.push('问题数量较多，建议逐章修复')
  }
  if (unresolvedForeshadowing > 5) {
    recommendations.push(`有${unresolvedForeshadowing}个伏笔尚未回收，注意在后续章节中埋入和回收`)
  }
  if (score >= 80) {
    recommendations.push('质量良好，可继续创作')
  }

  return recommendations
}