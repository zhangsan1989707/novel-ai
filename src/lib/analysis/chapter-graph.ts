export interface ReadingExperienceData {
  scores?: Record<string, number>
  readingFeel?: {
    hookSummary?: string
    wowPointSummary?: string
    fatigueSummary?: string
    chapterEndingSummary?: string
  }
  highlightChapters?: Array<{ chapter?: number; reason?: string }>
  fatigueChapters?: Array<{ chapterRange?: string; reason?: string }>
  readerTakeaway?: string
}

export interface ChapterGraphSource {
  label: string
  tone: 'blue' | 'green' | 'amber' | 'red' | 'purple'
}

export interface ChapterGraphNode {
  chapterNo: number
  title: string
  summary: string
  stageLabel?: string
  tags: string[]
  sources: ChapterGraphSource[]
  confidenceLevel: '高' | '中' | '低'
  supportingNote?: string
}

export interface ChapterGraph {
  nodes: ChapterGraphNode[]
  highConfidenceCount: number
  lowConfidenceCount: number
}

export function buildChapterGraph(input: {
  storyOverview: Record<string, unknown>
  chapterStructure: Record<string, unknown>
  plotLine: Record<string, unknown>
  foreshadowing: Record<string, unknown>
  readingExperience: ReadingExperienceData
  worldSetting: Record<string, unknown>
}): ChapterGraph {
  const nodeMap = new Map<number, ChapterGraphNode>()

  const ensureNode = (chapterNo: number) => {
    if (!nodeMap.has(chapterNo)) {
      nodeMap.set(chapterNo, {
        chapterNo,
        title: `第${chapterNo}章`,
        summary: '',
        tags: [],
        sources: [],
        confidenceLevel: '低',
      })
    }
    return nodeMap.get(chapterNo)!
  }

  const addSource = (chapterNo: number, source: ChapterGraphSource, note?: string, tag?: string) => {
    if (!chapterNo || chapterNo <= 0) return
    const node = ensureNode(chapterNo)
    node.sources.push(source)
    if (tag && !node.tags.includes(tag)) node.tags.push(tag)
    if (note && !node.supportingNote) node.supportingNote = note
  }

  const chapters = Array.isArray(input.chapterStructure.chapters)
    ? input.chapterStructure.chapters as Array<Record<string, unknown>>
    : []
  chapters.forEach((chapter, index) => {
    const chapterNo = Number(chapter.number || index + 1)
    const node = ensureNode(chapterNo)
    node.title = stringValue(chapter.title) || node.title
    node.summary = Array.isArray(chapter.keyEvents) ? (chapter.keyEvents as string[]).join('；') : node.summary
    const functionLabel = stringValue(chapter.function)
    if (functionLabel && !node.tags.includes(functionLabel)) node.tags.push(functionLabel)
    addSource(chapterNo, { label: '章节结构', tone: 'blue' }, node.summary, functionLabel || '章节结构')
  })

  const outline = (input.storyOverview.outline || {}) as Record<string, unknown>
  const stageBreakdown = Array.isArray(outline.stageBreakdown) ? outline.stageBreakdown as Array<Record<string, unknown>> : []
  stageBreakdown.forEach((stage, index) => {
    const chapterNo = rangeStart(stringValue(stage.chapterRange), index + 1)
    const stageLabel = stringValue(stage.stage) || `阶段 ${index + 1}`
    const node = ensureNode(chapterNo)
    if (!node.tags.includes(stageLabel)) node.tags.push(stageLabel)
    node.stageLabel = stageLabel
    if (!node.summary) node.summary = stringValue(stage.summary)
    addSource(chapterNo, { label: '故事阶段', tone: 'purple' }, stringValue(stage.summary), stageLabel)
  })

  const turningPoints = Array.isArray(input.plotLine.turningPoints)
    ? input.plotLine.turningPoints as Array<Record<string, unknown>>
    : []
  turningPoints.forEach((point, index) => {
    const chapterNo = Number(point.chapter || index + 1)
    const node = ensureNode(chapterNo)
    if (!node.tags.includes('转折')) node.tags.push('转折')
    if (!node.summary) node.summary = stringValue(point.impact)
    addSource(chapterNo, { label: '剧情转折', tone: 'purple' }, stringValue(point.impact), '转折')
  })

  const foreshadowItems = Array.isArray(input.foreshadowing.items)
    ? input.foreshadowing.items as Array<Record<string, unknown>>
    : []
  foreshadowItems.forEach((item, index) => {
    const chapterNo = Number(item.chapter || index + 1)
    const node = ensureNode(chapterNo)
    const payoff = stringValue(item.payoff)
    const label = payoff && payoff !== '待回收' ? '伏笔回收' : '伏笔悬念'
    if (!node.tags.includes(label)) node.tags.push(label)
    addSource(chapterNo, { label, tone: payoff && payoff !== '待回收' ? 'green' : 'amber' }, payoff || stringValue(item.setup), label)
  })

  const highlights = Array.isArray(input.readingExperience.highlightChapters)
    ? input.readingExperience.highlightChapters as Array<{ chapter?: number; reason?: string }>
    : []
  highlights.forEach(item => {
    const chapterNo = Number(item.chapter || 0)
    const node = ensureNode(chapterNo)
    if (!node.tags.includes('高光')) node.tags.push('高光')
    addSource(chapterNo, { label: '高光', tone: 'green' }, item.reason, '高光')
  })

  const fatigue = Array.isArray(input.readingExperience.fatigueChapters)
    ? input.readingExperience.fatigueChapters as Array<{ chapterRange?: string; reason?: string }>
    : []
  fatigue.forEach(item => {
    const chapterNo = rangeStart(item.chapterRange || '', 0)
    const node = ensureNode(chapterNo)
    if (!node.tags.includes('疲劳')) node.tags.push('疲劳')
    addSource(chapterNo, { label: '疲劳段', tone: 'red' }, item.reason, '疲劳')
  })

  const worldSettings = Array.isArray(input.worldSetting.settings)
    ? input.worldSetting.settings as Array<Record<string, unknown>>
    : []
  worldSettings.forEach((setting, index) => {
    const chapterNo = parseChapterMark(stringValue(setting.firstAppear))
    if (!chapterNo) return
    const node = ensureNode(chapterNo)
    if (!node.tags.includes('世界观')) node.tags.push('世界观')
    addSource(chapterNo, { label: '世界设定', tone: 'blue' }, stringValue(setting.description), stringValue(setting.name) || `设定 ${index + 1}`)
  })

  const nodes = Array.from(nodeMap.values())
    .filter(node => node.sources.length > 0 || node.tags.length > 0 || node.summary)
    .sort((a, b) => a.chapterNo - b.chapterNo)
    .map((node) => {
      const score = node.sources.length + node.tags.length + (node.summary ? 1 : 0)
      node.confidenceLevel = score >= 5 ? '高' : score >= 3 ? '中' : '低'
      return node
    })

  return {
    nodes,
    highConfidenceCount: nodes.filter(node => node.confidenceLevel === '高').length,
    lowConfidenceCount: nodes.filter(node => node.confidenceLevel === '低').length,
  }
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function parseChapterMark(value: string) {
  const match = value.match(/(\d+)/)
  return match ? Number(match[1]) : 0
}

function rangeStart(value: string, fallback: number) {
  const match = value.match(/(\d+)/)
  return match ? Number(match[1]) : fallback
}
