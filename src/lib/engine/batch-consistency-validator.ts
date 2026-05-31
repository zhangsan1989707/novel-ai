interface BatchChapter {
  chapterNumber: number
  title: string
  content: string | null
  summary: string | null
}

interface BatchConsistencyReport {
  passed: boolean
  consistencyScore: number
  issues: string[]
  deviationDirection: string | null
  recommendations: string[]
}

const CHARACTER_CONSISTENCY_PROMPT = `分析这批章节中每个角色是否有前后矛盾的行为或性格不一致。重点检查：
1. 同一角色在不同章节中性格突变（如第N章温顺，第N+1章突然暴戾）
2. 关键角色突然消失或没有任何戏份
3. 角色关系突然转变（如第N章是敌人，第N+1章突然成为盟友没有铺垫）`

const PLOT_DIRECTION_PROMPT = `分析这批章节的剧情走向是否符合预期的方向。重点检查：
1. 主线是否被意外提前收束
2. 剧情是否偏离了 Arc Plan 描述的大方向
3. 是否出现了无铺垫的重大事件
4. 章节间剧情是否连贯，没有跳跃`

const EMOTIONAL_SMOOTHNESS_PROMPT = `分析这批章节的情绪起伏是否合理：
1. 相邻章节间的情绪落差是否过大（如上一章极度悲伤，下一章突然轻松愉快）
2. 情绪积累和释放是否符合节奏规律
3. 是否有章节情绪过于平淡或过于激烈，不符合该阶段的预期`

export async function validateBatchConsistency(
  projectId: number,
  batchChapters: BatchChapter[]
): Promise<BatchConsistencyReport> {
  const issues: string[] = []
  const recommendations: string[] = []

  if (batchChapters.length < 2) {
    return {
      passed: true,
      consistencyScore: 100,
      issues: [],
      deviationDirection: null,
      recommendations: [],
    }
  }

  const chaptersWithContent = batchChapters.filter(c => c.content && c.content.length > 100)

  if (chaptersWithContent.length < 2) {
    return {
      passed: true,
      consistencyScore: 100,
      issues: [],
      deviationDirection: null,
      recommendations: ['批次内容不足，无法做一致性分析'],
    }
  }

  const allContent = chaptersWithContent
    .map(c => `【第${c.chapterNumber}章 ${c.title}】\n${c.content?.slice(0, 1000) || ''}`)
    .join('\n\n---\n\n')

  const structuralIssues = checkStructuralConsistency(batchChapters)
  issues.push(...structuralIssues.issues)
  recommendations.push(...structuralIssues.recommendations)

  const contentIssues = checkContentContinuity(batchChapters)
  issues.push(...contentIssues.issues)
  recommendations.push(...contentIssues.recommendations)

  const endingIssues = checkPrematureEnding(batchChapters)
  issues.push(...endingIssues.issues)
  recommendations.push(...endingIssues.recommendations)

  const issueCount = issues.length
  const maxExpectedIssues = Math.max(1, batchChapters.length * 0.3)
  const rawScore = 100 - (issueCount / maxExpectedIssues) * 100
  const consistencyScore = Math.max(0, Math.round(rawScore))

  return {
    passed: consistencyScore >= 60,
    consistencyScore,
    issues,
    deviationDirection: issues.length > 0 ? '待人工确认' : null,
    recommendations,
  }
}

function checkStructuralConsistency(chapters: BatchChapter[]): {
  issues: string[]
  recommendations: string[]
} {
  const issues: string[] = []
  const recommendations: string[] = []

  for (const chapter of chapters) {
    if (!chapter.content || chapter.content.length < 200) {
      issues.push(`第${chapter.chapterNumber}章"${chapter.title}"内容过短（${chapter.content?.length || 0}字符），疑似生成不完整`)
      recommendations.push(`第${chapter.chapterNumber}章需要检查是否被截断未完成`)
    }
  }

  for (let i = 1; i < chapters.length; i++) {
    const prev = chapters[i - 1]
    const curr = chapters[i]
    if (!prev.content || !curr.content) continue

    const prevEnd = prev.content.slice(-100).toLowerCase()
    const currStart = curr.content.slice(0, 100).toLowerCase()

    const prevEndKeywords = ['突然', '就在这时', '此刻', '忽然', '正当']
    const hasHook = prevEndKeywords.some(kw => prevEnd.includes(kw.toLowerCase()))
    if (!hasHook) {
      recommendations.push(`第${prev.chapterNumber}章结尾缺少悬念钩子，影响连贯性`)
    }
  }

  return { issues, recommendations }
}

function checkContentContinuity(chapters: BatchChapter[]): {
  issues: string[]
  recommendations: string[]
} {
  const issues: string[] = []
  const recommendations: string[] = []

  for (let i = 1; i < chapters.length; i++) {
    const prev = chapters[i - 1]
    const curr = chapters[i]
    if (!prev.content || !curr.content) continue

    const prevLastPara = prev.content.slice(Math.max(0, prev.content.length - 300))
    const currFirstPara = curr.content.slice(0, 300)

    const prevLocations = extractLocations(prevLastPara)
    const currLocations = extractLocations(currFirstPara)

    if (prevLocations.size > 0 && currLocations.size > 0) {
      const shared = [...prevLocations].filter(l => currLocations.has(l))
      if (shared.length === 0) {
        recommendations.push(`第${prev.chapterNumber}章结尾和第${curr.chapterNumber}章开头场景切换无过渡，注意空间连贯性`)
      }
    }
  }

  return { issues, recommendations }
}

function checkPrematureEnding(chapters: BatchChapter[]): {
  issues: string[]
  recommendations: string[]
} {
  const issues: string[] = []
  const recommendations: string[] = []

  const FORBIDDEN_PATTERNS = [
    /终于.*完结/,
    /一切.*结束/,
    /尘埃落定/,
    /大结局/,
    /故事.*到此/,
  ]

  for (const chapter of chapters) {
    if (!chapter.content) continue
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(chapter.content)) {
        issues.push(`第${chapter.chapterNumber}章"${chapter.title}"批量一致性检查发现疑似提前收束内容`)
        recommendations.push(`第${chapter.chapterNumber}章需要人工审核，确保非终局内容`)
        break
      }
    }
  }

  return { issues, recommendations }
}

function extractLocations(text: string): Set<string> {
  const locations = new Set<string>()
  const locationPatterns = [
    /在([\u4e00-\u9fa5]{2,6}(?:殿|宫|阁|楼|府|城|镇|村|谷|山|海|林|园|街|市|院|堂|寺|庙|塔|洞|窟|崖|岛|湖|河|沼|原|岭))/g,
    /来到([\u4e00-\u9fa5]{2,6}(?:殿|宫|阁|楼|府|城|镇|村|谷|山|海|林|园|街|市|院|堂|寺|庙|塔|洞|窟|崖|岛|湖|河|沼|原|岭))/g,
    /前往([\u4e00-\u9fa5]{2,6}(?:殿|宫|阁|楼|府|城|镇|村|谷|山|海|林|园|街|市|院|堂|寺|庙|塔|洞|窟|崖|岛|湖|河|沼|原|岭))/g,
  ]

  for (const pattern of locationPatterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      locations.add(match[1])
    }
  }

  return locations
}