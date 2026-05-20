/**
 * 多策略随机改写引擎
 *
 * 核心思路：不是用AI重写，而是用确定性的随机策略打散AI文本特征。
 * 通过句长随机化、同义替换、语序微调、段落重塑、口语注入、噪声注入
 * 六大策略组合，有效降低AI检测得分。
 */

export interface TextSegment {
  text: string
  type: 'narration' | 'dialogue' | 'action' | 'description' | 'transition'
  startIndex: number
  endIndex: number
}

export interface RewriteStrategy {
  name: string
  weight: number
  intensity: 'light' | 'medium' | 'heavy'
  apply(text: string, segments: TextSegment[]): string
}

export interface RewriteChange {
  type: string
  original: string
  revised: string
  strategy: string
}

export interface RewriteResult {
  text: string
  appliedStrategies: string[]
  changes: RewriteChange[]
  originalScore: number
  newScore: number
}

// ============================================
// 同义词库（200+对）
// ============================================

const SYNONYM_DICT: Record<string, string[]> = {
  '虽然': ['虽说', '尽管'],
  '但是': ['可是', '不过'],
  '因为': ['由于', '只因'],
  '所以': ['于是', '因而'],
  '如果': ['要是', '假如'],
  '非常': ['十分', '格外'],
  '突然': ['猛地', '骤然'],
  '慢慢': ['缓缓', '渐渐'],
  '一定': ['必然', '必定'],
  '可能': ['也许', '或许'],
  '应该': ['应当', '理当'],
  '需要': ['需', '得'],
  '开始': ['着手', '启动'],
  '结束': ['完结', '落幕'],
  '发现': ['察觉', '注意到'],
  '看着': ['注视', '盯着'],
  '说道': ['道', '开口'],
  '想到': ['忆起', '回想起'],
  '离开': ['离去', '告辞'],
  '来到': ['抵达', '至'],
  '给予': ['赐予', '赋予'],
  '拥有': ['持有', '具备'],
  '显得': ['看上去', '看起来'],
  '造成': ['导致', '招致'],
  '进行': ['展开', '推进'],
  '存在': ['有', '存有'],
  '实现': ['达成', '做到'],
  '表示': ['表明', '示意'],
  '形成': ['构成', '成型'],
  '展示': ['呈现', '展现'],
  '控制': ['掌控', '驾驭'],
  '巨大': ['庞大', '硕大'],
  '强大': ['强悍', '强劲'],
  '重要': ['关键', '要害'],
  '迅速': ['快速', '疾速'],
  '缓慢': ['迟缓', '徐徐'],
  '安静': ['寂静', '清静'],
  '热闹': ['喧闹', '嘈杂'],
  '美丽': ['秀丽', '绮丽'],
  '黑暗': ['漆黑', '幽暗'],
  '光明': ['明亮', '灿亮'],
  '寒冷': ['冰冷', '凛冽'],
  '温暖': ['暖和', '温煦'],
  '愤怒': ['恼怒', '愠怒'],
  '快乐': ['愉悦', '欢欣'],
  '悲伤': ['哀伤', '悲戚'],
  '恐惧': ['惊惧', '惶惧'],
  '惊讶': ['惊异', '愕然'],
  '终于': ['总算', '最终'],
  '忽然': ['骤然', '猛地'],
  '立刻': ['马上', '当即'],
  '一直': ['始终', '一贯'],
  '经常': ['时常', '往往'],
  '偶尔': ['间或', '有时'],
  '几乎': ['差不多', '险些'],
  '完全': ['彻底', '全然'],
  '基本': ['大致', '大体'],
  '真正': ['确实', '着实'],
  '特别': ['尤其', '格外'],
  '相当': ['颇为', '挺'],
  '容易': ['轻易', '不难'],
  '困难': ['艰难', '不易'],
  '简单': ['简易', '不难'],
  '复杂': ['繁杂', '繁琐'],
  '普通': ['寻常', '一般'],
  '奇怪': ['古怪', '诡异'],
  '可怕': ['恐怖', '骇人'],
  '美好': ['美妙', '美满'],
  '痛苦': ['苦痛', '煎熬'],
  '幸福': ['美满', '甜蜜'],
  '幸运': ['走运', '命好'],
  '失望': ['失落', '沮丧'],
  '希望': ['期盼', '期许'],
  '思念': ['想念', '牵挂'],
  '后悔': ['懊悔', '悔恨'],
  '犹豫': ['迟疑', '踌躇'],
  '坚定': ['坚决', '果决'],
  '勇敢': ['英勇', '无畏'],
  '胆小': ['怯懦', '畏缩'],
  '聪明': ['聪慧', '机敏'],
  '愚蠢': ['愚笨', '蠢笨'],
  '善良': ['仁慈', '良善'],
  '邪恶': ['凶恶', '歹毒'],
  '温柔': ['柔和', '温存'],
  '粗暴': ['粗鲁', '蛮横'],
  '认真': ['仔细', '用心'],
  '马虎': ['草率', '敷衍'],
  '骄傲': ['自傲', '自负'],
  '谦虚': ['谦逊', '谦和'],
  '紧张': ['紧绷', '忐忑'],
  '放松': ['松弛', '舒展'],
  '疲惫': ['疲倦', '困乏'],
  '精神': ['抖擞', '振奋'],
  '清醒': ['明晰', '清楚'],
  '模糊': ['朦胧', '隐约'],
  '清晰': ['清楚', '分明'],
  '深远': ['幽深', '遥深'],
  '短暂': ['短促', '须臾'],
  '长久': ['漫长', '悠长'],
  '永恒': ['永久', '亘古'],
  '遥远': ['辽远', '迢遥'],
  '靠近': ['接近', '临近'],
  '远离': ['远避', '疏远'],
  '上升': ['升起', '攀升'],
  '下降': ['下落', '坠降'],
  '出现': ['显现', '浮现'],
  '消失': ['消散', '隐去'],
  '变化': ['转变', '变迁'],
  '保持': ['维持', '维系'],
  '破坏': ['毁坏', '摧残'],
  '保护': ['守护', '护卫'],
  '攻击': ['袭击', '进击'],
  '防御': ['抵御', '抵挡'],
  '胜利': ['获胜', '凯旋'],
  '失败': ['落败', '败北'],
  '帮助': ['援助', '协助'],
  '阻碍': ['阻挠', '妨碍'],
  '同意': ['赞同', '首肯'],
  '反对': ['抗拒', '抵制'],
  '喜欢': ['喜爱', '中意'],
  '讨厌': ['厌恶', '嫌恶'],
  '相信': ['信任', '信赖'],
  '怀疑': ['猜疑', '起疑'],
  '记得': ['记住', '铭记'],
  '忘记': ['遗忘', '淡忘'],
  '理解': ['懂得', '领会'],
  '误会': ['误解', '曲解'],
  '原谅': ['宽恕', '谅解'],
  '责备': ['责怪', '斥责'],
  '感谢': ['感激', '致谢'],
  '道歉': ['致歉', '赔不是'],
  '迎接': ['接迎', '相迎'],
  '送别': ['送行', '告别'],
  '等待': ['等候', '守候'],
  '追赶': ['追逐', '追撵'],
  '逃跑': ['逃离', '窜逃'],
  '隐藏': ['躲藏', '隐匿'],
  '暴露': ['显露', '袒露'],
  '收集': ['搜集', '汇集'],
  '分散': ['散开', '疏散'],
  '集中': ['聚集', '汇拢'],
  '分开': ['分离', '拆散'],
  '连接': ['衔接', '连接上'],
  '断裂': ['折断', '崩断'],
  '修复': ['修补', '复原'],
  '生长': ['滋长', '生发'],
  '枯萎': ['凋萎', '萎谢'],
  '绽放': ['盛开', '怒放'],
  '飞翔': ['翱翔', '飞掠'],
  '沉没': ['下沉', '没入'],
  '漂浮': ['飘荡', '浮游'],
  '燃烧': ['焚烧', '燃起'],
  '熄灭': ['灭掉', '黯灭'],
  '闪耀': ['闪烁', '璀璨'],
  '黯淡': ['暗淡', '昏黯'],
  '寂静': ['死寂', '沉寂'],
  '喧嚣': ['嘈杂', '喧腾'],
  '整齐': ['齐整', '规整'],
  '凌乱': ['杂乱', '纷乱'],
  '干净': ['整洁', '洁净'],
  '肮脏': ['污秽', '腌臜'],
  '新鲜': ['鲜活', '清新'],
  '陈旧': ['老旧', '破旧'],
  '坚硬': ['坚实', '刚硬'],
  '柔软': ['绵软', '柔韧'],
  '粗糙': ['粗粝', '毛糙'],
  '光滑': ['平滑', '光洁'],
  '湿润': ['潮湿', '濡湿'],
  '干燥': ['干涸', '枯干'],
  '沉重': ['沉甸甸', '厚实'],
  '轻盈': ['轻巧', '轻灵'],
  '睁': ['张', '开'],
  '闭': ['合', '阖'],
  '抬': ['举', '提'],
  '放': ['搁', '置'],
  '不禁': ['忍不住', '差点', '当下'],
  '顿时': ['当时', '就', '便'],
  '瞬间': ['刹那', '这一刻'],
  '赫然': ['豁然', '突然'],
  '蓦然': ['猛然', '忽地'],
  '骤然': ['猛地', '霍地'],
  '陡然': ['忽而', '一下'],
  '悄然': ['偷偷', '默默'],
  '旋即': ['接着', '随后'],
  '缓缓': ['慢慢', '徐徐'],
  '微微': ['稍稍', '略略'],
  '淡淡': ['隐隐', '浅浅'],
  '轻轻': ['小心', '缓缓地'],
  '默默': ['不做声', '静静地'],
  '深深': ['沉沉', '重重'],
  '渐渐': ['一点一点', '慢慢'],
  '竟': ['倒是', '倒'],
  '竟然': ['居然', '倒'],
  '不由': ['忍不住', '不禁'],
  '下意识': ['本能', '习惯地'],
  '感到': ['觉得', '觉着', '察觉'],
  '觉得': ['感到', '觉着'],
  '真正的': ['实在的', '实打实的'],
  '无疑': ['显然', '很明显'],
  '最重要': ['最要紧', '最关键的'],
  '无比': ['特别', '非同一般'],
  '人生': ['这一辈子', '这辈子'],
  '一课': ['教训', '经验'],
  '成长': ['长大', '懂事'],
  '坚强': ['扛得住', '硬气'],
  '内心': ['心里', '心底里'],
  '一动': ['愣了一下', '滞了一下'],
  '一紧': ['收紧', '缩了一下'],
  '一亮': ['亮起来', '亮了'],
  '一抽': ['抽了抽', '抽搐了一下'],
  '一惊': ['惊了', '吓着了'],
  '一皱': ['皱了皱', '拧了起来'],
}

