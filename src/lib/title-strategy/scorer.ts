import type { TitleScoreBreakdown, ScoredTitleCandidate, TitleCandidate } from './types'

// ── 题材关键词表 ──────────────────────────────────────────────────────
const GENRE_SIGNALS: Record<string, string[]> = {
  '重生': ['重生', '回到', '回到过去', '再来一次'],
  '穿越': ['穿越', '穿成', '穿进', '穿书', '一觉醒来'],
  '豪门': ['豪门', '世家', '财阀', '京圈', '顶级', '权贵'],
  '真假千金': ['真千金', '假千金', '亲生', '抱错', '亲闺女'],
  '替身': ['替身', '替嫁', '冒充', '代嫁'],
  '复仇': ['复仇', '报复', '反击', '反杀', '血债', '清算'],
  '团宠': ['团宠', '全家宠', '被宠', '偏宠', '独宠'],
  '逆袭': ['逆袭', '翻盘', '翻身', '逆袭', '逆风翻盘'],
  '打脸': ['打脸', '啪啪', '后悔', '跪求', '求着', '高攀不起'],
  '退婚': ['退婚', '离婚', '解除婚约', '悔婚'],
  '追妻火葬场': ['追妻', '火葬场', '追悔莫及', '疯狂', '疯了', '崩溃'],
  '马甲': ['马甲', '马甲掉了', '马甲掉光', '不装了', '摊牌了'],
  '末世': ['末世', '末日', '废土', '丧尸', '灾变'],
  '求生': ['求生', '逃出', '活命', '存活', '活下去', '活到最后'],
  '玄幻': ['玄幻', '仙尊', '神帝', '万古', '修仙', '修真', '道'],
  '系统': ['系统', '金手指', '外挂', '签到', '打卡', '抽奖'],
  '悬疑': ['悬疑', '怪谈', '推理', '密室', '真相', '案件'],
  '言情': ['心动', '暗恋', '告白', '恋爱', '心动', '甜蜜'],
}

const HOOK_KEYWORDS = [
  '重生', '打脸', '逆袭', '复仇', '团宠', '偏宠', '独宠', '后悔',
  '跪求', '疯了', '崩溃', '火葬场', '追妻', '追夫', '马甲', '不装了',
  '杀疯了', '掀桌', '翻盘', '反杀', '渣男', '渣女', '全跪', '高攀不起',
  '退婚', '离婚', '夺气运', '觉醒', '暴露', '掉马', '联手',
]

const CONFLICT_KEYWORDS = [
  '真千金', '假千金', '替身', '白月光', '情敌', '女配', '男主',
  '前夫', '渣男', '反派', '豪门', '家族', '敌人', '对手',
  '被抛弃', '被夺', '被赶', '被弃', '被困', '退婚', '离婚',
  '联手', '对决', '决战', '博弈', '算计', '阴谋',
]

const EMOTION_KEYWORDS = [
  '疯', '崩溃', '后悔', '跪', '哭', '怒', '恨', '爱',
  '甜', '宠', '虐', '杀', '死', '活', '逃', '赢',
  '全员', '所有人', '全京城', '全网', '全豪门', '全民',
]

const PLATFORM_KEYWORDS: Record<string, string[]> = {
  fanqie: ['重生', '穿越', '团宠', '偏宠', '打脸', '逆袭', '退婚', '离婚', '追妻', '火葬场', '马甲', '替身', '真假千金', '甜宠', '豪门'],
  qidian: ['万古', '神帝', '仙尊', '修仙', '系统', '签到', '无敌', '升级', '全球', '深空', '我在'],
  qimao: ['重生', '穿越', '逆袭', '打脸', '团宠', '退婚', '马甲', '豪门'],
  jjwxc: ['心动', '暗恋', '双向', '救赎', '破镜重圆', '先婚后爱', '年下', '强强'],
  general: ['重生', '穿越', '逆袭', '打脸', '团宠', '系统', '修仙'],
}

// ── 评分函数 ──────────────────────────────────────────────────────────

