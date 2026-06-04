import type { CharacterProfile } from './types'
import type { AIProvider } from '@/lib/ai/types'

export type ContinuityIssueSeverity = 'critical' | 'major' | 'minor'

export interface ContinuityAnchor {
  previousChapterNo: number
  previousEnding: string
  mustContinueFrom: string
  expectedOpeningLocation?: string
  protagonistName?: string
  forbiddenJumps: string[]
  openingObligation?: OpeningObligation
  previousEmotionalTone?: string
  emotionalArcTrend?: 'rising' | 'falling' | 'stable'
  relationshipSummary?: string
}

export type OpeningObligationType =
  | 'decision'
  | 'question'
  | 'countdown'
  | 'system_prompt'
  | 'arrival'
  | 'threat'
  | 'reveal'
  | 'state_change'
  | 'unknown'

export interface OpeningObligation {
  type: OpeningObligationType
  triggerText: string
  requiredOpeningAction: string
  canDefer: boolean
}

export interface ChapterContinuitySnapshot {
  chapterNo: number
  openingScene: string
  endingScene: string
  currentLocation?: string
  protagonistStatus?: string
  activeCharacters: string[]
  newCharacters: string[]
  acquiredResources: string[]
  lostResources: string[]
  unresolvedHooks: string[]
  nextChapterMustContinueFrom: string
  continuityLocks: {
    protagonistName?: string
    locationAtEnd?: string
    vehicleAtEnd?: string
    resourceStatus?: string
  }
}

export interface ContinuityAuditIssue {
  severity: ContinuityIssueSeverity
  type: string
  description: string
  suggestedFix: string
}

export interface ContinuityAuditResult {
  passed: boolean
  score: number
  issues: ContinuityAuditIssue[]
  rewriteInstruction?: string
}

const LOCATION_TERMS = ['逃生舱', '石室', '柴房', '黑市', '空间站', '铁锈带', '舰桥', '飞船', '港口', '基地', '避难所', '星港']
const RESOURCE_TERMS = ['飞船', '舰船', '船', '武器', '能源', '燃料', '货物', '同伴']
const TRANSITION_TERMS = ['之后', '随后', '离开', '抵达', '赶到', '穿过', '转移', '逃出', '降落', '靠岸', '泊入']
const DECISION_TERMS = ['选择', '决定', '决策', '点向', '按下', '确认', '拒绝', '暂缓', '拖延', '中断']
const QUESTION_RESPONSE_TERMS = ['回答', '反问', '沉默', '避开', '打断', '追问', '摇头', '点头']
const SYSTEM_TERMS = ['系统', '屏幕', '手机', '提示', '选项', '宿主']
const UNRESOLVED_ENDING_PATTERNS = [
  /屏幕.{0,12}(提示|文字|数字|画面).{0,12}(变了|跳出|亮起|闪烁)[。！？!?]?$/,
  /(门|舱门|通讯|终端|警报).{0,12}(响了|开了|亮了|变了)[。！？!?]?$/,
]

// ============================================
// 动态词表（从世界设定中提取地点/资源）
// ============================================

export interface DynamicVocabulary {
  locations: Set<string>
  resources: Set<string>
}

const LOCATION_VERBS = ['在', '到', '从', '去', '进入', '离开', '抵达', '赶到', '回到', '来到', '逃出', '走出']
const RESOURCE_VERBS = ['拥有', '获得', '丢失', '驾驶', '登上', '买下', '拿到', '找到', '失去', '摧毁', '修复']

/**
 * 从文本中提取可能的地点名词（出现在地点动词后的 2-6 字中文词组）
 */
function extractLocationNouns(text: string): string[] {
  const locations: string[] = []
  for (const verb of LOCATION_VERBS) {
    const regex = new RegExp(`${verb}[了着过]?\\s*([\\u4e00-\\u9fa5]{2,6})`, 'gu')
    const matches = text.matchAll(regex)
    for (const match of matches) {
      if (match[1] && !LOCATION_VERBS.includes(match[1])) {
        locations.push(match[1])
      }
    }
  }
  return locations
}

