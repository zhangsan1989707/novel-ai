/**
 * RAG (Retrieval-Augmented Generation) 向量数据库系统
 * 为超长篇小说提供语义检索增强的上下文管理
 */
import { CharacterRole, PlotlineStatus, Prisma } from '@prisma/client'
import { AIService } from '@/lib/ai/service'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { parseAiJsonObject } from './ai-json'

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

type RagSourceType =
  | 'chapter'
  | 'chapter_summary'
  | 'volume_summary'
  | 'book_summary'
  | 'character'
  | 'plotline'
  | 'research'

interface RagDocumentRow {
  id: string
  project_id: number
  source_type: RagSourceType
  source_id: string
  chapter_no: number
  chunk_no: number
  title: string | null
  content: string
  metadata: Prisma.JsonValue
  embedding_score?: number
}

const DEFAULT_CONFIG: VectorConfig = {
  provider: 'local',
  dimension: 1536,
  metric: 'cosine',
}

const VECTOR_DIMENSION = 256
const EMBEDDING_CACHE_LIMIT = 2000
const embeddingProviderCache = new Map<number, Promise<Awaited<ReturnType<typeof createEmbeddingProviderPromise>>>>()
const embeddingVectorCache = new Map<string, number[]>()
let embeddingFallbackWarned = false
let ragDocumentsMissingWarned = false

function isMissingRagDocumentsError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2010' &&
    typeof error.meta?.message === 'string' &&
    error.meta.message.includes('relation "rag_documents" does not exist')
  )
}

function warnMissingRagDocumentsTable(projectId?: number) {
  if (!ragDocumentsMissingWarned) {
    logger.warn({ projectId }, 'rag_documents table is missing, fallback RAG operations to no-op')
    ragDocumentsMissingWarned = true
  }
}

async function hasRagDocumentsTable(): Promise<boolean> {
  try {
    const existenceRows = await prisma.$queryRaw<Array<{ table_name: string | null }>>`
      SELECT to_regclass('public.rag_documents')::text AS table_name
    `
    const exists = Boolean(existenceRows[0]?.table_name)
    if (!exists) {
      warnMissingRagDocumentsTable()
    }
    return exists
  } catch (error) {
    if (isMissingRagDocumentsError(error)) {
      warnMissingRagDocumentsTable()
      return false
    }
    throw error
  }
}

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

function serializeVector(vector: number[]): string {
  return `[${vector.map(v => Number.isFinite(v) ? v.toFixed(8) : '0').join(',')}]`
}

function normalizeEmbeddingDimensions(embedding: number[], targetDimensions: number): number[] {
  if (!Number.isFinite(targetDimensions) || targetDimensions <= 0) {
    return embedding
  }
  if (embedding.length === targetDimensions) {
    return embedding
  }
  if (embedding.length === 0) {
    return new Array(targetDimensions).fill(0)
  }

  if (embedding.length > targetDimensions) {
    const resized = new Array(targetDimensions).fill(0)
    for (let i = 0; i < targetDimensions; i++) {
      const start = Math.floor((i * embedding.length) / targetDimensions)
      const end = Math.max(start + 1, Math.floor(((i + 1) * embedding.length) / targetDimensions))
      let sum = 0
      let count = 0
      for (let j = start; j < end && j < embedding.length; j++) {
        sum += embedding[j]
        count++
      }
      resized[i] = count > 0 ? sum / count : embedding[start] || 0
    }
    const magnitude = Math.sqrt(resized.reduce((sum, val) => sum + val * val, 0))
    return magnitude > 0 ? resized.map(val => val / magnitude) : resized
  }

  const padded = embedding.slice()
  while (padded.length < targetDimensions) {
    padded.push(0)
  }
  const magnitude = Math.sqrt(padded.reduce((sum, val) => sum + val * val, 0))
  return magnitude > 0 ? padded.map(val => val / magnitude) : padded
}