function scoreGenreRecognition(title: string, genre?: string): number {
  let score = 5 // 基础分
  const text = title

  // 匹配到明确题材关键词
  for (const [, keywords] of Object.entries(GENRE_SIGNALS)) {
    if (keywords.some(k => text.includes(k))) {
      score += 5
      break
    }
  }

  // 如果指定了 genre，检查是否匹配
  if (genre) {
    const genreLower = genre.toLowerCase()
    const genreMap: Record<string, string[]> = {
      '言情': ['甜', '宠', '婚', '恋', '爱', '心动', '追妻'],
      '玄幻': ['神', '帝', '仙', '道', '万古', '苍穹'],
      '都市': ['都市', '全球', '世界', '大佬', '总裁'],
      '悬疑': ['怪谈', '推理', '真相', '秘密', '谜'],
      '重生': ['重生', '回到', '再来'],
      '穿越': ['穿越', '穿成', '穿书'],
    }
    const genreKeywords = genreMap[genre] || genreMap[genreLower] || []
    if (genreKeywords.some(k => text.includes(k))) {
      score += 5
    }
  }

  return Math.min(20, score)
}

function scoreHookStrength(title: string): number {
  let score = 0
  for (const kw of HOOK_KEYWORDS) {
    if (title.includes(kw)) score += 4
  }
  // 句式钩子
  if (/后[，,]/.test(title)) score += 3 // "重生后，..."
  if (/都/.test(title)) score += 2 // "全家都..."
  if (/了$/.test(title)) score += 2 // "...疯了"
  return Math.min(25, score)
}

function scoreConflictDensity(title: string): number {
  let score = 0
  for (const kw of CONFLICT_KEYWORDS) {
    if (title.includes(kw)) score += 3
  }
  // 两个对立角色信号
  if (/和|与|跟|vs/.test(title)) score += 3
  return Math.min(20, score)
}

function scoreEmotionalStimulus(title: string): number {
  let score = 2 // 基础分
  for (const kw of EMOTION_KEYWORDS) {
    if (title.includes(kw)) score += 2
  }
  // 感叹号/问号加分
  if (/[！？!?]/.test(title)) score += 2
  // 极端词汇
  if (/疯|杀|死|全跪|全员/.test(title)) score += 3
  return Math.min(15, score)
}

function scorePlatformFit(title: string, platform?: string): number {
  const p = platform || 'general'
  const keywords = PLATFORM_KEYWORDS[p] || PLATFORM_KEYWORDS.general
  let score = 3
  for (const kw of keywords) {
    if (title.includes(kw)) {
      score += 2
      break
    }
  }
  // 长度适中
  if (title.length >= 4 && title.length <= 16) score += 3
  return Math.min(10, score)
}

function scoreReadability(title: string): number {
  let score = 5 // 基础分
  // 长度合理性
  if (title.length >= 4 && title.length <= 14) score += 3
  else if (title.length <= 20) score += 1
  // 不含生僻符号
  if (!/[{}[\]<>]/.test(title)) score += 2
  return Math.min(10, score)
}

/** 对单个标题进行评分 */
export function scoreTitle(
  title: string,
  platform?: string,
  genre?: string
): TitleScoreBreakdown {
  return {
    genreRecognition: scoreGenreRecognition(title, genre),
    hookStrength: scoreHookStrength(title),
    conflictDensity: scoreConflictDensity(title),
    emotionalStimulus: scoreEmotionalStimulus(title),
    platformFit: scorePlatformFit(title, platform),
    readability: scoreReadability(title),
  }
}

/** 计算总分 */
export function totalScore(breakdown: TitleScoreBreakdown): number {
  return (
    breakdown.genreRecognition +
    breakdown.hookStrength +
    breakdown.conflictDensity +
    breakdown.emotionalStimulus +
    breakdown.platformFit +
    breakdown.readability
  )
}

/** 对候选列表进行评分并排序 */
export function rankCandidates(
  candidates: TitleCandidate[],
  platform?: string,
  genre?: string
): ScoredTitleCandidate[] {
  return candidates
    .map(candidate => {
      const breakdown = scoreTitle(candidate.title, platform, genre)
      // AI 自评分和本地评分取加权平均（本地占 70%）
      const aiScore = candidate.score || 0
      const localScore = totalScore(breakdown)
      const finalScore = Math.round(localScore * 0.7 + aiScore * 0.3)
      return {
        ...candidate,
        score: finalScore,
        breakdown,
      }
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (b.breakdown.hookStrength !== a.breakdown.hookStrength) return b.breakdown.hookStrength - a.breakdown.hookStrength
      if (b.breakdown.platformFit !== a.breakdown.platformFit) return b.breakdown.platformFit - a.breakdown.platformFit
      return a.title.localeCompare(b.title, 'zh-Hans-CN')
    })
}
