import https from 'node:https'
import http from 'node:http'
import type { HotInspiration, InspirationCategory } from './data'

type LiveBook = {
  title: string
  author?: string
  category?: string
  subCategory?: string
  description?: string
  sourceList: string
  rank?: number
}

type CacheEntry = {
  expiresAt: number
  data: HotInspiration[]
}

const REQUEST_TIMEOUT_MS = 12000
const CACHE_TTL_MS = 30 * 60 * 1000
const SOURCE_LABELS = {
  qidian: '起点',
  fanqie: '番茄',
  jjwxc: '晋江',
} as const

let liveCache: CacheEntry | null = null

function requestText(url: string, encoding: string = 'utf-8', redirectCount = 0): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const transport = parsedUrl.protocol === 'http:' ? http : https
    const req = transport.get(
      parsedUrl,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NovelAI/1.0; +https://localhost)',
          'Accept-Encoding': 'identity',
        },
        rejectUnauthorized: false,
      },
      (res) => {
        const statusCode = res.statusCode || 0
        if (statusCode >= 300 && statusCode < 400 && res.headers.location && redirectCount < 3) {
          const nextUrl = new URL(res.headers.location, parsedUrl).toString()
          res.resume()
          requestText(nextUrl, encoding, redirectCount + 1).then(resolve).catch(reject)
          return
        }

        if (statusCode < 200 || statusCode >= 300) {
          res.resume()
          reject(new Error(`Request failed: ${statusCode} ${url}`))
          return
        }

        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        })
        res.on('end', () => {
          try {
            const decoder = new TextDecoder(encoding as 'utf-8')
            resolve(decoder.decode(Buffer.concat(chunks)))
          } catch (error) {
            reject(error)
          }
        })
      }
    )

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`Request timeout: ${url}`))
    })
    req.on('error', reject)
  })
}

function normalizeWhitespace(text: string | undefined | null) {
  return (text || '').replace(/\s+/g, ' ').trim()
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function uniqueStrings(values: Array<string | undefined | null>, limit?: number) {
  const result: string[] = []
  for (const value of values) {
    const text = normalizeWhitespace(value)
    if (!text || result.includes(text)) continue
    result.push(text)
    if (limit && result.length >= limit) break
  }
  return result
}

function inferCategory(platform: keyof typeof SOURCE_LABELS, genre: string): InspirationCategory {
  const text = `${platform} ${genre}`
  if (/(晋江|言情|纯爱|双男主|宫斗|宅斗|豪门|婚恋|现言|古言|种田)/.test(text)) {
    return 'female'
  }
  if (/(悬疑|科幻|历史|职场|都市)/.test(text)) {
    return 'unisex'
  }
  return 'male'
}

function inferWritingStyle(genre: string, descriptions: string[]) {
  const text = `${genre} ${descriptions.join(' ')}`
  if (/(悬疑|规则|惊魂|刑侦|怪谈)/.test(text)) return '悬疑烧脑'
  if (/(甜|宠|婚恋|玫瑰|心动)/.test(text)) return '情绪拉扯'
  if (/(种田|家族|经营|朝堂|历史)/.test(text)) return '慢热成长'
  if (/(玄幻|仙侠|高武|末世|系统|无敌)/.test(text)) return '快节奏爽文'
  return '市场向选题'
}

function mapGenre(rawGenre: string) {
  const text = normalizeWhitespace(rawGenre)
  if (!text) return '综合'
  if (/(仙侠|修真)/.test(text)) return '仙侠'
  if (/(玄幻|高武)/.test(text)) return '玄幻'
  if (/(科幻|末世)/.test(text)) return '科幻'
  if (/(历史|朝堂|古代)/.test(text)) return '历史'
  if (/(悬疑|灵异|刑侦)/.test(text)) return '悬疑'
  if (/(都市|职场)/.test(text)) return '都市'
  if (/(言情|豪门|婚恋|宅斗|宫斗|双男主|纯爱)/.test(text)) return '言情'
  return text.length <= 8 ? text : '综合'
}

function extractBalancedObject(text: string, token: string): string | null {
  const start = text.indexOf(token)
  if (start < 0) return null

  const firstBrace = text.indexOf('{', start + token.length)
  if (firstBrace < 0) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = firstBrace; index < text.length; index += 1) {
    const char = text[index]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }
    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return text.slice(firstBrace, index + 1)
      }
    }
  }

  return null
}

