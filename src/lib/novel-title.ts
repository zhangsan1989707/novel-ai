interface BuildFallbackNovelTitleInput {
  corePitch?: string
  description?: string
  genre?: string
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

function normalizeSourceText(text: string): string {
  return text.replace(/\s+/g, '').replace(/["'`【】《》[\]]/g, '')
}

function extractPitchSeed(pitch: string): string {
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

  const match = normalized.match(/[\u4e00-\u9fa5A-Za-z0-9]{2,8}/)
  return match?.[0]?.trim() || ''
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

  if (sourceText) {
    const normalizedSource = normalizeSourceText(sourceText)
    if (normalizedSource && normalizeSourceText(normalized) === normalizedSource) return false
  }

  return true
}

export function buildFallbackNovelTitle(input: BuildFallbackNovelTitleInput): string {
  const seed = extractPitchSeed(input.corePitch || input.description || '')
  const genre = input.genre?.trim()

  if (seed) {
    return seed.length <= 4 ? `${seed}录` : `${seed}纪事`
  }

  if (genre) {
    return `${genre}风云录`
  }

  return '未命名小说'
}