/**
 * 从文本中提取可能的资源名词（出现在资源动词后的 2-6 字中文词组）
 */
function extractResourceNouns(text: string): string[] {
  const resources: string[] = []
  for (const verb of RESOURCE_VERBS) {
    const regex = new RegExp(`${verb}[了着过]?\\s*([\\u4e00-\\u9fa5]{2,6})`, 'gu')
    const matches = text.matchAll(regex)
    for (const match of matches) {
      if (match[1] && !RESOURCE_VERBS.includes(match[1])) {
        resources.push(match[1])
      }
    }
  }
  return resources
}

/**
 * 构建动态词表：从世界设定、角色档案、历史摘要中提取地点和资源名词
 */
export function buildDynamicVocabulary(params: {
  worldSetting?: string | null
  previousChapterEnding?: string | null
  recentChapterSummaries?: Array<{ summary: string }>
}): DynamicVocabulary {
  const locations = new Set<string>()
  const resources = new Set<string>()

  // 从世界设定中提取
  if (params.worldSetting) {
    for (const noun of extractLocationNouns(params.worldSetting)) {
      locations.add(noun)
    }
  }

  // 从上一章结尾中提取
  if (params.previousChapterEnding) {
    for (const noun of extractLocationNouns(params.previousChapterEnding)) {
      locations.add(noun)
    }
    for (const noun of extractResourceNouns(params.previousChapterEnding)) {
      resources.add(noun)
    }
  }

  // 从最近章节摘要中提取
  if (params.recentChapterSummaries) {
    for (const summary of params.recentChapterSummaries) {
      for (const noun of extractLocationNouns(summary.summary)) {
        locations.add(noun)
      }
      for (const noun of extractResourceNouns(summary.summary)) {
        resources.add(noun)
      }
    }
  }

  return { locations, resources }
}

// 情绪紧张度关键词
const HIGH_TENSION_WORDS = ['紧张', '危险', '恐惧', '逃跑', '战斗', '攻击', '警报', '爆炸', '追逐', '威胁', '杀', '死', '伤', '血', '怒', '吼']
const LOW_TENSION_WORDS = ['平静', '悠闲', '轻松', '哈哈', '微笑', '温暖', '舒适', '安静', '祥和', '欢乐', '笑', '乐', '喜']
const OBLIGATION_PATTERNS: Array<{
  type: OpeningObligationType
  pattern: RegExp
  requiredOpeningAction: string
  canDefer: boolean
}> = [
  {
    type: 'decision',
    pattern: /(请宿主决策|请.*?(选择|决定|决策)|请选择|是否|选项|【\s*\d+[.．、])/u,
    requiredOpeningAction: '开篇必须先处理上一章留下的选择：让主角作出选择、拒绝、拖延或被迫中断，并写出系统或现场的即时反馈。',
    canDefer: true,
  },
  {
    type: 'countdown',
    pattern: /(倒计时|还剩|最后.*?(秒|分钟|时辰)|计时)/u,
    requiredOpeningAction: '开篇必须先处理上一章倒计时或时限压力，写出时间推进后的即时后果。',
    canDefer: false,
  },
  {
    type: 'system_prompt',
    pattern: /(系统|屏幕|手机|终端).{0,18}(提示|弹出|亮起|闪烁|变了|显示)/u,
    requiredOpeningAction: '开篇必须先处理上一章的系统或屏幕提示，写出提示内容、主角反应或它造成的新限制。',
    canDefer: true,
  },
  {
    type: 'question',
    pattern: /[？?]\s*$/u,
    requiredOpeningAction: '开篇必须回答、回避、打断或升级上一章的问题，不能直接切到新场景。',
    canDefer: true,
  },
  {
    type: 'arrival',
    pattern: /(到了|抵达|赶到|推门|门开|舱门开|有人来了)/u,
    requiredOpeningAction: '开篇必须承接上一章的抵达、开门或来人事件，写出进入场面的第一反应。',
    canDefer: false,
  },
  {
    type: 'threat',
    pattern: /(杀|死|追来|威胁|危险|警报|敌人|包围)/u,
    requiredOpeningAction: '开篇必须承接上一章的威胁或警报，写出主角如何应对第一波压力。',
    canDefer: false,
  },
  {
    type: 'reveal',
    pattern: /(真相|身份|名字|露出|揭开|发现|看见)/u,
    requiredOpeningAction: '开篇必须处理上一章揭示的信息，写出主角或现场人物的即时反应。',
    canDefer: true,
  },
  {
    type: 'state_change',
    pattern: /(变了|亮起|闪烁|打开|关闭|裂开|消失)/u,
    requiredOpeningAction: '开篇必须处理上一章最后的状态变化，写出变化结果或主角的下一步动作。',
    canDefer: true,
  },
  {
    type: 'reveal',
    pattern: /[。！？!?]["'"」」]?[…]{1,3}\s*$/u,
    requiredOpeningAction: '上一章以省略号结尾，暗示未尽之意。开篇必须承接这种悬念氛围，揭示或推进省略号暗示的内容。',
    canDefer: true,
  },
  {
    type: 'state_change',
    pattern: /[。！？!?]["'"」」]?——\s*$/u,
    requiredOpeningAction: '上一章以破折号结尾，暗示突然中断。开篇必须承接中断场景，写出中断后的发展或结果。',
    canDefer: true,
  },
  {
    type: 'question',
    pattern: /["'"「」].*?["'"「」]\s*$/u,
    requiredOpeningAction: '上一章以对话结尾。开篇必须承接这段对话，写出对话的回应或对话后的行动。',
    canDefer: true,
  },
]

