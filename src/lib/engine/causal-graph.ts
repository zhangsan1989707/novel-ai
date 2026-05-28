/**
 * 因果图系统
 * 追踪章节间的因果关系，校验新章是否与已有因果链冲突
 */

import { prisma } from '@/lib/prisma'

/** 因果节点（一个事件） */
export interface CausalNode {
  id: string
  chapterNo: number
  event: string
  /** 事件类型：cause(因) / effect(果) / consequence(后果) */
  type: 'cause' | 'effect' | 'consequence'
  /** 关联角色 */
  characters: string[]
}

/** 因果边（两个事件间的因果关系） */
export interface CausalEdge {
  from: string
  to: string
  /** 关系描述 */
  relation: string
  /** 置信度 */
  confidence: 'high' | 'medium' | 'low'
}

/** 因果图 */
export interface CausalGraph {
  nodes: CausalNode[]
  edges: CausalEdge[]
}

/** 因果冲突 */
export interface CausalConflict {
  type: 'orphan_effect' | 'contradiction' | 'broken_chain' | 'timeline_violation'
  severity: 'critical' | 'major' | 'minor'
  description: string
  affectedChapters: number[]
  suggestion: string
}

/** 因果校验报告 */
export interface CausalValidationReport {
  isValid: boolean
  conflicts: CausalConflict[]
  newNodes: CausalNode[]
  newEdges: CausalEdge[]
  score: number
}

/**
 * 从章节摘要中提取因果事件（简化版，基于关键词匹配）
 */
export function extractCausalEvents(
  chapterNo: number,
  content: string,
  summary: string
): CausalNode[] {
  const nodes: CausalNode[] = []
  const sentences = summary.split(/[。！？；]/).filter(s => s.trim())

  const causePatterns = /因为|由于|起因是|导火索|根源|缘故|起源于/
  const effectPatterns = /导致|因此|于是|所以|结果|造成|引发|触发|迫使/
  const consequencePatterns = /最终|最后|结局|后果|代价|代价是|换来/

  for (const sentence of sentences) {
    const trimmed = sentence.trim()
    if (!trimmed) continue

    let type: CausalNode['type'] = 'effect'
    if (consequencePatterns.test(trimmed)) type = 'consequence'
    else if (causePatterns.test(trimmed)) type = 'cause'
    else if (effectPatterns.test(trimmed)) type = 'effect'
    else continue

    nodes.push({
      id: `${chapterNo}-${nodes.length}`,
      chapterNo,
      event: trimmed,
      type,
      characters: [],
    })
  }

  return nodes
}

/**
 * 构建因果图（从数据库中的章节摘要构建）
 */
export async function buildCausalGraph(projectId: number): Promise<CausalGraph> {
  const chapters = await prisma.novelChapter.findMany({
    where: { projectId, status: 'COMPLETED' },
    orderBy: { chapterNumber: 'asc' },
    select: { chapterNumber: true, summary: true, content: true },
  })

  const nodes: CausalNode[] = []
  const edges: CausalEdge[] = []

  for (const chapter of chapters) {
    if (!chapter.summary) continue
    const chapterNodes = extractCausalEvents(
      chapter.chapterNumber,
      chapter.content || '',
      chapter.summary
    )
    nodes.push(...chapterNodes)
  }

  // 构建边：相邻章节间的因果关系
  for (let i = 0; i < nodes.length - 1; i++) {
    const current = nodes[i]
    const next = nodes[i + 1]

    // 同一章节内的因果
    if (current.chapterNo === next.chapterNo) {
      edges.push({
        from: current.id,
        to: next.id,
        relation: '同章因果',
        confidence: 'high',
      })
    }
    // 跨章节因果（距离越远置信度越低）
    else {
      const distance = next.chapterNo - current.chapterNo
      const confidence = distance <= 3 ? 'high' : distance <= 10 ? 'medium' : 'low'
      if (current.type !== 'consequence' && next.type !== 'cause') {
        edges.push({
          from: current.id,
          to: next.id,
          relation: '跨章因果',
          confidence,
        })
      }
    }
  }

  return { nodes, edges }
}

/**
 * 校验新章节的因果一致性
 */
