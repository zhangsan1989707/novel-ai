export const config = {
  ai: {
    defaultTemperature: 0.7,
    defaultTargetWordCount: 3000,
    maxTargetWordCount: 10000,
    minTargetWordCount: 1000,
    contextChapterCount: 3,
    maxContextChapterCount: 10,
    maxRetryCount: 3,
    contentSufficiencyThreshold: 0.9,
    tokenEstimateMultiplier: 1.5,
    wordCountOverageThreshold: 1.1,
  },
  rateLimit: {
    aiGeneration: {
      max: 10,
      windowMs: 60 * 1000,
    },
    api: {
      max: 100,
      windowMs: 60 * 1000,
    },
    export: {
      max: 5,
      windowMs: 60 * 1000,
    },
  },
  cache: {
    projectTTL: 60 * 1000,
    characterTTL: 5 * 60 * 1000,
    chapterTTL: 2 * 60 * 1000,
    projectMaxSize: 100,
    characterMaxSize: 500,
    chapterMaxSize: 200,
  },
  sse: {
    timeout: 30 * 60 * 1000,
    heartbeatInterval: 30 * 1000,
  },
  chapter: {
    openingChapterWordCount: { min: 2000, max: 2500 },
    normalChapterWordCount: { min: 2500, max: 3500 },
    climaxChapterWordCount: { min: 3500, max: 4500 },
    expansionWordCount: { min: 4000, max: 5000 },
    condensationWordCount: { min: 1500, max: 2000 },
  },
  pacing: {
    setup: 0.2,
    development: 0.5,
    climax: 0.3,
  },
  summary: {
    chapterWordCount: { min: 200, max: 300 },
    volumeWordCount: { min: 500, max: 800 },
    bookWordCount: { min: 1000, max: 1500 },
  },
  emotional: {
    low: 30,
    normal: 60,
    high: 80,
    climax: 95,
    warm: 40,
    sad: 30,
  },
  pagination: {
    defaultPageSize: 20,
    maxPageSize: 100,
  },
} as const

export type Config = typeof config

export function getAIConfig() {
  return config.ai
}

export function getRateLimitConfig() {
  return config.rateLimit
}

export function getCacheConfig() {
  return config.cache
}

export function getSSEConfig() {
  return config.sse
}

export function getChapterWordCountRange(chapterNo: number, type: 'opening' | 'normal' | 'climax' | 'expansion' | 'condensation'): { min: number; max: number } {
  const chapterConfig = {
    opening: config.chapter.openingChapterWordCount,
    normal: config.chapter.normalChapterWordCount,
    climax: config.chapter.climaxChapterWordCount,
    expansion: config.chapter.expansionWordCount,
    condensation: config.chapter.condensationWordCount,
  }[type]

  if (chapterNo <= 3) {
    return config.chapter.openingChapterWordCount
  }
  if (chapterNo % 10 === 0) {
    return config.chapter.climaxChapterWordCount
  }
  return config.chapter.normalChapterWordCount
}

export function getEmotionalValue(tone: string): number {
  const emotionalMap: Record<string, number> = {
    '紧张': config.emotional.high,
    '温馨': config.emotional.warm,
    '悲伤': config.emotional.sad,
    '高潮': config.emotional.climax,
    '平和': config.emotional.normal,
    '低落': config.emotional.low,
  }
  return emotionalMap[tone] || config.emotional.normal
}
