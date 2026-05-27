import type { ChapterOutline } from './types'

export interface EmotionEngine {
  primaryEmotion: '爽' | '虐' | '笑' | '燃' | '憋屈' | '期待' | '悬疑' | '甜'
  openingBomb: string
  readerPayoff: string
  forbiddenSlowStart: boolean
}

export interface CheatAbility {
  name: string
  oneLineRule: string
  firstRevealChapter: number
  firstPayoffChapter: number
  growthMechanism: string
  limitation: string
  readerFantasy: string
}

export interface ConflictEngine {
  conflictTypes: string[]
  conflictFrequency: string
  payoffInterval: string
  hookStrategy: string
}

export interface CharacterTagBehaviorProof {
  tag: string
  requiredScene: string
  forbiddenBehavior: string
}

export interface CharacterTagEngine {
  protagonistTags: string[]
  behaviorProofs: CharacterTagBehaviorProof[]
}

export interface PopularFictionProfile {
  emotionEngine: EmotionEngine
  cheatAbility: CheatAbility
  conflictEngine: ConflictEngine
  characterTagEngine: CharacterTagEngine
}

export interface PopularFictionScorecard {
  readability: number
  emotion: number
  cheatPayoff: number
  conflict: number
  hook: number
  character: number
  pacing: number
  total: number
  issues: string[]
  suggestions: string[]
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function normalizePopularFictionProfile(value: unknown): PopularFictionProfile | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const source = value as Record<string, unknown>
  const emotion = source.emotionEngine as Record<string, unknown> | undefined
  const cheat = source.cheatAbility as Record<string, unknown> | undefined
  const conflict = source.conflictEngine as Record<string, unknown> | undefined
  const character = source.characterTagEngine as Record<string, unknown> | undefined
  if (!emotion || !cheat || !conflict || !character) return null

  return {
    emotionEngine: {
      primaryEmotion: typeof emotion.primaryEmotion === 'string' ? emotion.primaryEmotion as EmotionEngine['primaryEmotion'] : '爽',
      openingBomb: typeof emotion.openingBomb === 'string' ? emotion.openingBomb : '',
      readerPayoff: typeof emotion.readerPayoff === 'string' ? emotion.readerPayoff : '',
      forbiddenSlowStart: Boolean(emotion.forbiddenSlowStart),
    },
    cheatAbility: {
      name: typeof cheat.name === 'string' ? cheat.name : '',
      oneLineRule: typeof cheat.oneLineRule === 'string' ? cheat.oneLineRule : '',
      firstRevealChapter: typeof cheat.firstRevealChapter === 'number' ? cheat.firstRevealChapter : 1,
      firstPayoffChapter: typeof cheat.firstPayoffChapter === 'number' ? cheat.firstPayoffChapter : 3,
      growthMechanism: typeof cheat.growthMechanism === 'string' ? cheat.growthMechanism : '',
      limitation: typeof cheat.limitation === 'string' ? cheat.limitation : '',
      readerFantasy: typeof cheat.readerFantasy === 'string' ? cheat.readerFantasy : '',
    },
    conflictEngine: {
      conflictTypes: Array.isArray(conflict.conflictTypes) ? conflict.conflictTypes.filter((item): item is string => typeof item === 'string') : [],
      conflictFrequency: typeof conflict.conflictFrequency === 'string' ? conflict.conflictFrequency : '',
      payoffInterval: typeof conflict.payoffInterval === 'string' ? conflict.payoffInterval : '',
      hookStrategy: typeof conflict.hookStrategy === 'string' ? conflict.hookStrategy : '',
    },
    characterTagEngine: {
      protagonistTags: Array.isArray(character.protagonistTags) ? character.protagonistTags.filter((item): item is string => typeof item === 'string') : [],
      behaviorProofs: Array.isArray(character.behaviorProofs)
        ? character.behaviorProofs
          .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
          .map(item => ({
            tag: typeof item.tag === 'string' ? item.tag : '',
            requiredScene: typeof item.requiredScene === 'string' ? item.requiredScene : '',
            forbiddenBehavior: typeof item.forbiddenBehavior === 'string' ? item.forbiddenBehavior : '',
          }))
        : [],
    },
  }
}

