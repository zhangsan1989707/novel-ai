import type { CharacterProfile } from './types'

export type ContinuityIssueSeverity = 'critical' | 'major' | 'minor'

export interface ContinuityAnchor {
  previousChapterNo: number
  previousEnding: string
  mustContinueFrom: string
  expectedOpeningLocation?: string
  protagonistName?: string
  forbiddenJumps: string[]
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

const LOCATION_TERMS = ['逃生舱', '黑市', '空间站', '铁锈带', '舰桥', '飞船', '港口', '基地', '避难所', '星港']
const RESOURCE_TERMS = ['飞船', '舰船', '船', '武器', '能源', '燃料', '货物', '同伴']
const TRANSITION_TERMS = ['之后', '随后', '离开', '抵达', '赶到', '穿过', '转移', '逃出', '降落', '靠岸', '泊入']
const UNRESOLVED_ENDING_PATTERNS = [
  /屏幕.{0,12}(提示|文字|数字|画面).{0,12}(变了|跳出|亮起|闪烁)[。！？!?]?$/,
  /(门|舱门|通讯|终端|警报).{0,12}(响了|开了|亮了|变了)[。！？!?]?$/,
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

function extractLocation(text: string): string | undefined {
  return LOCATION_TERMS.find(term => text.includes(term))
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
  characterProfiles?: Array<Pick<CharacterProfile, 'name' | 'role'>>
  protagonistProfile?: string | null
}): ContinuityAnchor | null {
  const previousEnding = (params.previousChapterEnding || '').trim()
  if (params.chapterNo <= 1 || !previousEnding) return null

  const expectedOpeningLocation = extractLocation(previousEnding)
  const protagonistName = inferProtagonistName(params.characterProfiles, params.protagonistProfile)
  const forbiddenJumps = [
    '不得跳过上一章最后一个动作或提示',
    '不得无过渡跳转到黑市、港口、基地或新地点',
    '不得突然新增未铺垫同伴、飞船、武器或安全据点',
    '不得更改主角姓名或用另一个名字替代主角',
  ]

  return {
    previousChapterNo: params.chapterNo - 1,
    previousEnding,
    mustContinueFrom: clampText(previousEnding, 240),
    expectedOpeningLocation,
    protagonistName,
    forbiddenJumps,
  }
}

export function formatContinuityAnchorSection(anchor: ContinuityAnchor): string {
  return [
    '这是本章最高优先级连续性约束。',
    `必须无缝承接第${anchor.previousChapterNo}章结尾：`,
    anchor.mustContinueFrom,
    anchor.protagonistName ? `主角姓名锁定：${anchor.protagonistName}` : '',
    anchor.expectedOpeningLocation ? `开场地点必须承接：${anchor.expectedOpeningLocation}` : '',
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
