type RoadmapSource = {
  arcNumber: number
  name: string
  stage: string
  description?: string | null
  startChapter: number
  endChapter?: number | null
  goals: string[]
  keyEvents: string[]
  popularFictionProfile?: {
    emotionEngine?: { primaryEmotion?: string; readerPayoff?: string } | null
    conflictEngine?: { conflictTypes?: string[]; hookStrategy?: string } | null
  } | null
}

export type StoryRoadmapItem = {
  arcId?: string
  arcNumber: number
  title: string
  chapterRange: string
  summary: string
  mainEmotion: string
  stagePayoff: string
  conflictFocus: string
  hookStrategy: string
  highlights: string[]
  forbidden: string[]
}

const STAGE_LABELS: Record<string, string> = {
  OPENING: '主角入局',
  GROWTH: '成长起势',
  EXPANSION: '世界扩张',
  MID_CONFLICT: '中段冲突',
  PRE_FINALE: '高潮前夜',
  FINALE: '最终因果',
}

const DEFAULT_SUMMARY: Record<string, string> = {
  OPENING: '这一阶段主要负责把主角卷入主线冲突，建立世界规则与第一层压迫感。',
  GROWTH: '这一阶段主要负责让主角建立存在感、积累优势，并把冲突从个人层面推向更大范围。',
  EXPANSION: '这一阶段主要负责扩张地图、势力和矛盾层级，让故事规模明显升级。',
  MID_CONFLICT: '这一阶段主要负责让多条冲突线相互碰撞，把代价和风险抬高。',
  PRE_FINALE: '这一阶段主要负责把终局前的重要筹码摆上桌，但不提前引爆真正结局。',
  FINALE: '这一阶段主要负责集中兑现前期铺垫，完成主线终局与核心因果。',
}

const DEFAULT_FORBIDDEN: Record<string, string[]> = {
  OPENING: ['不会解决最终反派', '不会揭开主角全部身世', '不会让主角直接无敌', '不会回收全部伏笔'],
  GROWTH: ['不会结束主线冲突', '不会杀死最终反派', '不会揭开世界终极真相', '不会让主角获得终极力量'],
  EXPANSION: ['不会提前大结局', '不会解决所有势力矛盾', '不会回收全部秘密', '不会让最终敌人退场'],
  MID_CONFLICT: ['不会彻底终结主线', '不会让最大反派提前死亡', '不会一次性回收全部伏笔', '不会让世界问题全部落定'],
  PRE_FINALE: ['不会提前写完最终决战', '不会在本阶段结束所有因果', '不会把所有秘密一次性揭完', '不会让结局提前落地'],
  FINALE: ['不会保留主线空转', '不会跳过核心因果兑现', '不会跳过最终冲突清算', '不会只回收局部伏笔'],
}

function normalizeStageLabel(stage: string, arcNumber: number, name: string) {
  const readable = name?.trim() || STAGE_LABELS[stage] || `第 ${arcNumber} 阶段`
  return `第${arcNumber}阶段：${readable}`
}

function chapterRange(startChapter: number, endChapter?: number | null) {
  if (!endChapter || endChapter <= startChapter) return `预计章节：第${startChapter}章起`
  return `预计章节：第${startChapter}-${endChapter}章`
}

function toHighlights(source: RoadmapSource) {
  const items = [...source.keyEvents, ...source.goals].map(item => item.trim()).filter(Boolean)
  return Array.from(new Set(items)).slice(0, 4)
}

export function buildStoryRoadmapItem(source: RoadmapSource & { id?: string }): StoryRoadmapItem {
  const highlights = toHighlights(source)
  return {
    arcId: source.id,
    arcNumber: source.arcNumber,
    title: normalizeStageLabel(source.stage, source.arcNumber, source.name),
    chapterRange: chapterRange(source.startChapter, source.endChapter),
    summary: source.description?.trim() || DEFAULT_SUMMARY[source.stage] || '这一阶段会继续推进主线、升级冲突并为后续发展留出空间。',
    mainEmotion: source.popularFictionProfile?.emotionEngine?.primaryEmotion || '推进',
    stagePayoff: source.popularFictionProfile?.emotionEngine?.readerPayoff || source.goals[0] || '给读者一个明确的阶段回报',
    conflictFocus: source.popularFictionProfile?.conflictEngine?.conflictTypes?.join('、') || source.goals[0] || '持续升级当前阶段冲突',
    hookStrategy: source.popularFictionProfile?.conflictEngine?.hookStrategy || source.keyEvents[0] || '在阶段结尾留下更大承诺或威胁',
    highlights: highlights.length > 0 ? highlights : ['推进当前主线', '制造新的冲突与爽点', '为后续阶段埋下钩子'],
    forbidden: DEFAULT_FORBIDDEN[source.stage] || ['不会提前解决最终反派', '不会一次性回收全部伏笔'],
  }
}

export function buildStoryRoadmap(sources: Array<RoadmapSource & { id?: string }>) {
  return sources
    .slice()
    .sort((a, b) => a.arcNumber - b.arcNumber)
    .map(buildStoryRoadmapItem)
}