function normalizeText(value?: string | null): string {
  return (value || '').trim().replace(/\s+/g, '')
}

function clampText(value: string, maxChars: number): string {
  const text = value.trim()
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1)}…`
}

function getOpeningText(content: string): string {
  return content
    .replace(/^#?\s*第[一二三四五六七八九十百千万\d]+章[^\n]*\n*/u, '')
    .trim()
    .slice(0, 900)
}

function getEndingText(content: string): string {
  return content.trim().slice(-500)
}

function extractLocation(text: string, dynamicLocations?: Set<string>): string | undefined {
  const allLocations = dynamicLocations
    ? new Set([...LOCATION_TERMS, ...dynamicLocations])
    : new Set(LOCATION_TERMS)
  return Array.from(allLocations).find(term => text.includes(term))
}

function extractObligationTrigger(text: string, pattern: RegExp): string {
  const lines = text
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
  const matchedLine = lines.findLast(line => pattern.test(line))
  return clampText(matchedLine || text.slice(-160), 160)
}

function extractOpeningObligation(previousEnding: string): OpeningObligation | undefined {
  for (const rule of OBLIGATION_PATTERNS) {
    if (rule.pattern.test(previousEnding)) {
      return {
        type: rule.type,
        triggerText: extractObligationTrigger(previousEnding, rule.pattern),
        requiredOpeningAction: rule.requiredOpeningAction,
        canDefer: rule.canDefer,
      }
    }
  }

  // Fallback：以感叹号或问号结尾但未匹配到具体模式
  const trimmed = previousEnding.trim()
  if (/[！!?？]\s*$/.test(trimmed)) {
    return {
      type: 'unknown',
      triggerText: clampText(trimmed.slice(-160), 160),
      requiredOpeningAction: '上一章以强烈语气结尾。开篇必须承接这种情绪张力，处理结尾暗示的冲突或悬念。',
      canDefer: true,
    }
  }

  return undefined
}

function inferProtagonistName(
  characterProfiles: Array<Pick<CharacterProfile, 'name' | 'role'>> = [],
  protagonistProfile?: string | null
): string | undefined {
  const protagonist = characterProfiles.find(character => String(character.role) === 'PROTAGONIST')
  if (protagonist?.name) return protagonist.name

  const profile = protagonistProfile || ''
  const explicitMatch = profile.match(/(?:主角|女主|男主|姓名|名字|realName|name)[：:\s]*([\u4e00-\u9fa5]{2,4})/u)
  if (explicitMatch?.[1]) return explicitMatch[1]

  return undefined
}

function extractAnchorKeywords(text: string): string[] {
  const source = text.slice(-120)
  const matches = source.match(/[\u4e00-\u9fa5]{2,6}/gu) || []
  const stopWords = new Set(['屏幕上', '提示变', '这一刻', '的时候', '突然间', '告诉读者'])
  return Array.from(new Set(matches.flatMap(match => {
    if (match.length <= 3) return [match]
    const chunks: string[] = []
    for (let i = 0; i <= match.length - 2; i += 1) {
      chunks.push(match.slice(i, i + 2))
    }
    return chunks
  }))).filter(item => !stopWords.has(item)).slice(-12)
}

function hasTransition(opening: string): boolean {
  return TRANSITION_TERMS.some(term => opening.includes(term))
}

function hasSerialFlowResponse(opening: string, obligation: OpeningObligation): boolean {
  const triggerKeywords = extractAnchorKeywords(obligation.triggerText)
  const matchedTrigger = triggerKeywords.some(keyword => opening.includes(keyword))
  const hasSystemTerm = SYSTEM_TERMS.some(term => opening.includes(term))

  if (obligation.type === 'decision') {
    return (
      DECISION_TERMS.some(term => opening.includes(term)) ||
      (matchedTrigger && hasSystemTerm)
    )
  }

  if (obligation.type === 'question') {
    return QUESTION_RESPONSE_TERMS.some(term => opening.includes(term)) || matchedTrigger
  }

  if (obligation.type === 'system_prompt') {
    return hasSystemTerm && (matchedTrigger || DECISION_TERMS.some(term => opening.includes(term)))
  }

  return matchedTrigger
}

function detectSameSurnameDrift(content: string, protagonistName: string): string | null {
  if (protagonistName.length < 2) return null
  const surname = protagonistName.slice(0, 1)
  const nameTailLength = protagonistName.length - 1
  const candidates = content.slice(0, 1200).match(new RegExp(`${surname}[\\u4e00-\\u9fa5]{${nameTailLength}}`, 'gu')) || []
  const drift = candidates.find(name => name !== protagonistName)
  return drift || null
}

function buildRewriteInstruction(issues: ContinuityAuditIssue[]): string | undefined {
  const blocking = issues.filter(issue => issue.severity === 'critical' || issue.severity === 'major')
  if (blocking.length === 0) return undefined
  return [
    '请重写本章，修复以下连续性问题：',
    ...blocking.map(issue => `- ${issue.description}。${issue.suggestedFix}`),
  ].join('\n')
}

export function buildContinuityAnchor(params: {
  chapterNo: number
  previousChapterEnding?: string | null
  characterProfiles?: Array<Pick<CharacterProfile, 'name' | 'role'> & Partial<Pick<CharacterProfile, 'relationships'>>>
  protagonistProfile?: string | null
  dynamicVocabulary?: DynamicVocabulary
  previousEmotionalTone?: string
  emotionalArcTrend?: 'rising' | 'falling' | 'stable'
}): ContinuityAnchor | null {
  const previousEnding = (params.previousChapterEnding || '').trim()
  if (params.chapterNo <= 1 || !previousEnding) return null

  const expectedOpeningLocation = extractLocation(previousEnding, params.dynamicVocabulary?.locations)
  const protagonistName = inferProtagonistName(params.characterProfiles, params.protagonistProfile)
  const forbiddenJumps = [
    '不得跳过上一章最后一个动作或提示',
    '不得无过渡跳转到黑市、港口、基地或新地点',
    '不得突然新增未铺垫同伴、飞船、武器或安全据点',
    '不得更改主角姓名或用另一个名字替代主角',
  ]
  const openingObligation = extractOpeningObligation(previousEnding)

  // 构建人物关系摘要
  const relationshipSummary = buildRelationshipSummary(params.characterProfiles)

  return {
    previousChapterNo: params.chapterNo - 1,
    previousEnding,
    mustContinueFrom: clampText(previousEnding, 240),
    expectedOpeningLocation,
    protagonistName,
    forbiddenJumps,
    openingObligation,
    previousEmotionalTone: params.previousEmotionalTone,
    emotionalArcTrend: params.emotionalArcTrend,
    relationshipSummary,
  }
}

function buildRelationshipSummary(
  characterProfiles?: Array<Pick<CharacterProfile, 'name' | 'role'> & Partial<Pick<CharacterProfile, 'relationships'>>>
): string | undefined {
  if (!characterProfiles || characterProfiles.length === 0) return undefined

  const pairs: string[] = []
  for (const char of characterProfiles) {
    if (char.relationships) {
      for (const [target, relation] of Object.entries(char.relationships)) {
        if (relation && target) {
          pairs.push(`${char.name}-${target}:${relation}`)
        }
      }
    }
  }

  return pairs.length > 0 ? pairs.slice(0, 10).join(', ') : undefined
}

export function formatContinuityAnchorSection(anchor: ContinuityAnchor): string {
  return [
    '这是本章最高优先级连续性约束。',
    `必须无缝承接第${anchor.previousChapterNo}章结尾：`,
    anchor.mustContinueFrom,
    anchor.openingObligation ? [
      '开篇承诺：',
      `- 类型：${anchor.openingObligation.type}`,
      `- 触发文本：${anchor.openingObligation.triggerText}`,
      `- ${anchor.openingObligation.requiredOpeningAction}`,
      '- 网文连载链路：接钩 -> 短兑现/反转 -> 新阻碍升级 -> 本章目标 -> 章尾再钩',
    ].join('\n') : '',
    anchor.protagonistName ? `主角姓名锁定：${anchor.protagonistName}` : '',
    anchor.expectedOpeningLocation ? `开场地点必须承接：${anchor.expectedOpeningLocation}` : '',
    anchor.previousEmotionalTone ? `上一章情绪基调：${anchor.previousEmotionalTone}` : '',
    anchor.emotionalArcTrend ? `情绪趋势：${anchor.emotionalArcTrend === 'rising' ? '上升（紧张）' : anchor.emotionalArcTrend === 'falling' ? '下降（舒缓）' : '平稳'}` : '',
    anchor.relationshipSummary ? `人物关系：${anchor.relationshipSummary}` : '',
    '禁止事项：',
    ...anchor.forbiddenJumps.map(item => `- ${item}`),
  ].filter(Boolean).join('\n')
}

export function auditChapterContinuity(params: {
  chapterNo: number
  content: string
  anchor?: ContinuityAnchor | null
}): ContinuityAuditResult {
  const { anchor, content } = params
  const issues: ContinuityAuditIssue[] = []
  if (!anchor) {
    return { passed: true, score: 100, issues: [] }
  }

  const normalizedContent = normalizeText(content)
  const opening = normalizeText(getOpeningText(content))
  const ending = normalizeText(getEndingText(content))

  if (anchor.protagonistName) {
    const driftName = detectSameSurnameDrift(content, anchor.protagonistName)
    if (driftName && !normalizedContent.includes(anchor.protagonistName)) {
      issues.push({
        severity: 'critical',
        type: 'protagonist_name_drift',
        description: `主角姓名疑似从“${anchor.protagonistName}”漂移为“${driftName}”`,
        suggestedFix: `保持主角姓名为“${anchor.protagonistName}”，除非正文明确写出改名或伪装身份原因。`,
      })
    }
  }

  const anchorKeywords = extractAnchorKeywords(anchor.previousEnding)
  const matchedKeywords = anchorKeywords.filter(keyword => opening.includes(keyword))
  if (anchorKeywords.length >= 2 && matchedKeywords.length === 0) {
    issues.push({
      severity: 'critical',
      type: 'previous_ending_not_continued',
      description: '本章开头没有承接上一章结尾锚点',
      suggestedFix: `开场必须直接处理上一章结尾：“${anchor.mustContinueFrom}”。`,
    })
  }

  if (anchor.openingObligation && !hasSerialFlowResponse(opening, anchor.openingObligation)) {
    issues.push({
      severity: anchor.openingObligation.type === 'decision' || anchor.openingObligation.type === 'system_prompt' ? 'critical' : 'major',
      type: 'serial_flow_break',
      description: `本章开头没有处理上一章留下的开篇承诺：“${anchor.openingObligation.triggerText}”`,
      suggestedFix: `${anchor.openingObligation.requiredOpeningAction}然后再转入本章新场景。`,
    })
  }

  const openingLocation = extractLocation(opening)
  if (
    anchor.expectedOpeningLocation &&
    openingLocation &&
    openingLocation !== anchor.expectedOpeningLocation &&
    !hasTransition(opening)
  ) {
    issues.push({
      severity: 'critical',
      type: 'location_jump',
      description: `本章从“${openingLocation}”开场，但上一章结尾仍在“${anchor.expectedOpeningLocation}”`,
      suggestedFix: `先从“${anchor.expectedOpeningLocation}”续写，并在正文中写出抵达“${openingLocation}”的过渡。`,
    })
  }

  const previousHasVehicle = RESOURCE_TERMS.some(term => anchor.previousEnding.includes(term))
  const openingGainsVehicle = /(买下|拿到|拥有|驾驶|登上).{0,8}(飞船|舰船|船)/u.test(opening)
  if (!previousHasVehicle && openingGainsVehicle && !hasTransition(opening)) {
    issues.push({
      severity: 'major',
      type: 'resource_jump',
      description: '本章开头突然获得飞船或关键资源，但上一章结尾没有铺垫',
      suggestedFix: '补足获取资源的过程，或把买船/登船剧情延后到完成上一章钩子之后。',
    })
  }

  if (UNRESOLVED_ENDING_PATTERNS.some(pattern => pattern.test(ending))) {
    issues.push({
      severity: 'major',
      type: 'incomplete_ending',
      description: '章节结尾停在状态变化提示上，缺少结果或可执行的下一章锚点',
      suggestedFix: '揭示提示变化的内容，或明确写出下一章必须继续处理的具体悬念。',
    })
  }

  // 情绪连续性检查：上一章高紧张结尾不应突然切到轻松日常
  if (anchor.previousEmotionalTone && anchor.emotionalArcTrend) {
    const openingHasHighTension = HIGH_TENSION_WORDS.some(word => opening.includes(word))
    const openingHasLowTension = LOW_TENSION_WORDS.some(word => opening.includes(word))

    if (anchor.emotionalArcTrend === 'rising' && !openingHasHighTension && openingHasLowTension) {
      issues.push({
        severity: 'major',
        type: 'emotional_whiplash',
        description: `上一章情绪紧张上升（${anchor.previousEmotionalTone}），但本章开头突然转为轻松氛围`,
        suggestedFix: '保持情绪连贯，先处理上一章的紧张氛围，再逐步过渡到舒缓节奏。',
      })
    }
  }

  const score = Math.max(0, 100 - issues.reduce((total, issue) => {
    if (issue.severity === 'critical') return total + 45
    if (issue.severity === 'major') return total + 25
    return total + 10
  }, 0))

  return {
    passed: !issues.some(issue => issue.severity === 'critical' || issue.severity === 'major'),
    score,
    issues,
    rewriteInstruction: buildRewriteInstruction(issues),
  }
}

// ============================================
// 语义化连续性审计（LLM 增强）
// ============================================

export interface SemanticContinuityJudgment {
  continuesPreviousEnding: boolean
  handlesOpeningObligation: boolean
  locationContinuity: boolean
  issues: Array<{
    type: string
    severity: ContinuityIssueSeverity
    description: string
    suggestedFix: string
  }>
  confidence: number
}

function buildSemanticAuditPrompt(params: {
  previousEnding: string
  openingText: string
  anchor: ContinuityAnchor
  ragContext?: string
}): string {
  const { previousEnding, openingText, anchor, ragContext } = params
  const parts: string[] = []

  parts.push('你是小说连续性审计专家。请判断以下新章节开头是否与上一章结尾保持连贯。')
  parts.push('')
  parts.push('## 上一章结尾')
  parts.push(previousEnding)
  parts.push('')
  parts.push('## 新章节开头（前 900 字）')
  parts.push(openingText)
  parts.push('')

  if (anchor.openingObligation) {
    parts.push('## 开篇承诺')
    parts.push(`- 类型：${anchor.openingObligation.type}`)
    parts.push(`- 触发文本：${anchor.openingObligation.triggerText}`)
    parts.push(`- 要求：${anchor.openingObligation.requiredOpeningAction}`)
    parts.push('')
  }

  if (anchor.expectedOpeningLocation) {
    parts.push(`## 预期开场地点：${anchor.expectedOpeningLocation}`)
    parts.push('')
  }

  if (anchor.protagonistName) {
    parts.push(`## 主角姓名：${anchor.protagonistName}`)
    parts.push('')
  }

  if (ragContext) {
    parts.push('## 相关历史上下文（RAG 检索）')
    parts.push(ragContext)
    parts.push('')
  }

  parts.push('## 判断标准')
  parts.push('1. 新章开头是否自然承接上一章结尾的场景、对话或情绪？（允许同义改写、换角度描写）')
  parts.push('2. 如果存在开篇承诺（选择/倒计时/提问等），新章是否处理了？')
  parts.push('3. 地点是否有过渡？（允许通过过渡词切换地点）')
  parts.push('4. 主角姓名是否一致？')
  parts.push('5. 是否有凭空出现的资源或角色？')
  parts.push('')
  parts.push('请严格按以下 JSON 格式输出，不要添加任何其他文本：')
  parts.push('```json')
  parts.push('{')
  parts.push('  "continuesPreviousEnding": true/false,')
  parts.push('  "handlesOpeningObligation": true/false,')
  parts.push('  "locationContinuity": true/false,')
  parts.push('  "issues": [')
  parts.push('    {')
  parts.push('      "type": "issue_type",')
  parts.push('      "severity": "critical|major|minor",')
  parts.push('      "description": "问题描述",')
  parts.push('      "suggestedFix": "修复建议"')
  parts.push('    }')
  parts.push('  ],')
  parts.push('  "confidence": 0.9')
  parts.push('}')
  parts.push('```')

  return parts.join('\n')
}