export async function validateCausalConsistency(
  projectId: number,
  chapterNo: number,
  newChapterSummary: string
): Promise<CausalValidationReport> {
  const graph = await buildCausalGraph(projectId)
  const newNodes = extractCausalEvents(chapterNo, '', newChapterSummary)
  const conflicts: CausalConflict[] = []

  // 检查：新章的效果节点是否有因
  const newEffects = newNodes.filter(n => n.type === 'effect')
  for (const effect of newEffects) {
    // 查找是否有前序章节的 cause 节点可以关联
    const potentialCauses = graph.nodes.filter(
      n => n.type === 'cause' && n.chapterNo < chapterNo && n.chapterNo >= chapterNo - 10
    )
    if (potentialCauses.length === 0) {
      conflicts.push({
        type: 'orphan_effect',
        severity: 'minor',
        description: `第${chapterNo}章的效果"${effect.event}"缺少前因铺垫`,
        affectedChapters: [chapterNo],
        suggestion: '建议在前几章补充起因铺垫，或在本章中交代前因',
      })
    }
  }

  // 检查：新章的因节点是否与已有后果矛盾
  const newCauses = newNodes.filter(n => n.type === 'cause')
  const existingConsequences = graph.nodes.filter(n => n.type === 'consequence')
  for (const cause of newCauses) {
    for (const consequence of existingConsequences) {
      // 如果已有后果在新因之后发生，可能存在矛盾
      if (consequence.chapterNo < chapterNo && consequence.chapterNo > chapterNo - 5) {
        // 简单语义冲突检测（关键词矛盾）
        const hasConflict = checkSemanticContradiction(cause.event, consequence.event)
        if (hasConflict) {
          conflicts.push({
            type: 'contradiction',
            severity: 'major',
            description: `第${chapterNo}章的"${cause.event}"与第${consequence.chapterNo}章的"${consequence.event}"可能矛盾`,
            affectedChapters: [chapterNo, consequence.chapterNo],
            suggestion: '请检查两处描述是否逻辑一致',
          })
        }
      }
    }
  }

  // 检查时间线违反
  const timelineViolations = checkTimelineViolations(graph, newNodes, chapterNo)
  conflicts.push(...timelineViolations)

  const score = Math.max(0, 100 - conflicts.filter(c => c.severity === 'critical').length * 30
    - conflicts.filter(c => c.severity === 'major').length * 15
    - conflicts.filter(c => c.severity === 'minor').length * 5)

  // 构建新边
  const newEdges: CausalEdge[] = []
  for (const node of newNodes) {
    const prevNodes = graph.nodes.filter(n => n.chapterNo >= chapterNo - 3 && n.chapterNo < chapterNo)
    for (const prev of prevNodes) {
      if (prev.type !== 'consequence' && node.type !== 'cause') {
        newEdges.push({
          from: prev.id,
          to: node.id,
          relation: '跨章因果',
          confidence: 'medium',
        })
      }
    }
  }

  return {
    isValid: conflicts.filter(c => c.severity === 'critical').length === 0,
    conflicts,
    newNodes,
    newEdges,
    score,
  }
}

/**
 * 简单语义矛盾检测（基于关键词对）
 */
function checkSemanticContradiction(text1: string, text2: string): boolean {
  const contradictionPairs: [string, string][] = [
    ['死亡', '活着'], ['消灭', '出现'], ['摧毁', '建造'],
    ['离开', '留下'], ['失败', '成功'], ['消失', '存在'],
    ['拒绝', '接受'], ['背叛', '忠诚'], ['分离', '团聚'],
  ]

  for (const [a, b] of contradictionPairs) {
    if ((text1.includes(a) && text2.includes(b)) || (text1.includes(b) && text2.includes(a))) {
      return true
    }
  }
  return false
}

/**
 * 检查时间线违反
 */
function checkTimelineViolations(
  graph: CausalGraph,
  newNodes: CausalNode[],
  currentChapter: number
): CausalConflict[] {
  const conflicts: CausalConflict[] = []

  // 检查：是否有后果节点在当前章之后但逻辑上应该在当前章之前
  const futureConsequences = graph.nodes.filter(
    n => n.type === 'consequence' && n.chapterNo > currentChapter
  )

  for (const fc of futureConsequences) {
    const relatedCause = graph.nodes.find(
      n => n.type === 'cause' && n.chapterNo >= currentChapter
    )
    if (relatedCause) {
      const edgeExists = graph.edges.some(e => e.from === relatedCause.id && e.to === fc.id)
      if (edgeExists) {
        conflicts.push({
          type: 'timeline_violation',
          severity: 'minor',
          description: `第${currentChapter}章的新因可能提前揭示第${fc.chapterNo}章的后果`,
          affectedChapters: [currentChapter, fc.chapterNo],
          suggestion: '考虑调整叙述顺序，避免提前剧透',
        })
      }
    }
  }

  return conflicts
}