const COLLOQUIAL_INJECTIONS: string[] = [
  '说实话', '讲真', '妈的', '操', '草', '靠', '我去',
  '真是的', '尼玛', '妈的', '真他妈', '活见鬼',
  '说白了', '说句不好听的', '不瞒你说', '你别说',
]

const HIGH_FREQ_AI_WORDS: string[] = [
  '不禁', '顿时', '瞬间', '赫然', '蓦然', '骤然', '陡然', '悄然', '旋即',
  '缓缓', '微微', '淡淡', '轻轻', '默默', '深深', '渐渐',
  '竟然', '居然', '显然', '不由得', '不由自主', '下意识',
]

// ============================================
// 工具函数
// ============================================

function getCJKLength(text: string): number {
  return text.replace(/\s/g, '').length
}

function splitByClausePunctuation(text: string): string[] {
  const result: string[] = []
  let current = ''
  for (const ch of text) {
    current += ch
    if (/[，,；;：:]/.test(ch)) {
      result.push(current.trim())
      current = ''
    }
  }
  if (current.trim().length > 0) {
    result.push(current.trim())
  }
  return result.length > 0 ? result : [text]
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[。！？；\n])/g).filter(s => s.trim().length > 0)
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomFloat(): number {
  return Math.random()
}

function weightedRandom<T extends { weight: number }>(items: T[]): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
  let rand = Math.random() * totalWeight
  for (const item of items) {
    rand -= item.weight
    if (rand <= 0) return item
  }
  return items[items.length - 1]
}

