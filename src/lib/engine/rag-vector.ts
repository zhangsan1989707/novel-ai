/**
 * RAG (Retrieval-Augmented Generation) 向量数据库系统
 * 为超长篇小说提供语义检索增强的上下文管理
 */
import { CharacterRole, PlotlineStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'

interface VectorConfig {
  provider: 'pinecone' | 'chroma' | 'qdrant' | 'local'
  dimension: number
  metric: 'cosine' | 'euclidean' | 'dotproduct'
  apiKey?: string
  endpoint?: string
}

interface ChunkMetadata {
  projectId: number
  chapterNo: number
  type: 'plot' | 'character' | 'setting' | 'dialogue' | 'action'
  characters?: string[]
  tags?: string[]
  importance: number
}

interface SemanticChunk {
  id: string
  content: string
  embedding: number[]
  metadata: ChunkMetadata
}

interface SearchResult {
  chunk: SemanticChunk
  score: number
  rerankedContent?: string
}

const DEFAULT_CONFIG: VectorConfig = {
  provider: 'local',
  dimension: 1536,
  metric: 'cosine',
}

const VECTOR_DIMENSION = 256

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\u4e00-\u9fa5 ]/gu, ' ')
    .trim()
}

function tokenizeForVector(text: string): string[] {
  const normalized = normalizeText(text)
  const compact = normalized.replace(/\s+/g, '')
  const tokens = new Set<string>()

  if (!compact) return []

  for (let i = 0; i < compact.length; i++) {
    tokens.add(compact[i])
    if (i < compact.length - 1) {
      tokens.add(compact.slice(i, i + 2))
    }
    if (i < compact.length - 2) {
      tokens.add(compact.slice(i, i + 3))
    }
  }

  normalized.split(/\s+/).filter(Boolean).forEach(token => tokens.add(token))
  return [...tokens]
}

function hashToken(token: string): number {
  let hash = 2166136261
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash)
}

function buildVector(text: string, dimension: number = VECTOR_DIMENSION): number[] {
  const vector = new Array(dimension).fill(0)
  const tokens = tokenizeForVector(text)

  for (const token of tokens) {
    const index = hashToken(token) % dimension
    const weight = Math.min(3, Math.max(1, token.length / 2))
    vector[index] += weight
  }

  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
  if (magnitude === 0) {
    return vector
  }

  return vector.map(val => val / magnitude)
}

function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length)
  let dot = 0
  let aMag = 0
  let bMag = 0

  for (let i = 0; i < length; i++) {
    dot += a[i] * b[i]
    aMag += a[i] * a[i]
    bMag += b[i] * b[i]
  }

  if (aMag === 0 || bMag === 0) return 0
  return dot / (Math.sqrt(aMag) * Math.sqrt(bMag))
}

function keywordOverlapScore(query: string, content: string): number {
  const queryTokens = tokenizeForVector(query)
  if (queryTokens.length === 0) return 0
  const contentText = normalizeText(content)
  let hits = 0
  for (const token of queryTokens) {
    if (token.length <= 1) continue
    if (contentText.includes(token)) hits++
  }
  return hits / Math.max(1, queryTokens.length)
}

function matchesFilter(metadata: ChunkMetadata, filter?: Partial<ChunkMetadata>): boolean {
  if (!filter) return true
  if (filter.projectId !== undefined && metadata.projectId !== filter.projectId) return false
  if (filter.chapterNo !== undefined && metadata.chapterNo !== filter.chapterNo) return false
  if (filter.type !== undefined && metadata.type !== filter.type) return false
  if (filter.importance !== undefined && metadata.importance < filter.importance) return false
  if (filter.characters?.length) {
    const current = metadata.characters || []
    if (!filter.characters.some(char => current.includes(char))) return false
  }
  if (filter.tags?.length) {
    const current = metadata.tags || []
    if (!filter.tags.some(tag => current.includes(tag))) return false
  }
  return true
}

