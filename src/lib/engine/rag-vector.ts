/**
 * RAG (Retrieval-Augmented Generation) 向量数据库系统
 * 为超长篇小说提供语义检索增强的上下文管理
 */
import { AIService } from '@/lib/ai/service'

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

/**
 * 向量嵌入生成器
 */
async function generateEmbedding(
  text: string,
  projectId: number = 0
): Promise<number[]> {
  const provider = await AIService.createProvider({
    projectId,
    usageType: 'EMBEDDING',
  })

  // 使用 provider 的 generate 方法生成嵌入表示
  // 实际项目中应该使用专门的嵌入 API
  // 这里使用估算方法作为后备
  const result = await provider.generate(`请分析以下内容的语义向量：${text.slice(0, 1000)}`, {
    temperature: 0.1,
    maxTokens: 100,
  })
  
  // 模拟向量（实际应该使用专门的嵌入模型）
  // 这里返回一个模拟的向量表示
  const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const dimension = 1536
  const embedding: number[] = []
  
  for (let i = 0; i < dimension; i++) {
    embedding.push(Math.sin(hash * (i + 1) * 0.01) * 0.5 + 0.5)
  }
  
  // 归一化
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
  return embedding.map(val => val / magnitude)
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
  const provider = await AIService.createProvider({
    projectId,
    usageType: 'CLASSIFIER',
  })

  const prompt = `分析以下小说内容片段，判断其主要类型：

内容：
${chunk.slice(0, 500)}

类型选项：
- plot: 情节推进、事件发展
- character: 人物描写、内心独白、性格展现
- setting: 环境描写、世界观介绍
- dialogue: 对话为主
- action: 动作场面、打斗

请只输出一个词：plot/character/setting/dialogue/action`

  const result = await provider.generate(prompt, {
    temperature: 0.1,
    maxTokens: 10,
  })

  const type = result.content.toLowerCase().trim()
  if (['plot', 'character', 'setting', 'dialogue', 'action'].includes(type)) {
    return type as ChunkMetadata['type']
  }
  return 'plot'
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

  // 1. 生成查询向量
  const queryEmbedding = await generateEmbedding(query)

  // 2. 向量相似度搜索（这里需要连接实际的向量数据库）
  // TODO: 实现实际的向量数据库连接
  // const results = await vectorStore.search(queryEmbedding, { topK, filter })

  // 3. 模拟搜索结果（实际使用时替换为真实数据库查询）
  const mockResults: SearchResult[] = []

  return mockResults
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
    topK: maxChunks,
    filter: includeTypes ? { type: includeTypes[0] } : undefined,
    useRerank: rerank,
  })

  // 2. 构建增强上下文
  const contextParts: string[] = []
  const sources: Array<{ chapterNo: number; type: string; relevance: number }> = []

  for (const result of searchResults) {
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
