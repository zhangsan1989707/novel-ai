import { AnalysisDimension } from '@/types'

export interface BookAnalysisFallbackProject {
  title: string
  genre?: string | null
  outline?: string | null
  outlineStages?: unknown
  worldSetting?: string | null
  powerSystem?: string | null
  protagonistProfile?: string | null
  protagonistGoal?: string | null
  antagonistSetting?: string | null
  endingPlan?: string | null
  writingPrompt?: string | null
  chapters?: Array<{
    chapterNumber: number
    title: string
    summary?: string | null
  }>
}

const REFUSAL_PATTERNS = [
  'high risk',
  'considered high risk',
  'safety',
  'policy',
  'rejected',
  'declined',
  'not able to assist',
  'cannot assist',
]

export function isRefusalContent(rawContent?: string | null): boolean {
  if (!rawContent) return false
  const normalized = rawContent.toLowerCase()
  return REFUSAL_PATTERNS.some(pattern => normalized.includes(pattern))
}

export function buildFallbackAnalysisData(
  project: BookAnalysisFallbackProject,
  dimension: AnalysisDimension
): Record<string, unknown> {
  const chapters = [...(project.chapters || [])].sort((a, b) => a.chapterNumber - b.chapterNumber)
  const totalChapters = Math.max(chapters.length, 1)

  switch (dimension) {
    case AnalysisDimension.STORY_OVERVIEW:
      return {
        positioning: {
          genreLabel: project.genre || '题材未标注',
          targetReader: '当前分析结果为基础回填',
          coreHook: firstMeaningfulText([project.writingPrompt, project.outline, project.protagonistProfile, project.title]),
          sellingPoints: compactList([
            project.genre ? `题材：${project.genre}` : '',
            project.worldSetting ? '已有世界观设定' : '',
            project.protagonistProfile ? '已有主角设定' : '',
          ]),
        },
        outline: {
          premise: firstMeaningfulText([project.outline, project.writingPrompt, `围绕《${project.title}》展开`]),
          coreConflict: firstMeaningfulText([project.antagonistSetting, project.protagonistGoal, '模型拒绝后等待重新分析']),
          goalLine: firstMeaningfulText([project.protagonistGoal, '主角目标待补充']),
          stageBreakdown: buildStageBreakdown(chapters),
          endingShape: firstMeaningfulText([project.endingPlan, '开放式收束/结局待补充']),
        },
        strengths: compactList([
          project.genre ? `题材明确：${project.genre}` : '',
          chapters.length > 0 ? `已有 ${chapters.length} 章内容可供拆解` : '',
          project.worldSetting ? '已有世界观设定' : '',
        ]),
        risks: [
          '模型返回高风险拒绝，当前为项目基础信息回填',
          chapters.length === 0 ? '缺少章节内容，结构判断会偏弱' : '建议重新分析以获取完整 AI 结论',
        ],
        summary: '当前未拿到结构化拆书结果，先用项目基础设定与章节元数据回填故事总览。',
      }

    case AnalysisDimension.CHARACTER_RELATION: {
      const characters = compactList([
        project.protagonistProfile
          ? {
              name: '主角',
              role: 'protagonist',
              importance: 1,
              description: project.protagonistProfile,
              relationships: project.antagonistSetting
                ? [{ target: '主要反派', type: '对立', description: '回填状态下的核心对抗关系' }]
                : [],
            }
          : null,
        project.antagonistSetting
          ? {
              name: '主要反派',
              role: 'antagonist',
              importance: 2,
              description: project.antagonistSetting,
              relationships: project.protagonistProfile
                ? [{ target: '主角', type: '对立', description: '回填状态下的核心冲突源' }]
                : [],
            }
          : null,
      ])

      return {
        characters: characters.length > 0
          ? characters
          : [
              {
                name: project.title,
                role: 'protagonist',
                importance: 1,
                description: '模型拒绝后仅保留项目标题作为人物占位信息',
                relationships: [],
              },
            ],
        summary: '当前未获得模型结构化人物分析，使用项目设定回填核心关系。',
      }
    }

    case AnalysisDimension.CHARACTER_ARC:
      return {
        protagonistArc: {
          startState: firstMeaningfulText([project.protagonistProfile, '初始状态待补充']),
          growthStages: compactList([
            '开篇建立人物处境',
            '中段遭遇外部压力',
            '后段形成阶段性蜕变',
          ]),
          turningPoints: buildTurnPoints(chapters),
          endState: firstMeaningfulText([project.endingPlan, '终态待补充']),
        },
        supportingArcs: [],
        antagonistPressure: {
          mainAntagonist: firstMeaningfulText([project.antagonistSetting, '主要反派待补充']),
          pressureSources: compactList([
            project.antagonistSetting ? '设定压迫' : '',
            chapters.length > 0 ? '章节冲突推进' : '',
          ]),
          effectiveness: '模型拒绝，未能给出完整评估',
        },
        summary: '角色成长线使用基础回填结果，建议重新执行拆书分析。',
      }

    case AnalysisDimension.PLOT_LINE:
      return {
        mainPlot: [
          {
            title: '主线推进',
            keyEvents: chapters.slice(0, Math.min(5, chapters.length)).map(ch => `第${ch.chapterNumber}章 ${ch.title}`),
            emotionalArc: '当前为基础回填，未获得模型的情感弧线分析',
          },
        ],
        subPlots: [],
        timeline: chapters.slice(0, Math.min(10, chapters.length)).map((ch, index) => ({
          event: ch.summary || ch.title || `第${ch.chapterNumber}章`,
          chapter: ch.chapterNumber,
          significance: index === 0 || index === chapters.length - 1 ? 'major' : 'minor',
        })),
        turningPoints: buildTurnPoints(chapters),
      }

    case AnalysisDimension.FORESHADOWING:
      return {
        items: chapters.slice(0, Math.min(6, chapters.length)).map((ch, index) => ({
          setup: ch.title || `第${ch.chapterNumber}章`,
          description: ch.summary || '当前为基础回填，未生成结构化伏笔分析',
          payoff: '待回收',
          chapter: ch.chapterNumber,
          importance: index === 0 ? 'major' : 'minor',
          type: 'plot',
        })),
        unresolved: chapters.length > 0 ? ['模型拒绝后未能生成伏笔回收判断'] : ['暂无章节内容'],
        payoffQuality: '基础回填，建议重新分析',
      }

    case AnalysisDimension.CHAPTER_STRUCTURE:
      return {
        chapters: chapters.map((ch, index) => ({
          number: ch.chapterNumber,
          title: ch.title,
          function: classifyChapterFunction(index, totalChapters),
          keyEvents: compactList([ch.summary || ch.title]),
          wordCount: undefined,
          emotionalBeat: classifyChapterBeat(index, totalChapters),
        })),
        arcAnalysis: `共有 ${chapters.length} 章，当前显示为基础章节结构回填。`,
        pacingAssessment: '模型拒绝，未能产出完整节奏评估',
        slowSections: buildSectionBuckets(totalChapters, 'slow'),
        peakSections: buildSectionBuckets(totalChapters, 'peak'),
      }

    case AnalysisDimension.READING_EXPERIENCE:
      return {
        scores: {
          openingHook: 62,
          pacing: 60,
          immersion: 61,
          chapterEndingHook: 60,
          readerRetention: 61,
        },
        readingFeel: {
          hookSummary: '当前为基础回填，未获得模型对开篇抓力的正式评分',
          wowPointSummary: '建议重新分析后再评估爽点和满足感',
          fatigueSummary: chapters.length > 12 ? '长篇回填场景下建议重跑模型以识别疲劳段' : '当前未生成疲劳段判断',
          chapterEndingSummary: '当前为基础回填，章尾钩子强度待模型复核',
        },
        highlightChapters: chapters.slice(0, Math.min(3, chapters.length)).map(ch => ({
          chapter: ch.chapterNumber,
          reason: ch.summary || ch.title || '章节高光占位',
        })),
        fatigueChapters: [],
        readerTakeaway: '模型未返回阅读体验分析，当前仅提供基础回填结果。',
      }

    case AnalysisDimension.WORLD_SETTING:
      return {
        settings: compactList([
          project.worldSetting
            ? {
                name: '世界观设定',
                description: project.worldSetting,
                rules: compactList([project.powerSystem || '']),
                firstAppear: chapterMarker(chapters[0]?.chapterNumber),
              }
            : null,
          project.powerSystem
            ? {
                name: '力量体系',
                description: project.powerSystem,
                rules: [],
                firstAppear: chapterMarker(chapters[0]?.chapterNumber),
              }
            : null,
        ]),
        powerSystem: {
          name: project.powerSystem || '力量体系待补充',
          levels: [],
          rules: compactList([project.powerSystem || '']),
        },
        locations: [],
        consistency: project.worldSetting ? '基础回填：已有世界观信息，但模型未返回完整一致性判断' : '模型拒绝后待重新分析',
      }
  }
}