// ============================================
// 策略1: 句长随机化
// ============================================

function applySentenceLengthRandomization(text: string): { text: string; changes: RewriteChange[] } {
  const changes: RewriteChange[] = []
  const sentences = splitSentences(text)

  if (sentences.length < 2) return { text, changes: [] }

  const processed: string[] = []
  const toMerge: string[] = []

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i]
    const len = getCJKLength(s)

    if (len < 15 && randomFloat() < 0.35 && i < sentences.length - 1) {
      toMerge.push(s)
      continue
    }

    if (toMerge.length > 0) {
      toMerge.push(s)
      const merged = toMerge.join('')
      const original = toMerge.join('')
      changes.push({
        type: 'merge_sentences',
        original: original.substring(0, 30) + (original.length > 30 ? '…' : ''),
        revised: merged.substring(0, 30) + (merged.length > 30 ? '…' : ''),
        strategy: '句长随机化',
      })
      processed.push(merged)
      toMerge.length = 0
      continue
    }

    if (len > 50 && randomFloat() < 0.3) {
      const clauses = splitByClausePunctuation(s)
      if (clauses.length >= 2) {
        const splitPoint = randomInt(1, clauses.length - 1)
        const part1 = clauses.slice(0, splitPoint).join('')
        const part2 = clauses.slice(splitPoint).join('')

        if (part1.trim().length > 0 && part2.trim().length > 0) {
          const part1End = part1.endsWith('，') ? part1.slice(0, -1) + '。' : part1 + '。'
          changes.push({
            type: 'split_sentence',
            original: s.substring(0, 30) + (s.length > 30 ? '…' : ''),
            revised: (part1End + part2).substring(0, 30) + ((part1End + part2).length > 30 ? '…' : ''),
            strategy: '句长随机化',
          })
          processed.push(part1End)
          processed.push(part2)
          continue
        }
      }
    }

    processed.push(s)
  }

  if (toMerge.length > 0) {
    const merged = toMerge.join('')
    processed.push(merged)
  }

  return { text: processed.join(''), changes }
}

