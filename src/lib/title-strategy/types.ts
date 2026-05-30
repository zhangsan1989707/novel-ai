/** 标题生成输入 */
export interface TitleStrategyInput {
  platform: 'qidian' | 'fanqie' | 'qimao' | 'jjwxc' | 'general'
  channel: 'male' | 'female'
  genre: string
  subGenres?: string[]
  targetStyle: 'market' | 'quality' | 'short_drama' | 'literary'
  coreHook: string
  protagonistIdentity?: string
  conflict?: string
  emotionalPromise?: string
  forbiddenWords?: string[]
}

/** 单个标题候选 */
export interface TitleCandidate {
  title: string
  subtitle?: string
  style: 'hot' | 'stable' | 'literary' | 'short_drama' | 'platform'
  score: number
  tags: string[]
  reason: string
  risk: string
}

/** 评分细分 */
export interface TitleScoreBreakdown {
  genreRecognition: number  // 题材识别度 0-20
  hookStrength: number      // 爽点强度 0-25
  conflictDensity: number   // 冲突密度 0-20
  emotionalStimulus: number // 情绪刺激 0-15
  platformFit: number       // 平台适配 0-10
  readability: number       // 可读性 0-10
}

/** 评分明细候选 */
export interface ScoredTitleCandidate extends TitleCandidate {
  breakdown: TitleScoreBreakdown
}

/** 标题工厂返回结果 */
export interface TitleFactoryResult {
  candidates: ScoredTitleCandidate[]
  workingTitle: string
  recommendation: ScoredTitleCandidate
}
