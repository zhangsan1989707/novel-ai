interface BuildFallbackNovelTitleInput {
  corePitch?: string
  description?: string
  genre?: string
  fallbackTitle?: string
}

const TITLE_PREFIX_RE = /^(标题|书名|小说标题|推荐标题)\s*[:：-]\s*/i
const INVALID_TITLE_PATTERNS = [
  /^暂无$/,
  /^未命名$/,
  /^小说标题$/,
  /^书名$/,
  /^标题$/,
  /^请/,
  /^根据/,
  /^这是/,
]

const RESERVED_TITLE_SEEDS = new Set([
  '起点',
  '番茄',
  '飞卢',
  '晋江',
  '七猫',
  '男频',
  '女频',
  '全平台',
  '玄幻',
  '仙侠',
  '都市',
  '科幻',
  '悬疑',
  '历史',
  '言情',
  '轻小说',
  '综合',
])

const GENERIC_TITLE_RE = /^(起点|番茄|飞卢|晋江|七猫|男频|女频|玄幻|仙侠|都市|科幻|悬疑|历史|言情).{0,4}(录|纪|纪事|风云录|传奇|异闻录)$/

function normalizeSourceText(text: string): string {
  return text.replace(/\s+/g, '').replace(/["'`【】《》[\]]/g, '')
}

function isReservedSeed(seed: string, genre?: string) {
  const normalized = normalizeSourceText(seed)
  const normalizedGenre = normalizeSourceText(genre || '')
  if (!normalized) return true
  if (RESERVED_TITLE_SEEDS.has(normalized)) return true
  if (normalizedGenre && normalized === normalizedGenre) return true
  if (/(爆款|开写|选题|方向|平台|题材|灵感)/.test(seed)) return true
  return false
}

function isUsableFallbackTitle(title: string, sourceText?: string) {
  const normalized = normalizeNovelTitle(title)
  if (!normalized || normalized.length < 2 || normalized.length > 30) return false
  if (INVALID_TITLE_PATTERNS.some(pattern => pattern.test(normalized))) return false
  if (GENERIC_TITLE_RE.test(normalized)) return false
  if (sourceText) {
    const normalizedSource = normalizeSourceText(sourceText)
    if (normalizedSource && normalizeSourceText(normalized) === normalizedSource) return false
  }
  return true
}

function extractPitchSeed(pitch: string, genre?: string): string {
  const normalized = pitch
    .trim()
    .split('\n')
    .find(Boolean)
    ?.replace(TITLE_PREFIX_RE, '')
    .split(/[：:，。！？,.;；!?\-]/)[0]
    .replace(/\s+/g, ' ')
    .replace(/[×xX]/g, '')
    .trim()

  if (!normalized) return ''

  const matches = normalized.match(/[\u4e00-\u9fa5A-Za-z0-9]{2,8}/g) || []
  return matches.map(item => item.trim()).find(item => item && !isReservedSeed(item, genre)) || ''
}

export function normalizeNovelTitle(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .split('\n')
    .map(line => line.trim())
    .find(Boolean)
    ?.replace(TITLE_PREFIX_RE, '')
    .replace(/^["'`【】《》\[\]\s]+/, '')
    .replace(/["'`【】《》\[\]\s]+$/, '')
    .replace(/\s+/g, ' ')
    .slice(0, 50) || ''
}

export function isLikelyNovelTitle(title: string, sourceText?: string): boolean {
  const normalized = normalizeNovelTitle(title)

  if (!normalized || normalized.length < 2 || normalized.length > 20) return false
  if (/[。！？!?]/.test(normalized)) return false
  if (/[：:]/.test(normalized)) return false
  if (/[{}[\]]/.test(normalized)) return false
  if (INVALID_TITLE_PATTERNS.some(pattern => pattern.test(normalized))) return false
  if (GENERIC_TITLE_RE.test(normalized)) return false

  if (sourceText) {
    const normalizedSource = normalizeSourceText(sourceText)
    if (normalizedSource && normalizeSourceText(normalized) === normalizedSource) return false
  }

  return true
}

export function buildFallbackNovelTitle(input: BuildFallbackNovelTitleInput): string {
  const fallbackTitle = normalizeNovelTitle(input.fallbackTitle || '')
  if (fallbackTitle && isUsableFallbackTitle(fallbackTitle, input.corePitch || input.description || '')) {
    return fallbackTitle
  }

  const seed = extractPitchSeed(input.corePitch || '', input.genre) || extractPitchSeed(input.description || '', input.genre)
  const genre = input.genre?.trim()

  if (seed) {
    return seed.length <= 4 ? `${seed}录` : `${seed}纪事`
  }

  if (genre && !isReservedSeed(genre)) {
    return `${genre}风云录`
  }

  return '未命名小说'
}