// ============================================
// 策略2: 同义替换
// ============================================

function applySynonymReplacement(text: string): { text: string; changes: RewriteChange[] } {
  const changes: RewriteChange[] = []
  let result = text

  const entries = Object.entries(SYNONYM_DICT)

  const shuffled = [...entries].sort(() => Math.random() - 0.5)

  const replaceCount = Math.floor(shuffled.length * (0.3 + Math.random() * 0.2))

  let replaced = 0
  for (const [word, synonyms] of shuffled) {
    if (replaced >= replaceCount) break

    if (!result.includes(word)) continue

    const replacement = randomChoice(synonyms)
    const before = result
    result = result.replace(word, replacement)

    if (result !== before) {
      changes.push({
        type: 'synonym',
        original: word,
        revised: replacement,
        strategy: '同义替换',
      })
      replaced++
    }

    if (result.includes(word) && randomFloat() < 0.3) {
      const replacement2 = randomChoice(synonyms)
      const before2 = result
      result = result.replace(word, replacement2)
      if (result !== before2) {
        changes.push({
          type: 'synonym',
          original: word,
          revised: replacement2,
          strategy: '同义替换',
        })
        replaced++
      }
    }
  }

  for (const aiWord of HIGH_FREQ_AI_WORDS) {
    if (replaced >= replaceCount + 5) break
    if (!result.includes(aiWord)) continue

    const synonymsForAi = SYNONYM_DICT[aiWord]
    if (!synonymsForAi) continue

    const replacement = randomChoice(synonymsForAi)
    const before = result
    result = result.replace(aiWord, replacement)
    if (result !== before) {
      changes.push({
        type: 'synonym_ai_word',
        original: aiWord,
        revised: replacement,
        strategy: '同义替换',
      })
      replaced++
    }
  }

  return { text: result, changes }
}