function getEmbeddingCacheKey(projectId: number, text: string): string {
  return `${projectId}:${text.slice(0, 512)}:${text.length}`
}

async function createEmbeddingProviderPromise(projectId: number) {
  return AIService.createEmbeddingProvider({
    projectId,
    usageType: 'RAG_EMBEDDING',
  })
}

async function getEmbeddingProvider(projectId: number) {
  if (!embeddingProviderCache.has(projectId)) {
    embeddingProviderCache.set(projectId, createEmbeddingProviderPromise(projectId))
  }
  return embeddingProviderCache.get(projectId)!
}

function buildDocumentText(title: string | null | undefined, content: string): string {
  return [title || '', content || ''].filter(Boolean).join('\n')
}

async function upsertRagDocuments(
  docs: Array<{
    projectId: number
    sourceType: RagSourceType
    sourceId: string
    chapterNo: number
    chunkNo: number
    title?: string | null
    content: string
    metadata?: Record<string, unknown>
    embedding: number[]
    embeddingModel?: string
  }>
): Promise<void> {
  if (!(await hasRagDocumentsTable())) {
    return
  }

  try {
    for (const doc of docs) {
      await prisma.$executeRaw`
        INSERT INTO rag_documents (
          id,
          project_id,
          source_type,
          source_id,
          chapter_no,
          chunk_no,
          title,
          content,
          metadata,
          embedding,
          embedding_model,
          created_at,
          updated_at
        ) VALUES (
          ${`${doc.projectId}:${doc.sourceType}:${doc.sourceId}:${doc.chunkNo}`},
          ${doc.projectId},
          ${doc.sourceType},
          ${doc.sourceId},
          ${doc.chapterNo},
          ${doc.chunkNo},
          ${doc.title ?? null},
          ${doc.content},
          ${(doc.metadata || {}) as Prisma.InputJsonValue},
          ${serializeVector(doc.embedding)}::vector,
          ${doc.embeddingModel || 'local-hash-v1'},
          NOW(),
          NOW()
        )
        ON CONFLICT (project_id, source_type, source_id, chunk_no)
        DO UPDATE SET
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          metadata = EXCLUDED.metadata,
          embedding = EXCLUDED.embedding,
          embedding_model = EXCLUDED.embedding_model,
          chapter_no = EXCLUDED.chapter_no,
          updated_at = NOW()
      `
    }
  } catch (error) {
    if (isMissingRagDocumentsError(error)) {
      warnMissingRagDocumentsTable(docs[0]?.projectId)
      return
    }
    throw error
  }
}

async function deleteRagDocumentsByProject(projectId: number): Promise<void> {
  if (!(await hasRagDocumentsTable())) {
    return
  }

  try {
    await prisma.$executeRaw`
      DELETE FROM rag_documents
      WHERE project_id = ${projectId}
    `
  } catch (error) {
    if (isMissingRagDocumentsError(error)) {
      warnMissingRagDocumentsTable(projectId)
      return
    }
    throw error
  }
}