function deriveChunkType(content: string): ChunkMetadata['type'] {
  const text = content.slice(0, 500)
  const dialogueSignals = (text.match(/[「」『』“”"']/g) || []).length
  if (dialogueSignals >= 4 || /说道|问道|答道|笑道|喊道|对话|开口/.test(text)) return 'dialogue'
  if (/打|冲|砸|踢|挥|爆|战|追|躲|战斗|攻击|出手/.test(text)) return 'action'
  if (/世界观|设定|城市|街道|房间|天空|夜色|山|林|殿|宫|屋|环境|场景/.test(text)) return 'setting'
  if (/心里|心中|内心|感觉|意识到|想起|回忆|情绪|念头/.test(text)) return 'character'
  return 'plot'
}

/**
 * 向量嵌入生成器
 */
async function generateEmbedding(
  text: string,
  projectId: number = 0
): Promise<number[]> {
  void projectId
  return buildVector(text, VECTOR_DIMENSION)
}

/**
 * 语义分块器
 * 将章节内容分割成语义连贯的块
 */
async function semanticChunking(
  content: string,
  options: {
    chunkSize?: number
    overlap?: number
    splitBy?: 'paragraph' | 'sentence' | 'scene'
  } = {}
): Promise<Array<{ text: string; startIndex: number; endIndex: number }>> {
  const { chunkSize = 500, overlap = 50, splitBy = 'paragraph' } = options

  const chunks: Array<{ text: string; startIndex: number; endIndex: number }> = []

  if (splitBy === 'paragraph') {
    const paragraphs = content.split(/\n\n+/)
    let currentChunk = ''
    let startIndex = 0

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
        chunks.push({
          text: currentChunk.trim(),
          startIndex,
          endIndex: startIndex + currentChunk.length,
        })
        startIndex = startIndex + currentChunk.length - overlap
        currentChunk = paragraph
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        startIndex,
        endIndex: startIndex + currentChunk.length,
      })
    }
  } else {
    const sentences = content.split(/[.!?。！？]+/)
    let currentChunk = ''

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
        chunks.push({
          text: currentChunk.trim(),
          startIndex: 0,
          endIndex: currentChunk.length,
        })
        currentChunk = sentence
      } else {
        currentChunk += (currentChunk ? '. ' : '') + sentence
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        startIndex: 0,
        endIndex: currentChunk.length,
      })
    }
  }

  return chunks
}

/**
 * 内容类型分类器
 */
async function classifyChunkType(
  chunk: string,
  projectId: number
): Promise<ChunkMetadata['type']> {
  void projectId
  return deriveChunkType(chunk)
}

/**
 * 语义检索
 */