// ============================================
// 策略3: 语序微调
// ============================================

function applyWordOrderAdjustment(text: string): { text: string; changes: RewriteChange[] } {
  const changes: RewriteChange[] = []
  const sentences = splitSentences(text)
  const processed: string[] = []

  for (const sentence of sentences) {
    let modified = sentence

    if (randomFloat() < 0.25) {
      const adverbialPatterns = [
        { pattern: /(忽然|突然|猛地|骤然|陡然)([^，。！？；\n]{2,20})/g, type: 'adverb_front' },
        { pattern: /([^，。！？；\n]{2,15})(，)(忽然|突然|猛地|骤然|陡然)([^，。！？；\n]{2,})/g, type: 'adverb_mid' },
      ]

      for (const { pattern, type } of adverbialPatterns) {
        const match = pattern.exec(modified)
        if (match && randomFloat() < 0.4) {
          const before = modified
          if (type === 'adverb_front') {
            const adverb = match[1]
            const rest = match[2]
            modified = modified.replace(match[0], rest + adverb)
          }
          if (modified !== before) {
            changes.push({
              type: 'word_order',
              original: before.substring(0, 30),
              revised: modified.substring(0, 30),
              strategy: '语序微调',
            })
            break
          }
        }
      }
    }

    if (randomFloat() < 0.15) {
      const passivePattern = /([\u4e00-\u9fa5]{1,3})被([\u4e00-\u9fa5]{1,3})([^，。！？；\n]{2,})/g
      const match = passivePattern.exec(modified)
      if (match && randomFloat() < 0.5) {
        const before = modified
        modified = modified.replace(match[0], match[2] + '把' + match[1] + match[3])
        if (modified !== before) {
          changes.push({
            type: 'voice_change',
            original: before.substring(0, 30),
            revised: modified.substring(0, 30),
            strategy: '语序微调',
          })
        }
      }
    }

    processed.push(modified)
  }

  return { text: processed.join(''), changes }
}

// ============================================
// 策略4: 段落重塑
// ============================================

function applyParagraphReshaping(text: string): { text: string; changes: RewriteChange[] } {
  const changes: RewriteChange[] = []
  const paragraphs = text.split(/\n+/).filter(p => p.trim().length > 0)

  if (paragraphs.length < 3) return { text, changes: [] }

  const lengths = paragraphs.map(p => getCJKLength(p))
  const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length

  const processed: string[] = []
  let i = 0
  while (i < paragraphs.length) {
    const p = paragraphs[i]
    const len = getCJKLength(p)

    if (len < 30 && i < paragraphs.length - 1 && randomFloat() < 0.4) {
      const merged = p + '\n' + paragraphs[i + 1]
      changes.push({
        type: 'merge_paragraphs',
        original: p.substring(0, 20) + '…',
        revised: merged.substring(0, 30) + '…',
        strategy: '段落重塑',
      })
      processed.push(merged)
      i += 2
      continue
    }

    if (len > avgLen * 1.8 && randomFloat() < 0.35) {
      const sentences = splitSentences(p)
      if (sentences.length >= 3) {
        const splitPoint = randomInt(Math.floor(sentences.length * 0.4), Math.floor(sentences.length * 0.6))
        const part1 = sentences.slice(0, splitPoint).join('')
        const part2 = sentences.slice(splitPoint).join('')
        if (part1.trim().length > 0 && part2.trim().length > 0) {
          changes.push({
            type: 'split_paragraph',
            original: p.substring(0, 30) + '…',
            revised: part1.substring(0, 20) + '…|' + part2.substring(0, 20) + '…',
            strategy: '段落重塑',
          })
          processed.push(part1)
          processed.push(part2)
          i++
          continue
        }
      }
    }

    processed.push(p)
    i++
  }

  return { text: processed.join('\n\n'), changes }
}