function extractJsonArray(text: string, key: string): unknown[] {
  const match = text.match(new RegExp(`"${key}":(\\[[\\s\\S]*?\\])(?=,"[A-Za-z_]|})`))
  if (!match) return []
  try {
    return JSON.parse(match[1]) as unknown[]
  } catch {
    return []
  }
}

async function fetchQidianBooks(): Promise<LiveBook[]> {
  const html = await requestText('https://m.qidian.com/rank')
  const buckets = [
    { key: 'readIndex', sourceList: '阅读榜' },
    { key: 'recRank', sourceList: '推荐榜' },
    { key: 'signRank', sourceList: '签约榜' },
    { key: 'newbRank', sourceList: '新书榜' },
  ]

  return buckets.flatMap(({ key, sourceList }) =>
    extractJsonArray(html, key).slice(0, 6).map((item) => {
      const row = item as Record<string, unknown>
      return {
        title: String(row.bName || ''),
        author: typeof row.bAuth === 'string' ? row.bAuth : '',
        category: typeof row.cat === 'string' ? row.cat : '',
        subCategory: typeof row.subCat === 'string' ? row.subCat : '',
        description: typeof row.desc === 'string' ? row.desc : '',
        sourceList,
        rank: typeof row.rankNum === 'number' ? row.rankNum : undefined,
      } satisfies LiveBook
    })
  ).filter(book => book.title)
}

async function fetchFanqieBooks(): Promise<LiveBook[]> {
  const html = await requestText('https://fanqienovel.com/')
  const rawState = extractBalancedObject(html, 'window.__INITIAL_STATE__=')
  if (!rawState) return []

  try {
    const state = JSON.parse(rawState) as {
      home?: {
        boyList?: Array<Record<string, unknown>>
        girlList?: Array<Record<string, unknown>>
        updateList?: Array<Record<string, unknown>>
      }
    }
    const home = state.home
    const buckets = [
      { list: home?.boyList || [], sourceList: '男频精选' },
      { list: home?.girlList || [], sourceList: '女频精选' },
      { list: home?.updateList || [], sourceList: '最近更新' },
    ]

    return buckets.flatMap(({ list, sourceList }) =>
      list.slice(0, 8).map((item) => ({
        title: String(item.bookName || ''),
        author: typeof item.author === 'string' ? item.author : '',
        category: typeof item.category === 'string' ? item.category : '',
        description: typeof item.abstract === 'string' ? item.abstract : typeof item.title === 'string' ? item.title : '',
        sourceList,
      } satisfies LiveBook))
    ).filter(book => book.title)
  } catch {
    return []
  }
}

function extractJjwxcSection(html: string, heading: string, sourceList: string): LiveBook[] {
  const headingIndex = html.indexOf(heading)
  if (headingIndex < 0) return []
  const nextHeading = html.indexOf('<h2 class = "big o">', headingIndex + heading.length)
  const section = html.slice(headingIndex, nextHeading > headingIndex ? nextHeading : undefined)
  const books = [...section.matchAll(/<li><a href="\/book2\/\d+" class="" >([^<]+)<\/a>/g)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)
    .slice(0, 10)

  return books.map((title, index) => ({
    title,
    category: heading.includes('纯爱') ? '纯爱' : '言情',
    sourceList,
    rank: index + 1,
  }))
}

async function fetchJjwxcBooks(): Promise<LiveBook[]> {
  const html = await requestText('https://m.jjwxc.net/rank/index', 'gb18030')
  return [
    ...extractJjwxcSection(html, '半年排行榜', '半年排行榜'),
    ...extractJjwxcSection(html, '新晋作者榜', '新晋作者榜'),
    ...extractJjwxcSection(html, '读者栽培榜', '读者栽培榜'),
  ]
}