export async function semanticSearch(
  query: string,
  projectId: number,
  options: {
    topK?: number
    filter?: Partial<ChunkMetadata>
    useRerank?: boolean
  } = {}
): Promise<SearchResult[]> {
  const { topK = 5, filter, useRerank = true } = options

  const queryEmbedding = await generateEmbedding(query)
  const [chapters, chapterSummaries, volumeSummaries, bookSummary, characters, plotlines, researchRefs] = await Promise.all([
    prisma.novelChapter.findMany({
      where: { projectId, content: { not: null } },
      select: { chapterNumber: true, title: true, content: true, wordCount: true },
      orderBy: { chapterNumber: 'asc' },
    }),
    prisma.chapterSummary.findMany({
      where: { projectId },
      select: { chapterNo: true, summary: true, keyEvents: true, emotionalTone: true, plantedPlotlines: true, resolvedPlotlines: true },
      orderBy: { chapterNo: 'asc' },
    }),
    prisma.volumeSummary.findMany({
      where: { projectId },
      select: { volumeNumber: true, summary: true, keyEvents: true, plantedPlotlines: true, resolvedPlotlines: true, chapterOverview: true },
      orderBy: { volumeNumber: 'asc' },
    }),
    prisma.bookSummary.findUnique({
      where: { projectId },
    }),
    prisma.character.findMany({
      where: { projectId },
      select: { name: true, role: true, appearance: true, personality: true, background: true, aliases: true, catchphrases: true, currentState: true, lastUpdated: true },
    }),
    prisma.plotline.findMany({
      where: { projectId },
      select: { id: true, description: true, status: true, plantedAt: true, resolvedAt: true, plannedAt: true },
      orderBy: { plantedAt: 'asc' },
    }),
    prisma.researchRef.findMany({
      where: { projectId },
      select: { topic: true, summary: true, keyFacts: true, creativeMaterials: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const candidates: SemanticChunk[] = []

  for (const chapter of chapters) {
    const content = chapter.content || ''
    candidates.push({
      id: `chapter-${chapter.chapterNumber}`,
      content: `${chapter.title}\n${content.slice(0, 3000)}`,
      embedding: await generateEmbedding(`${chapter.title}\n${content.slice(0, 2000)}`),
      metadata: {
        projectId,
        chapterNo: chapter.chapterNumber,
        type: deriveChunkType(content),
        importance: chapter.wordCount > 0 ? 0.9 : 0.5,
      },
    })
  }

  for (const summary of chapterSummaries) {
    const content = [
      `第${summary.chapterNo}章摘要：${summary.summary}`,
      summary.keyEvents.length > 0 ? `关键事件：${summary.keyEvents.join('；')}` : '',
      summary.emotionalTone ? `情绪：${summary.emotionalTone}` : '',
      summary.plantedPlotlines.length > 0 ? `埋设伏笔：${summary.plantedPlotlines.join('；')}` : '',
      summary.resolvedPlotlines.length > 0 ? `回收伏笔：${summary.resolvedPlotlines.join('；')}` : '',
    ].filter(Boolean).join('\n')

    candidates.push({
      id: `chapter-summary-${summary.chapterNo}`,
      content,
      embedding: await generateEmbedding(content),
      metadata: {
        projectId,
        chapterNo: summary.chapterNo,
        type: 'plot',
        importance: 1,
      },
    })
  }

  for (const volume of volumeSummaries) {
    const content = [
      `第${volume.volumeNumber}卷摘要：${volume.summary}`,
      volume.keyEvents.length > 0 ? `关键事件：${volume.keyEvents.join('；')}` : '',
      volume.plantedPlotlines.length > 0 ? `埋设伏笔：${volume.plantedPlotlines.join('；')}` : '',
      volume.resolvedPlotlines.length > 0 ? `回收伏笔：${volume.resolvedPlotlines.join('；')}` : '',
    ].filter(Boolean).join('\n')

    candidates.push({
      id: `volume-summary-${volume.volumeNumber}`,
      content,
      embedding: await generateEmbedding(content),
      metadata: {
        projectId,
        chapterNo: volume.volumeNumber * 1000,
        type: 'plot',
        importance: 0.95,
      },
    })
  }

  if (bookSummary) {
    const characterArcs = Array.isArray(bookSummary.characterArcs)
      ? (bookSummary.characterArcs as Array<Record<string, unknown> | null>)
      : []
    const characterArcLines = characterArcs
      .map(item => {
        const record = item || {}
        const name = String(record.name || record.characterId || '未知角色')
        const description = String(record.arcDescription || '')
        return description ? `${name}:${description}` : name
      })
      .filter(Boolean)
    const content = [
      `全书摘要：${bookSummary.summary}`,
      `主线：${bookSummary.mainPlot}`,
      bookSummary.thematicElements.length > 0 ? `主题：${bookSummary.thematicElements.join('；')}` : '',
      bookSummary.subPlots.length > 0 ? `副线：${bookSummary.subPlots.join('；')}` : '',
      characterArcLines.length > 0
        ? `人物弧线：${characterArcLines.join('；')}`
        : '',
    ].filter(Boolean).join('\n')

    candidates.push({
      id: 'book-summary',
      content,
      embedding: await generateEmbedding(content),
      metadata: {
        projectId,
        chapterNo: 0,
        type: 'plot',
        importance: 1,
      },
    })
  }

  for (const character of characters) {
    const content = [
      `角色：${character.name}`,
      `角色定位：${character.role}`,
      character.appearance ? `外貌：${character.appearance}` : '',
      character.personality ? `性格：${character.personality}` : '',
      character.background ? `背景：${character.background}` : '',
      character.aliases.length > 0 ? `别名：${character.aliases.join('；')}` : '',
      character.catchphrases.length > 0 ? `口头禅：${character.catchphrases.join('；')}` : '',
      character.currentState ? `状态：${JSON.stringify(character.currentState)}` : '',
      character.lastUpdated ? `最近更新：第${character.lastUpdated}章` : '',
    ].filter(Boolean).join('\n')

    candidates.push({
      id: `character-${character.name}`,
      content,
      embedding: await generateEmbedding(content),
      metadata: {
        projectId,
        chapterNo: character.lastUpdated || 0,
        type: 'character',
        characters: [character.name],
        importance: character.role === CharacterRole.PROTAGONIST ? 1 : 0.8,
      },
    })
  }

  for (const plotline of plotlines) {
    const content = [
      `伏笔/剧情线：${plotline.description}`,
      plotline.status ? `状态：${plotline.status}` : '',
      plotline.plannedAt ? `计划回收：第${plotline.plannedAt}章` : '',
      plotline.resolvedAt ? `回收章节：第${plotline.resolvedAt}章` : '',
      `埋设章节：第${plotline.plantedAt}章`,
    ].filter(Boolean).join('\n')

    candidates.push({
      id: `plotline-${plotline.id}`,
      content,
      embedding: await generateEmbedding(content),
      metadata: {
        projectId,
        chapterNo: plotline.plantedAt,
        type: 'plot',
        importance: plotline.status === PlotlineStatus.RESOLVED ? 0.7 : 1,
        tags: [plotline.status],
      },
    })
  }

  for (const ref of researchRefs) {
    const content = [
      `研究主题：${ref.topic}`,
      ref.summary,
      ref.keyFacts.length > 0 ? `关键事实：${ref.keyFacts.join('；')}` : '',
      ref.creativeMaterials.length > 0 ? `创作素材：${ref.creativeMaterials.join('；')}` : '',
    ].filter(Boolean).join('\n')

    candidates.push({
      id: `research-${ref.topic}`,
      content,
      embedding: await generateEmbedding(content),
      metadata: {
        projectId,
        chapterNo: 0,
        type: 'setting',
        importance: 0.7,
      },
    })
  }

  const filtered = candidates.filter(chunk => matchesFilter(chunk.metadata, filter))
  const scored = filtered.map(chunk => {
    const similarity = cosineSimilarity(queryEmbedding, chunk.embedding)
    const overlap = keywordOverlapScore(query, chunk.content)
    const score = (similarity * 0.72) + (overlap * 0.22) + (chunk.metadata.importance * 0.06)
    return {
      chunk,
      score,
      rerankedContent: useRerank ? chunk.content : undefined,
    }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, topK)
}

/**
 * 增强上下文构建
 */
export async function buildRAGContext(
  projectId: number,
  chapterNo: number,
  query: string,
  options: {
    maxChunks?: number
    includeTypes?: ChunkMetadata['type'][]
    rerank?: boolean
  } = {}
): Promise<{
  context: string
  sources: Array<{ chapterNo: number; type: string; relevance: number }>
}> {
  const { maxChunks = 3, includeTypes, rerank = true } = options

  // 1. 语义搜索相关段落
  const searchResults = await semanticSearch(query, projectId, {
    topK: Math.max(maxChunks * 2, maxChunks),
    useRerank: rerank,
  })
  const filteredResults = includeTypes?.length
    ? searchResults.filter(result => includeTypes.includes(result.chunk.metadata.type))
    : searchResults

  // 2. 构建增强上下文
  const contextParts: string[] = []
  const sources: Array<{ chapterNo: number; type: string; relevance: number }> = []

  for (const result of filteredResults.slice(0, maxChunks)) {
    contextParts.push(`【第${result.chunk.metadata.chapterNo}章 - ${result.chunk.metadata.type}】\n${result.chunk.content}`)
    sources.push({
      chapterNo: result.chunk.metadata.chapterNo,
      type: result.chunk.metadata.type,
      relevance: result.score,
    })
  }

  return {
    context: contextParts.join('\n\n---\n\n'),
    sources,
  }
}

/**
 * 人物信息检索
 */
export async function searchCharacterInfo(
  projectId: number,
  characterName: string,
  query: string
): Promise<string> {
  const searchResults = await semanticSearch(
    `${characterName} ${query}`,
    projectId,
    {
      topK: 3,
      filter: { type: 'character' },
    }
  )

  if (searchResults.length === 0) {
    return ''
  }

  return searchResults.map(r => r.chunk.content).join('\n\n')
}

/**
 * 情节脉络检索
 */
export async function searchPlotline(
  projectId: number,
  plotlineKeyword: string,
  currentChapter: number
): Promise<Array<{ chapterNo: number; content: string; score: number }>> {
  const searchResults = await semanticSearch(
    plotlineKeyword,
    projectId,
    {
      topK: 5,
      filter: { type: 'plot' },
    }
  )

  return searchResults
    .filter(r => r.chunk.metadata.chapterNo < currentChapter)
    .map(r => ({
      chapterNo: r.chunk.metadata.chapterNo,
      content: r.chunk.content,
      score: r.score,
    }))
}

/**
 * 索引章节内容
 */
export async function indexChapterContent(
  projectId: number,
  chapterNo: number,
  content: string,
  options: {
    chunkSize?: number
    overlap?: number
  } = {}
): Promise<{ chunkCount: number; indexedAt: Date }> {
  // 1. 语义分块
  const chunks = await semanticChunking(content, options)

  // 2. 为每个块生成向量并分类
  const indexedChunks: SemanticChunk[] = []

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    
    // 生成向量
    const embedding = await generateEmbedding(chunk.text)
    
    // 分类
    const type = await classifyChunkType(chunk.text, projectId)

    indexedChunks.push({
      id: `${projectId}-${chapterNo}-${i}`,
      content: chunk.text,
      embedding,
      metadata: {
        projectId,
        chapterNo,
        type,
        importance: i < 3 ? 1 : 0.5, // 前几段更重要
      },
    })
  }

  // 3. 存储到向量数据库
  // TODO: 实现实际的向量数据库存储
  // await vectorStore.upsert(projectId, indexedChunks)

  return {
    chunkCount: indexedChunks.length,
    indexedAt: new Date(),
  }
}

/**
 * 生成 RAG 增强提示词
 */
export async function buildRAGPrompt(
  projectId: number,
  chapterNo: number,
  basePrompt: string,
  options: {
    includeCharacters?: string[]
    includePlotlines?: string[]
    maxContextLength?: number
  } = {}
): Promise<string> {
  const { includeCharacters, includePlotlines, maxContextLength = 2000 } = options

  const ragContextParts: string[] = []

  // 1. 添加相关人物信息
  if (includeCharacters?.length) {
    for (const charName of includeCharacters) {
      const charInfo = await searchCharacterInfo(projectId, charName, '外貌、性格、关系')
      if (charInfo) {
        ragContextParts.push(`【人物档案 - ${charName}】\n${charInfo}`)
      }
    }
  }

  // 2. 添加相关剧情信息
  if (includePlotlines?.length) {
    for (const plotline of includePlotlines) {
      const plotInfo = await searchPlotline(projectId, plotline, chapterNo)
      if (plotInfo.length > 0) {
        const relevantPlot = plotInfo
          .slice(0, 2)
          .map(p => `第${p.chapterNo}章：${p.content}`)
          .join('\n')
        ragContextParts.push(`【剧情脉络 - ${plotline}】\n${relevantPlot}`)
      }
    }
  }

  // 3. 构建最终提示词
  const ragContext = ragContextParts.join('\n\n')

  if (ragContext.length > maxContextLength) {
    // 截断过长的上下文
    return basePrompt + '\n\n【相关背景信息（已精简）】\n' + ragContext.slice(0, maxContextLength)
  }

  return ragContext
    ? basePrompt + '\n\n【相关背景信息】\n' + ragContext
    : basePrompt
}

export type { VectorConfig, ChunkMetadata, SemanticChunk, SearchResult }