function parseSemanticJudgment(content: string): SemanticContinuityJudgment | null {
  try {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/(\{[\s\S]*\})/)
    if (!jsonMatch?.[1]) return null
    const parsed = JSON.parse(jsonMatch[1].trim())

    if (typeof parsed.continuesPreviousEnding !== 'boolean') return null
    if (typeof parsed.handlesOpeningObligation !== 'boolean') return null
    if (typeof parsed.locationContinuity !== 'boolean') return null
    if (!Array.isArray(parsed.issues)) return null
    if (typeof parsed.confidence !== 'number') return null

    return {
      continuesPreviousEnding: parsed.continuesPreviousEnding,
      handlesOpeningObligation: parsed.handlesOpeningObligation,
      locationContinuity: parsed.locationContinuity,
      issues: parsed.issues.map((issue: Record<string, unknown>) => ({
        type: String(issue.type || 'unknown'),
        severity: ['critical', 'major', 'minor'].includes(issue.severity as string) ? issue.severity as ContinuityIssueSeverity : 'minor',
        description: String(issue.description || ''),
        suggestedFix: String(issue.suggestedFix || ''),
      })),
      confidence: Math.max(0, Math.min(1, parsed.confidence)),
    }
  } catch {
    return null
  }
}

/**
 * 两轮审计策略：
 * 1. 先跑确定性检查（零成本）
 * 2. 若有 critical/major 问题，调用 LLM 语义判断覆盖误判
 */