// ============================================
// 策略5: 口语注入
// ============================================

function applyColloquialInjection(text: string): { text: string; changes: RewriteChange[] } {
  const changes: RewriteChange[] = []
  const sentences = splitSentences(text)

  const injectionProbability = 0.06

  const processed: string[] = []
  for (const sentence of sentences) {
    const len = getCJKLength(sentence)
    if (len > 20 && randomFloat() < injectionProbability) {
      const injection = randomChoice(COLLOQUIAL_INJECTIONS)
      const insertPos = randomInt(0, Math.min(3, sentence.length - 1))

      let modified: string
      if (insertPos === 0) {
        modified = injection + '，' + sentence
      } else {
        const idx = sentence.indexOf('，', insertPos)
        if (idx > 0 && idx < sentence.length - 2) {
          modified = sentence.substring(0, idx + 1) + injection + '，' + sentence.substring(idx + 1)
        } else {
          modified = injection + '，' + sentence
        }
      }

      changes.push({
        type: 'colloquial_injection',
        original: sentence.substring(0, 30) + (sentence.length > 30 ? '…' : ''),
        revised: modified.substring(0, 30) + (modified.length > 30 ? '…' : ''),
        strategy: '口语注入',
      })
      processed.push(modified)
    } else if (len > 30 && randomFloat() < 0.04) {
      const dialoguePattern = /[""]([^""]{10,60})[""]/g
      const match = dialoguePattern.exec(sentence)
      if (match && randomFloat() < 0.5) {
        const dialogue = match[1]
        const modified = sentence.replace(
          match[0],
          dialogue.replace(/[。！？]$/, '，') + '他心想。'
        )
        changes.push({
          type: 'free_indirect_speech',
          original: sentence.substring(0, 30) + '…',
          revised: modified.substring(0, 30) + '…',
          strategy: '口语注入',
        })
        processed.push(modified)
      } else {
        processed.push(sentence)
      }
    } else {
      processed.push(sentence)
    }
  }

  return { text: processed.join(''), changes }
}

// ============================================
// 策略6: 噪声注入
// ============================================

function applyNoiseInjection(text: string): { text: string; changes: RewriteChange[] } {
  const changes: RewriteChange[] = []
  let result = text

  const ellipsisPattern = /…{2,}/g
  let match: RegExpExecArray | null
  let noiseCount = 0
  const maxNoise = randomInt(1, 2)

  while ((match = ellipsisPattern.exec(result)) !== null && noiseCount < maxNoise) {
    if (randomFloat() < 0.4) {
      const before = result
      const replacement = randomChoice(['…', '...', '… …', '... ...'])
      result = result.substring(0, match.index) + replacement + result.substring(match.index + match[0].length)
      changes.push({
        type: 'noise_ellipsis',
        original: match[0],
        revised: replacement,
        strategy: '噪声注入',
      })
      noiseCount++
      if (result !== before) {
        ellipsisPattern.lastIndex = match.index + replacement.length
      }
    }
  }

  const dashPattern = /—{1,2}/g
  let dashMatch: RegExpExecArray | null
  while ((dashMatch = dashPattern.exec(result)) !== null && noiseCount < maxNoise + 1) {
    if (randomFloat() < 0.35) {
      const before = result
      const replacement = randomChoice(['--', '—', '——'])
      result = result.substring(0, dashMatch.index) + replacement + result.substring(dashMatch.index + dashMatch[0].length)
      if (result !== before) {
        changes.push({
          type: 'noise_dash',
          original: dashMatch[0],
          revised: replacement,
          strategy: '噪声注入',
        })
        noiseCount++
        dashPattern.lastIndex = dashMatch.index + replacement.length
      }
    }
  }

  return { text: result, changes }
}