export function buildPopularFictionPromptBlock(profile: PopularFictionProfile | null): string {
  if (!profile) return '暂无爆款四因子资料，请保持低门槛、高情绪价值、强冲突、强钩子。'
  return [
    `情绪主轴：${profile.emotionEngine.primaryEmotion}`,
    `开篇情绪炸弹：${profile.emotionEngine.openingBomb}`,
    `读者回报：${profile.emotionEngine.readerPayoff}`,
    `金手指：${profile.cheatAbility.name}，规则：${profile.cheatAbility.oneLineRule}`,
    `首次亮相：第${profile.cheatAbility.firstRevealChapter}章，首次变现：第${profile.cheatAbility.firstPayoffChapter}章`,
    `金手指成长：${profile.cheatAbility.growthMechanism}`,
    `金手指限制：${profile.cheatAbility.limitation}`,
    `读者代入点：${profile.cheatAbility.readerFantasy}`,
    `冲突类型：${profile.conflictEngine.conflictTypes.join('、') || '持续外部冲突'}`,
    `冲突频率：${profile.conflictEngine.conflictFrequency}`,
    `爽点间隔：${profile.conflictEngine.payoffInterval}`,
    `钩子策略：${profile.conflictEngine.hookStrategy}`,
    `主角标签：${profile.characterTagEngine.protagonistTags.join('、') || '鲜明主角标签'}`,
    `行为证明：${profile.characterTagEngine.behaviorProofs.map(item => `${item.tag}:${item.requiredScene}`).join('；') || '通过关键选择证明人设'}`,
  ].join('\n')
}

function includesAny(text: string, values: string[]) {
  return values.some(value => value && text.includes(value))
}

export function scorePopularFictionChapter(input: {
  content: string
  outline?: ChapterOutline | null
  profile: PopularFictionProfile | null
}): PopularFictionScorecard {
  const content = input.content || ''
  const issues: string[] = []
  const suggestions: string[] = []

  const expositionPenalty = (content.match(/世界观|设定|体系|规则|境界|据说|传说/g) || []).length
  const readability = clamp(9 - expositionPenalty, 3, 10)
  if (readability < 7) {
    issues.push('前文设定解释偏多，阅读门槛偏高')
    suggestions.push('删减设定说明，优先让读者通过冲突理解规则')
  }

  const emotionWords = ['愤怒', '屈辱', '热血', '狂喜', '绝望', '紧张', '兴奋', '恐惧', '笑', '燃']
  const emotion = clamp(4 + Math.min(6, emotionWords.filter(word => content.includes(word)).length), 3, 10)
  if (emotion < 7) {
    issues.push('本章情绪价值不够集中')
    suggestions.push('增加更明确的压迫、反击或情绪兑现')
  }

  const cheatKeywords = [input.profile?.cheatAbility.name || '', input.profile?.cheatAbility.oneLineRule || '', input.outline?.cheatUsage || '']
    .filter(Boolean)
  const cheatPayoff = clamp(4 + (includesAny(content, cheatKeywords) ? 4 : 0) + (content.includes('反击') || content.includes('打脸') ? 1 : 0), 3, 10)
  if (cheatPayoff < 7) {
    issues.push('金手指存在感或变现力度不足')
    suggestions.push('让能力更直接介入冲突，并更快兑现回报')
  }

  const conflictWords = ['冲突', '羞辱', '追杀', '威胁', '误会', '打脸', '危机', '陷阱', '代价']
  const conflict = clamp(4 + Math.min(6, conflictWords.filter(word => content.includes(word)).length), 3, 10)
  if (conflict < 7) {
    issues.push('本章冲突密度不足')
    suggestions.push('补一层外部压力或更明确的利益争夺')
  }

  const hookText = input.outline?.cliffhanger || input.outline?.ending || ''
  const hook = clamp(4 + ((/[？?！!]|忽然|却在这时|然而|没想到|下一刻/.test(content.slice(-160)) || /[？?！!]/.test(hookText)) ? 4 : 0), 3, 10)
  if (hook < 7) {
    issues.push('章节结尾钩子不够强')
    suggestions.push('结尾增加更明确的新威胁、反转或未完成承诺')
  }

  const tagKeywords = [
    ...(input.profile?.characterTagEngine.protagonistTags || []),
    ...(input.profile?.characterTagEngine.behaviorProofs.map(item => item.tag) || []),
  ]
  const character = clamp(4 + Math.min(6, tagKeywords.filter(word => word && content.includes(word)).length), 3, 10)
  if (character < 7) {
    issues.push('主角标签证明不够明显')
    suggestions.push('补一个能证明主角标签的关键选择或动作')
  }

  const pacingPenalty = (content.match(/随后|然后|接着|之后|第二天|一路上/g) || []).length
  const pacing = clamp(9 - Math.max(0, pacingPenalty - 2), 3, 10)
  if (pacing < 7) {
    issues.push('节奏有流水账倾向')
    suggestions.push('压缩过场，把篇幅让给冲突、兑现和钩子')
  }

  const total = Number(((readability + emotion + cheatPayoff + conflict + hook + character + pacing) / 7).toFixed(1))
  return {
    readability,
    emotion,
    cheatPayoff,
    conflict,
    hook,
    character,
    pacing,
    total,
    issues,
    suggestions,
  }
}