function buildInspirationFromBooks(
  source: keyof typeof SOURCE_LABELS,
  genre: string,
  books: LiveBook[],
  dateLabel: string
): HotInspiration {
  const topBooks = books.slice(0, 3)
  const exampleWorks = uniqueStrings(topBooks.map(book => book.title), 3)
  const descriptions = topBooks.map(book => normalizeWhitespace(book.description))
  const tags = uniqueStrings([
    genre,
    ...books.map(book => book.subCategory || book.category),
    ...books.map(book => book.sourceList),
  ], 6)
  const trendTags = uniqueStrings([
    ...books.map(book => book.subCategory || book.category),
    ...exampleWorks,
  ], 4)
  const sampleSummarySeed = descriptions.find(Boolean)

  return {
    id: `live-${source}-${genre}`,
    category: inferCategory(source, genre),
    title: `${SOURCE_LABELS[source]}实时热榜 · ${genre}`,
    description: `${dateLabel}抓取，当前靠前作品：${exampleWorks.join('、') || '暂无'}。主要来源：${uniqueStrings(books.map(book => book.sourceList), 3).join('、')}`,
    exampleWorks,
    coreElements: trendTags.length > 0 ? trendTags : [genre, SOURCE_LABELS[source], '实时热榜'],
    targetAudience: `${SOURCE_LABELS[source]}${genre}读者`,
    hotScore: Math.min(10, Math.max(7, 6 + Math.min(books.length, 4))),
    sampleTitle: exampleWorks[0] || `${SOURCE_LABELS[source]}${genre}热点选题`,
    sampleSummary: sampleSummarySeed
      ? truncate(sampleSummarySeed, 110)
      : `${SOURCE_LABELS[source]} ${genre} 热榜实时抓取，适合从榜单靠前作品中提炼题材组合与节奏风格。`,
    sampleGenre: genre,
    sampleWritingStyle: inferWritingStyle(genre, descriptions),
    tags,
  }
}

function aggregateSourceInspirations(source: keyof typeof SOURCE_LABELS, books: LiveBook[], dateLabel: string) {
  const grouped = new Map<string, LiveBook[]>()
  for (const book of books) {
    const genre = mapGenre(book.category || book.subCategory || '综合')
    const bucket = grouped.get(genre) || []
    bucket.push(book)
    grouped.set(genre, bucket)
  }

  return Array.from(grouped.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3)
    .map(([genre, rows]) => buildInspirationFromBooks(source, genre, rows, dateLabel))
}

function shuffle<T>(items: T[]) {
  const cloned = [...items]
  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[cloned[index], cloned[target]] = [cloned[target], cloned[index]]
  }
  return cloned
}

function interleaveBuckets(buckets: HotInspiration[][]) {
  const queue = buckets.map(bucket => [...bucket]).filter(bucket => bucket.length > 0)
  const result: HotInspiration[] = []

  while (queue.some(bucket => bucket.length > 0)) {
    for (const bucket of queue) {
      const item = bucket.shift()
      if (item) result.push(item)
    }
  }

  return result
}

export async function getLiveInternetInspirations(
  category?: InspirationCategory,
  limit: number = 6,
  random = false
): Promise<HotInspiration[]> {
  const now = Date.now()
  if (liveCache && liveCache.expiresAt > now) {
    let cached = liveCache.data
    if (category) cached = cached.filter(item => item.category === category)
    return (random ? shuffle(cached) : cached).slice(0, limit)
  }

  const dateLabel = new Date().toISOString().slice(0, 10)
  const [qidian, fanqie, jjwxc] = await Promise.allSettled([
    fetchQidianBooks(),
    fetchFanqieBooks(),
    fetchJjwxcBooks(),
  ])

  const inspirations = interleaveBuckets([
    aggregateSourceInspirations('qidian', qidian.status === 'fulfilled' ? qidian.value : [], dateLabel),
    aggregateSourceInspirations('fanqie', fanqie.status === 'fulfilled' ? fanqie.value : [], dateLabel),
    aggregateSourceInspirations('jjwxc', jjwxc.status === 'fulfilled' ? jjwxc.value : [], dateLabel),
  ])

  liveCache = {
    expiresAt: now + CACHE_TTL_MS,
    data: inspirations,
  }

  let result = inspirations
  if (category) {
    result = result.filter(item => item.category === category)
  }

  return (random ? shuffle(result) : result).slice(0, limit)
}