// ============================================
// 策略列表
// ============================================

export const rewriteStrategies: RewriteStrategy[] = [
  {
    name: '句长随机化',
    weight: 25,
    intensity: 'medium',
    apply: (text: string) => applySentenceLengthRandomization(text).text,
  },
  {
    name: '同义替换',
    weight: 20,
    intensity: 'medium',
    apply: (text: string) => applySynonymReplacement(text).text,
  },
  {
    name: '语序微调',
    weight: 15,
    intensity: 'light',
    apply: (text: string) => applyWordOrderAdjustment(text).text,
  },
  {
    name: '段落重塑',
    weight: 20,
    intensity: 'medium',
    apply: (text: string) => applyParagraphReshaping(text).text,
  },
  {
    name: '口语注入',
    weight: 10,
    intensity: 'light',
    apply: (text: string) => applyColloquialInjection(text).text,
  },
  {
    name: '噪声注入',
    weight: 10,
    intensity: 'light',
    apply: (text: string) => applyNoiseInjection(text).text,
  },
]

// ============================================
// 主改写函数
// ============================================

export interface RewriteOptions {
  intensity?: 'light' | 'medium' | 'heavy'
}

/**
 * 对文本应用多策略随机改写
 *
 * 根据 intensity 决定应用策略的数量和程度：
 * - light: 随机选2个策略
 * - medium: 随机选3个策略 (默认)
 * - heavy: 随机选4-5个策略
 *
 * @param text - 待改写的文本
 * @param options - 改写选项
 * @returns 改写结果，包含最终文本、应用策略、变更详情
 */
export function rewriteText(text: string, options?: RewriteOptions): RewriteResult {
  const intensity = options?.intensity || 'medium'

  let strategyCount: number
  switch (intensity) {
    case 'light':
      strategyCount = 2
      break
    case 'medium':
      strategyCount = 3
      break
    case 'heavy':
      strategyCount = randomInt(4, 5)
      break
  }

  const synonymStrategy = rewriteStrategies.find(s => s.name === '同义替换')!

  const otherStrategies = rewriteStrategies.filter(s => s.name !== '同义替换')
  const shuffled = [...otherStrategies].sort(() => Math.random() - 0.5)

  let selected: RewriteStrategy[]
  if (intensity === 'light') {
    selected = shuffled.slice(0, Math.min(strategyCount, shuffled.length))
  } else {
    selected = [synonymStrategy, ...shuffled.slice(0, Math.min(strategyCount - 1, shuffled.length))]
  }

  let result = text
  const allChanges: RewriteChange[] = []
  const appliedStrategyNames: string[] = []

  for (const strategy of selected) {
    const strategyResult = applyStrategy(strategy, result)
    if (strategyResult.text !== result) {
      result = strategyResult.text
      appliedStrategyNames.push(strategy.name)
      allChanges.push(...strategyResult.changes)
    }
  }

  return {
    text: result,
    appliedStrategies: appliedStrategyNames,
    changes: allChanges.slice(0, 50),
    originalScore: 0,
    newScore: 0,
  }
}

function applyStrategy(strategy: RewriteStrategy, text: string): { text: string; changes: RewriteChange[] } {
  switch (strategy.name) {
    case '句长随机化':
      return applySentenceLengthRandomization(text)
    case '同义替换':
      return applySynonymReplacement(text)
    case '语序微调':
      return applyWordOrderAdjustment(text)
    case '段落重塑':
      return applyParagraphReshaping(text)
    case '口语注入':
      return applyColloquialInjection(text)
    case '噪声注入':
      return applyNoiseInjection(text)
    default:
      return { text, changes: [] }
  }
}