export async function auditChapterContinuityWithLLM(params: {
  chapterNo: number
  content: string
  anchor?: ContinuityAnchor | null
  provider: AIProvider
  ragContext?: string
}): Promise<ContinuityAuditResult> {
  const { chapterNo, content, anchor, provider, ragContext } = params

  // 第一轮：确定性检查
  const deterministicResult = auditChapterContinuity({ chapterNo, content, anchor })

  // 全部通过，无需 LLM
  if (deterministicResult.passed) {
    return deterministicResult
  }

  // 无锚点，无法做语义判断
  if (!anchor) {
    return deterministicResult
  }

  // 第二轮：LLM 语义判断
  try {
    const openingText = getOpeningText(content)
    const prompt = buildSemanticAuditPrompt({
      previousEnding: anchor.previousEnding,
      openingText,
      anchor,
      ragContext,
    })

    const result = await provider.generate(prompt, {
      temperature: 0.1,
      maxTokens: 1000,
    })

    const judgment = parseSemanticJudgment(result.content)
    if (!judgment || judgment.confidence < 0.6) {
      // LLM 解析失败或置信度低，保留确定性结果
      return deterministicResult
    }

    // 合并结果：LLM 认为没问题的问题被移除
    const mergedIssues = deterministicResult.issues.filter(issue => {
      // 对于每个确定性检查发现的问题，看 LLM 是否认为没问题
      if (issue.type === 'previous_ending_not_continued' && judgment.continuesPreviousEnding) {
        return false // LLM 认为有承接，移除误判
      }
      if (issue.type === 'serial_flow_break' && judgment.handlesOpeningObligation) {
        return false // LLM 认为已处理开篇承诺，移除误判
      }
      if (issue.type === 'location_jump' && judgment.locationContinuity) {
        return false // LLM 认为地点连续，移除误判
      }
      return true // 保留其他问题
    })

    // 添加 LLM 发现的新问题（确定性检查未覆盖的）
    for (const llmIssue of judgment.issues) {
      const isDuplicate = mergedIssues.some(
        existing => existing.type === llmIssue.type && existing.description === llmIssue.description
      )
      if (!isDuplicate) {
        mergedIssues.push(llmIssue)
      }
    }

    const score = Math.max(0, 100 - mergedIssues.reduce((total, issue) => {
      if (issue.severity === 'critical') return total + 45
      if (issue.severity === 'major') return total + 25
      return total + 10
    }, 0))

    return {
      passed: !mergedIssues.some(issue => issue.severity === 'critical' || issue.severity === 'major'),
      score,
      issues: mergedIssues,
      rewriteInstruction: buildRewriteInstruction(mergedIssues),
    }
  } catch {
    // LLM 调用失败，保留确定性结果
    return deterministicResult
  }
}

export function buildChapterContinuitySnapshot(params: {
  chapterNo: number
  content: string
  anchor?: ContinuityAnchor | null
}): ChapterContinuitySnapshot {
  const openingScene = clampText(getOpeningText(params.content), 260)
  const endingScene = clampText(getEndingText(params.content), 260)
  const locationAtEnd = extractLocation(endingScene)
  const protagonistName = params.anchor?.protagonistName

  return {
    chapterNo: params.chapterNo,
    openingScene,
    endingScene,
    currentLocation: locationAtEnd,
    activeCharacters: protagonistName ? [protagonistName] : [],
    newCharacters: [],
    acquiredResources: RESOURCE_TERMS.filter(term => params.content.includes(term)),
    lostResources: [],
    unresolvedHooks: UNRESOLVED_ENDING_PATTERNS.some(pattern => pattern.test(normalizeText(endingScene)))
      ? [endingScene]
      : [],
    nextChapterMustContinueFrom: endingScene,
    continuityLocks: {
      protagonistName,
      locationAtEnd,
    },
  }
}