async function countRagDocuments(projectId: number): Promise<number> {
  if (!(await hasRagDocumentsTable())) {
    return 0
  }  

  try {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM rag_documents
      WHERE project_id = ${projectId}
    `
    return Number(rows[0]?.count || 0)
  } catch (error) {
    if (isMissingRagDocumentsError(error)) {
      warnMissingRagDocumentsTable(projectId)
      return 0
    }
    throw error
  }
}

/**
 * 向量嵌入生成器
 */
async function generateEmbedding(
  text: string,
  projectId: number = 0
): Promise<number[]> {
  const normalizedText = text.trim()
  if (!normalizedText) {
    return new Array(VECTOR_DIMENSION).fill(0)
  }

  const cacheKey = getEmbeddingCacheKey(projectId, normalizedText)
  const cached = embeddingVectorCache.get(cacheKey)
  if (cached) {
    return cached.slice()
  }

  try {
    const provider = await getEmbeddingProvider(projectId)
    if (!provider.embedText) {
      throw new Error(`Provider ${provider.name} does not support embeddings`)
    }

    const embedding = await provider.embedText(normalizedText, {
      dimensions: VECTOR_DIMENSION,
      timeoutMs: 15000,
      user: projectId > 0 ? String(projectId) : undefined,
    })
    const normalizedEmbedding = normalizeEmbeddingDimensions(embedding, VECTOR_DIMENSION)
    embeddingVectorCache.set(cacheKey, normalizedEmbedding)
    if (embeddingVectorCache.size > EMBEDDING_CACHE_LIMIT) {
      const firstKey = embeddingVectorCache.keys().next().value
      if (firstKey) {
        embeddingVectorCache.delete(firstKey)
      }
    }
    return normalizedEmbedding.slice()
  } catch (error) {
    if (!embeddingFallbackWarned) {
      embeddingFallbackWarned = true
      logger.warn(
        { error, projectId },
        'Embedding provider unavailable, falling back to local deterministic vectorization'
      )
    }
    const fallbackEmbedding = buildVector(normalizedText, VECTOR_DIMENSION)
    embeddingVectorCache.set(cacheKey, fallbackEmbedding)
    return fallbackEmbedding.slice()
  }
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

async function searchIndexedRagDocuments(
  projectId: number,
  queryEmbedding: number[],
  options: {
    topK: number
    filter?: Partial<ChunkMetadata>
    maxChapterNo?: number
  }
): Promise<Array<SearchResult & { document: RagDocumentRow }>> {
  if (!(await hasRagDocumentsTable())) {
    return []
  }

  const { topK, filter, maxChapterNo } = options
  const candidateLimit = Math.max(topK * 6, 20)
  const vectorLiteral = serializeVector(queryEmbedding)
  const typeClause = filter?.type ? Prisma.sql`AND source_type = ${filter.type}` : Prisma.empty
  const chapterClause = filter?.chapterNo !== undefined ? Prisma.sql`AND chapter_no = ${filter.chapterNo}` : Prisma.empty
  const tagClause = filter?.tags?.length
    ? Prisma.sql`AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(COALESCE(metadata->'tags', '[]'::jsonb)) AS tag
      WHERE tag IN (${Prisma.join(filter.tags)})
    )`
    : Prisma.empty
  const chapterLimitClause = maxChapterNo !== undefined
    ? Prisma.sql`AND (chapter_no = 0 OR chapter_no <= ${maxChapterNo})`
    : Prisma.empty

  let rows: RagDocumentRow[]
  try {
    rows = await prisma.$queryRaw<RagDocumentRow[]>(Prisma.sql`
      SELECT
        id,
        project_id,
        source_type,
        source_id,
        chapter_no,
        chunk_no,
        title,
        content,
        metadata,
        1 - (embedding <=> ${vectorLiteral}::vector) AS embedding_score
      FROM rag_documents
      WHERE project_id = ${projectId}
        ${typeClause}
        ${chapterClause}
        ${tagClause}
        ${chapterLimitClause}
      ORDER BY embedding <=> ${vectorLiteral}::vector ASC
      LIMIT ${candidateLimit}
    `)
  } catch (error) {
    if (isMissingRagDocumentsError(error)) {
      warnMissingRagDocumentsTable(projectId)
      return []
    }
    throw error
  }

  return rows.map(row => {
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {}
    const chunkType = (metadata.type as ChunkMetadata['type']) || (row.source_type === 'chapter' ? 'plot' : 'setting')
    const importance = Number(metadata.importance ?? 1)
    const chunk: SemanticChunk = {
      id: row.id,
      content: row.content,
      embedding: queryEmbedding,
      metadata: {
        projectId: row.project_id,
        chapterNo: row.chapter_no,
        type: chunkType,
        importance,
        characters: Array.isArray(metadata.characters) ? metadata.characters.map(value => String(value)) : undefined,
        tags: Array.isArray(metadata.tags) ? metadata.tags.map(value => String(value)) : undefined,
      },
    }

    return {
      chunk,
      score: row.embedding_score ?? 0,
      rerankedContent: row.title ? `${row.title}\n${row.content}` : row.content,
      document: row,
    }
  })
}

function rerankHeuristically(query: string, result: SearchResult): number {
  const sourceBonus = result.chunk.metadata.importance * 0.1
  const recencyBonus = result.chunk.metadata.chapterNo > 0 ? Math.max(0, 1 - result.chunk.metadata.chapterNo / 500) * 0.05 : 0
  return (result.score * 0.8) + (keywordOverlapScore(query, result.chunk.content) * 0.15) + sourceBonus + recencyBonus
}

async function rerankWithAI(
  query: string,
  projectId: number,
  results: SearchResult[]
): Promise<SearchResult[] | null> {
  if (results.length <= 1) return results

  try {
    const provider = await AIService.createProvider({
      projectId,
      usageType: 'RAG_RERANK',
    })

    const prompt = [
      '你是小说检索重排器。请根据“查询”与“候选片段”的相关性进行严格重排。',
      '只输出 JSON 对象，不要解释，不要代码块。',
      '',
      `查询：${query}`,
      '',
      '候选片段：',
      ...results.map((result, index) => {
        const snippet = result.chunk.content.slice(0, 500)
        return `${index + 1}. id=${result.chunk.id}\nsource=${result.chunk.metadata.type}\nchapter=${result.chunk.metadata.chapterNo}\ncontent=${snippet}`
      }),
      '',
      '返回格式：',
      '{',
      '  "ranked": [',
      '    { "id": "片段id", "score": 0.0, "reason": "简短原因" }',
      '  ]',
      '}',
    ].join('\n')

    const response = await provider.generate(prompt, {
      temperature: 0,
      maxTokens: 800,
      responseFormat: { type: 'json_object' },
      timeoutMs: 15000,
    })

    const parsed = parseAiJsonObject<{ ranked?: Array<{ id: string; score?: number }> }>(response.content)
    const ranking = parsed.ranked || []
    if (ranking.length === 0) return null

    const byId = new Map(results.map(result => [result.chunk.id, result]))
    const rankedResults: SearchResult[] = []

    for (const item of ranking) {
      const found = byId.get(item.id)
      if (!found) continue
      rankedResults.push({
        ...found,
        score: Math.max(found.score, item.score ?? found.score),
      })
    }

    if (rankedResults.length === 0) return null

    const usedIds = new Set(rankedResults.map(item => item.chunk.id))
    for (const result of results) {
      if (!usedIds.has(result.chunk.id)) {
        rankedResults.push(result)
      }
    }

    return rankedResults.slice(0, results.length)
  } catch {
    return null
  }
}

async function indexChapterSemanticChunks(
  projectId: number,
  chapterNo: number,
  chapterTitle: string,
  content: string
): Promise<void> {
  const chunks = await semanticChunking(content, { chunkSize: 1200, overlap: 120, splitBy: 'paragraph' })
  const docs = await Promise.all(chunks.map(async (chunk, index) => ({
    projectId,
    sourceType: 'chapter' as const,
    sourceId: `chapter:${chapterNo}`,
    chapterNo,
    chunkNo: index,
    title: index === 0 ? chapterTitle : null,
    content: chunk.text,
    metadata: {
      type: deriveChunkType(chunk.text),
      importance: index === 0 ? 1 : 0.8,
      tags: ['chapter', `chapter:${chapterNo}`],
    },
    embedding: await generateEmbedding(`${chapterTitle}\n${chunk.text}`),
  })))

  await upsertRagDocuments(docs)
}

export async function rebuildProjectRAGIndex(projectId: number): Promise<{ indexedCount: number; rebuiltAt: Date }> {
  const [
    chapters,
    chapterSummaries,
    volumeSummaries,
    bookSummary,
    characters,
    plotlines,
    researchRefs,
  ] = await Promise.all([
    prisma.novelChapter.findMany({
      where: { projectId, content: { not: null } },
      select: { chapterNumber: true, title: true, content: true },
      orderBy: { chapterNumber: 'asc' },
    }),
    prisma.chapterSummary.findMany({
      where: { projectId },
      select: { chapterNo: true, summary: true, keyEvents: true, emotionalTone: true, plantedPlotlines: true, resolvedPlotlines: true },
      orderBy: { chapterNo: 'asc' },
    }),
    prisma.volumeSummary.findMany({
      where: { projectId },
      select: { volumeNumber: true, summary: true, keyEvents: true, plantedPlotlines: true, resolvedPlotlines: true },
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
      select: { id: true, topic: true, summary: true, keyFacts: true, creativeMaterials: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const docs: Array<Parameters<typeof upsertRagDocuments>[0][number]> = []

  for (const chapter of chapters) {
    const chapterText = chapter.content || ''
    const chunks = await semanticChunking(chapterText, { chunkSize: 1200, overlap: 120, splitBy: 'paragraph' })
    for (const [index, chunk] of chunks.entries()) {
      docs.push({
        projectId,
        sourceType: 'chapter',
        sourceId: `chapter:${chapter.chapterNumber}`,
        chapterNo: chapter.chapterNumber,
        chunkNo: index,
        title: index === 0 ? chapter.title : null,
        content: chunk.text,
        metadata: {
          type: deriveChunkType(chunk.text),
          importance: index === 0 ? 1 : 0.8,
        },
        embedding: await generateEmbedding(buildDocumentText(chapter.title, chunk.text)),
      })
    }
  }

  for (const summary of chapterSummaries) {
    const content = [
      `第${summary.chapterNo}章摘要：${summary.summary}`,
      summary.keyEvents.length > 0 ? `关键事件：${summary.keyEvents.join('；')}` : '',
      summary.emotionalTone ? `情绪：${summary.emotionalTone}` : '',
      summary.plantedPlotlines.length > 0 ? `埋设伏笔：${summary.plantedPlotlines.join('；')}` : '',
      summary.resolvedPlotlines.length > 0 ? `回收伏笔：${summary.resolvedPlotlines.join('；')}` : '',
    ].filter(Boolean).join('\n')

    docs.push({
      projectId,
      sourceType: 'chapter_summary',
      sourceId: `chapter_summary:${summary.chapterNo}`,
      chapterNo: summary.chapterNo,
      chunkNo: 0,
      title: `第${summary.chapterNo}章摘要`,
      content,
      metadata: { type: 'plot', importance: 1, source: 'chapter_summary' },
      embedding: await generateEmbedding(content),
    })
  }

  for (const volume of volumeSummaries) {
    const content = [
      `第${volume.volumeNumber}卷摘要：${volume.summary}`,
      volume.keyEvents.length > 0 ? `关键事件：${volume.keyEvents.join('；')}` : '',
      volume.plantedPlotlines.length > 0 ? `埋设伏笔：${volume.plantedPlotlines.join('；')}` : '',
      volume.resolvedPlotlines.length > 0 ? `回收伏笔：${volume.resolvedPlotlines.join('；')}` : '',
    ].filter(Boolean).join('\n')

    docs.push({
      projectId,
      sourceType: 'volume_summary',
      sourceId: `volume_summary:${volume.volumeNumber}`,
      chapterNo: volume.volumeNumber * 1000,
      chunkNo: 0,
      title: `第${volume.volumeNumber}卷摘要`,
      content,
      metadata: { type: 'plot', importance: 0.95, source: 'volume_summary' },
      embedding: await generateEmbedding(content),
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
      characterArcLines.length > 0 ? `人物弧线：${characterArcLines.join('；')}` : '',
    ].filter(Boolean).join('\n')

    docs.push({
      projectId,
      sourceType: 'book_summary',
      sourceId: 'book_summary',
      chapterNo: 0,
      chunkNo: 0,
      title: '全书摘要',
      content,
      metadata: { type: 'plot', importance: 1, source: 'book_summary' },
      embedding: await generateEmbedding(content),
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

    docs.push({
      projectId,
      sourceType: 'character',
      sourceId: `character:${character.name}`,
      chapterNo: character.lastUpdated || 0,
      chunkNo: 0,
      title: character.name,
      content,
      metadata: {
        type: 'character',
        characters: [character.name],
        importance: character.role === CharacterRole.PROTAGONIST ? 1 : 0.8,
        source: 'character',
      },
      embedding: await generateEmbedding(content),
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

    docs.push({
      projectId,
      sourceType: 'plotline',
      sourceId: `plotline:${plotline.id}`,
      chapterNo: plotline.plantedAt,
      chunkNo: 0,
      title: plotline.description,
      content,
      metadata: {
        type: 'plot',
        importance: plotline.status === PlotlineStatus.RESOLVED ? 0.7 : 1,
        tags: [plotline.status],
        source: 'plotline',
      },
      embedding: await generateEmbedding(content),
    })
  }

  for (const ref of researchRefs) {
    const content = [
      `研究主题：${ref.topic}`,
      ref.summary,
      ref.keyFacts.length > 0 ? `关键事实：${ref.keyFacts.join('；')}` : '',
      ref.creativeMaterials.length > 0 ? `创作素材：${ref.creativeMaterials.join('；')}` : '',
    ].filter(Boolean).join('\n')

    docs.push({
      projectId,
      sourceType: 'research',
      sourceId: `research:${ref.id}`,
      chapterNo: 0,
      chunkNo: 0,
      title: ref.topic,
      content,
      metadata: {
        type: 'setting',
        importance: 0.7,
        source: 'research',
      },
      embedding: await generateEmbedding(content),
    })
  }

  await deleteRagDocumentsByProject(projectId)
  await upsertRagDocuments(docs)

  return { indexedCount: docs.length, rebuiltAt: new Date() }
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
    maxChapterNo?: number
  } = {}
): Promise<SearchResult[]> {
  const { topK = 5, filter, useRerank = true, maxChapterNo } = options
  const queryEmbedding = await generateEmbedding(query)

  let candidates = await searchIndexedRagDocuments(projectId, queryEmbedding, {
    topK,
    filter,
    maxChapterNo,
  })

  if (candidates.length === 0) {
    await rebuildProjectRAGIndex(projectId)
    candidates = await searchIndexedRagDocuments(projectId, queryEmbedding, {
      topK,
      filter,
      maxChapterNo,
    })
  }

  const heuristicScored = candidates.map(result => ({
    ...result,
    score: rerankHeuristically(query, result),
  }))

  const reranked = useRerank
    ? await rerankWithAI(query, projectId, heuristicScored) || heuristicScored
    : heuristicScored

  reranked.sort((a, b) => b.score - a.score)

  return reranked.slice(0, topK).map(item => ({
    chunk: item.chunk,
    score: item.score,
    rerankedContent: item.rerankedContent,
  }))
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
    maxChapterNo: chapterNo,
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
  const chapter = await prisma.novelChapter.findFirst({
    where: { projectId, chapterNumber: chapterNo },
    select: { title: true },
  })
  const chapterTitle = chapter?.title || `第${chapterNo}章`
  await indexChapterSemanticChunks(projectId, chapterNo, chapterTitle, content)

  const chunks = await semanticChunking(content, options)
  return {
    chunkCount: chunks.length,
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

export async function getRAGDocumentCount(projectId: number): Promise<number> {
  return countRagDocuments(projectId)
}

export type { VectorConfig, ChunkMetadata, SemanticChunk, SearchResult }