function firstMeaningfulText(values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return ''
}

function compactList<T>(items: Array<T | null | undefined | ''>): T[] {
  return items.filter((item): item is T => item !== null && item !== undefined && item !== '')
}

function buildStageBreakdown(chapters: Array<{ chapterNumber: number; title: string }>) {
  if (chapters.length === 0) {
    return [
      { stage: '开篇', chapterRange: '1-10', summary: '无章节数据时的基础回填' },
    ]
  }

  const total = chapters.length
  const ranges = [
    [1, Math.max(1, Math.floor(total * 0.2))],
    [Math.max(1, Math.floor(total * 0.2) + 1), Math.max(1, Math.floor(total * 0.5))],
    [Math.max(1, Math.floor(total * 0.5) + 1), Math.max(1, Math.floor(total * 0.8))],
    [Math.max(1, Math.floor(total * 0.8) + 1), total],
  ]

  return ranges.map(([start, end], index) => ({
    stage: ['开篇', '发展', '转折', '收束'][index],
    chapterRange: `${start}-${Math.max(start, end)}`,
    summary: chapters.slice(Math.max(0, start - 1), Math.max(0, end))
      .map(ch => ch.title)
      .filter(Boolean)
      .slice(0, 2)
      .join('、') || '章节元数据回填',
  }))
}

function buildTurnPoints(chapters: Array<{ chapterNumber: number; title: string }>) {
  if (chapters.length === 0) {
    return [{ chapter: 1, event: '模型拒绝，待重新分析' }]
  }

  const first = chapters[0]
  const middle = chapters[Math.floor(chapters.length / 2)]
  const last = chapters[chapters.length - 1]

  const points = [first, middle, last].filter((chapter, index, arr) => chapter && arr.findIndex(item => item?.chapterNumber === chapter.chapterNumber) === index)

  return points.map(ch => ({
    chapter: ch.chapterNumber,
    event: ch.title || `第${ch.chapterNumber}章`,
  }))
}

function classifyChapterFunction(index: number, total: number) {
  if (total <= 1) return 'setup'
  const ratio = (index + 1) / total
  if (ratio <= 0.2) return 'setup'
  if (ratio <= 0.7) return 'development'
  if (ratio <= 0.9) return 'climax'
  return 'resolution'
}

function classifyChapterBeat(index: number, total: number) {
  if (total <= 1) return '开篇'
  const ratio = (index + 1) / total
  if (ratio <= 0.2) return '开篇铺垫'
  if (ratio <= 0.7) return '推进发展'
  if (ratio <= 0.9) return '冲突升级'
  return '收束回落'
}

function buildSectionBuckets(total: number, kind: 'slow' | 'peak') {
  if (total <= 0) return []
  if (kind === 'slow') {
    if (total < 8) return []
    return [{ chapterRange: `3-${Math.max(3, Math.floor(total * 0.6))}`, reason: '基础回填，等待模型复核' }]
  }
  return [{ chapterRange: `${Math.max(1, Math.floor(total * 0.7))}-${total}`, reason: '基础回填，高点待模型复核' }]
}

function chapterMarker(chapterNumber?: number) {
  if (!chapterNumber || chapterNumber <= 0) return '第1章'
  return `第${chapterNumber}章`
}
