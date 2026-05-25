export type InspirationCategory = 'male' | 'female' | 'unisex'

export interface HotInspiration {
  id: string
  category: InspirationCategory
  title: string
  description: string
  exampleWorks: string[]
  coreElements: string[]
  targetAudience: string
  hotScore: number
  sampleTitle: string
  sampleSummary: string
  sampleGenre: string
  sampleWritingStyle: string
  tags: string[]
  aiInsight?: string
  openingScene?: string
  platformFit?: string
  recommendedLength?: string
}

function inferPlatformFit(category: InspirationCategory, writingStyle: string) {
  if (category === 'male') {
    return '起点 / 番茄 / 飞卢'
  }
  if (category === 'female') {
    return '晋江 / 番茄女频'
  }
  if (/(悬疑|科幻|历史|轻小说)/.test(writingStyle)) {
    return '起点 / 刺猬猫 / 全平台'
  }
  return '全平台可试'
}

function inferRecommendedLength(category: InspirationCategory, writingStyle: string) {
  if (/(慢热|养成|史诗|群像)/.test(writingStyle)) {
    return '长线连载，适合 150 万字以上'
  }
  if (/(悬疑|烧脑|轻松|日常)/.test(writingStyle)) {
    return '中长篇，适合 80-150 万字'
  }
  if (category === 'female') {
    return '中篇到长篇，适合 60-120 万字'
  }
  return '中长篇，适合 100 万字左右起步'
}

function buildDirectorFields(inspiration: HotInspiration) {
  const primaryHook = inspiration.coreElements[0] || inspiration.sampleGenre || '高概念'
  const secondaryHook = inspiration.coreElements[1] || inspiration.tags[0] || inspiration.description
  const openingSubject = inspiration.sampleTitle || inspiration.title
  const aiInsight = `把「${primaryHook}」和「${secondaryHook}」绑定成第一冲突点，再用 ${inspiration.sampleWritingStyle} 节奏兑现爽点。`
  const openingScene = `开局直接把主角扔进「${openingSubject}」的核心局面，第一章就给出身份反差、利益冲突和即时行动目标。`

  return {
    aiInsight,
    openingScene,
    platformFit: inferPlatformFit(inspiration.category, inspiration.sampleWritingStyle),
    recommendedLength: inferRecommendedLength(inspiration.category, inspiration.sampleWritingStyle),
  }
}

export function enhanceInspiration(inspiration: HotInspiration): HotInspiration {
  const directorFields = buildDirectorFields(inspiration)
  return {
    ...inspiration,
    aiInsight: inspiration.aiInsight || directorFields.aiInsight,
    openingScene: inspiration.openingScene || directorFields.openingScene,
    platformFit: inspiration.platformFit || directorFields.platformFit,
    recommendedLength: inspiration.recommendedLength || directorFields.recommendedLength,
  }
}

export function enhanceInspirations(items: HotInspiration[]): HotInspiration[] {
  return items.map(enhanceInspiration)
}

export const inspirations: HotInspiration[] = [
  {
    id: 'male-suspense-rules',
    category: 'male',
    title: '规则怪谈 × 智斗反转',
    description: '悬疑解谜 × 系统博弈 × 多重反转。主角在诡异的规则世界中求生，需要破解规则背后的真相。',
    exampleWorks: ['十日终焉', '规则怪谈', '捞尸人'],
    coreElements: ['悬疑解谜', '规则博弈', '智斗反转', '诡异氛围'],
    targetAudience: '喜欢烧脑推理、追求刺激的读者',
    hotScore: 9,
    sampleTitle: '终焉游戏：我靠规则杀出重围',
    sampleSummary: '林逸醒来发现自己身处一个诡异的游戏世界，数十名参与者被困在封闭空间内，必须完成各种诡异任务才能生存。每一个看似简单的规则背后，都隐藏着致命的陷阱。林逸凭借敏锐的观察力和过人的智慧，一步步揭开这场「终焉游戏」背后的真相……',
    sampleGenre: '悬疑',
    sampleWritingStyle: '悬疑烧脑',
    tags: ['悬疑', '智斗', '规则', '逃生']
  },
  {
    id: 'male-xianxia-crossworld',
    category: 'male',
    title: '两界穿梭 × 降维打击',
    description: '低武古代 × 赛博未来 × 资源互补。主角在两个世界间穿梭，利用信息差实现降维打击。',
    exampleWorks: ['从两界开始御兽修仙', '大力丸修仙'],
    coreElements: ['两界穿梭', '信息差', '修仙+科幻', '轻松爽文'],
    targetAudience: '喜欢爽文、设定新颖的读者',
    hotScore: 9,
    sampleTitle: '灵气复苏：我从现代带科技修仙',
    sampleSummary: '普通大学生陈墨意外获得两界穿梭能力，可以在现代都市与古代修仙界之间往来。他利用现代科技知识改良丹药配方，用互联网思维经营修仙门派，将低武世界的修仙文明推向新高度。而他不知道的是，一场针对两界的阴谋正在悄然酝酿……',
    sampleGenre: '仙侠',
    sampleWritingStyle: '轻松幽默',
    tags: ['仙侠', '两界', '科技', '爽文']
  },
  {
    id: 'male-family-cultivation',
    category: 'male',
    title: '家族修仙 × 群像养成',
    description: '家族传承 × 群像塑造 × 养成式爽感。多代人共同成长，体验从弱小到强大的蜕变。',
    exampleWorks: ['玄鉴仙族', '苟在初圣魔门当人材'],
    coreElements: ['家族传承', '群像塑造', '养成', '慢热'],
    targetAudience: '喜欢细腻描写、愿意投入时间阅读的读者',
    hotScore: 8,
    sampleTitle: '玄鉴仙族：从小透明到修仙界霸主',
    sampleSummary: '穿越成偏远山村小家族的废物子弟，陈家的命运从一面神秘古镜开始改变。有了玄鉴仙镜，陈家子弟修炼速度倍增，还能窥探机缘、预知危机。陈墨带领家族一步步崛起，从被人轻视的末流小族，成长为修仙界的一方霸主。',
    sampleGenre: '仙侠',
    sampleWritingStyle: '慢热养成',
    tags: ['仙侠', '家族', '养成', '群像']
  },
  {
    id: 'male-scifi-humanity',
    category: 'male',
    title: '科幻人性 × 希望朋克',
    description: '科技伦理 × 末世生存 × 人性探讨。在末日背景下探讨人性光明与黑暗。',
    exampleWorks: ['异度旅社'],
    coreElements: ['科幻', '末世', '人性', '希望'],
    targetAudience: '喜欢深度思考、关注人性的读者',
    hotScore: 8,
    sampleTitle: '废土纪元：我在末日造家园',
    sampleSummary: '公元2150年，一场突如其来的灾难让人类文明倒退百年。幸存者们在废墟上艰难求生，主角苏白带领一群流浪者，在荒芜的废土上建立起了最后的家园。这里有残酷的资源争夺，也有温暖的守望相助。',
    sampleGenre: '科幻',
    sampleWritingStyle: '细腻温情',
    tags: ['科幻', '末日', '人性', '治愈']
  },
  {
    id: 'male-classics-parody',
    category: 'male',
    title: '名著IP二创 × 穿书',
    description: '名著背景 × 现代视角 × 爽文重构。借助经典IP的读者基础进行创新。',
    exampleWorks: ['西游记', '红楼梦', '三国演义'],
    coreElements: ['穿书', '名著二创', '历史', '轻松'],
    targetAudience: '喜欢历史、熟悉经典的读者',
    hotScore: 8,
    sampleTitle: '大圣传：我在西游世界当幕后黑手',
    sampleSummary: '穿越成菩提祖师的杂役弟子，李轩获得了「因果推演」系统。他知晓西行取经背后的博弈，看透满天神佛的算计。既然重生一世，他决心改写这场注定悲剧的取经之路——他要让齐天大圣真正跳出棋盘。',
    sampleGenre: '玄幻',
    sampleWritingStyle: '轻松幽默',
    tags: ['西游记', '穿书', '幕后', '爽文']
  },
  {
    id: 'female-no-cp-hero',
    category: 'female',
    title: '真大女主 × 无CP',
    description: '事业线优先 × 专注自我成长 × 感情线淡化。女主角专注搞事业，不依附任何人。',
    exampleWorks: ['游戏入侵', '我在废土世界扫垃圾'],
    coreElements: ['无CP', '大女主', '事业线', '成长'],
    targetAudience: '追求独立女性形象、不喜欢感情线的读者',
    hotScore: 10,
    sampleTitle: '星际领主：我在废土建王国',
    sampleSummary: '末世降临，丧尸横行，人类幸存者龟缩在最后的安全区。曾经的天之骄女苏晚晴醒来发现自己重生回灾难降临前一个月。这一次，她不会再相信任何人，只相信自己。她要打造最强避难所，在废土上建立自己的王国。',
    sampleGenre: '科幻',
    sampleWritingStyle: '热血激昂',
    tags: ['无CP', '大女主', '末世', '事业']
  },
  {
    id: 'female-ancient-politics',
    category: 'female',
    title: '古言权谋 × 科举女强',
    description: '古代权谋 × 女性逆袭 × 男女双强。女主在男权社会中杀出重围。',
    exampleWorks: ['灯花笑', '探花'],
    coreElements: ['古言', '权谋', '科举', '女强'],
    targetAudience: '喜欢古风、权谋情节的读者',
    hotScore: 10,
    sampleTitle: '女状师：我在古代翻案无数',
    sampleSummary: '现代顶级律师一朝穿越，成了古代被退婚的落魄嫡女。面对势利眼的家人、薄情的未婚夫，她冷笑一声，转身开设女子学堂，教女子读书识字。又因一次偶然，她发现自己竟然有断案天赋，从此女状师的名号响彻京城。',
    sampleGenre: '言情',
    sampleWritingStyle: '细腻温情',
    tags: ['古言', '权谋', '事业', '双强']
  },
  {
    id: 'female-scifi-romance',
    category: 'female',
    title: '科幻言情 × 星际女强',
    description: '星际/末世 × 女性成长 × 感情线「强强联合」。女主在星际时代绽放光芒。',
    exampleWorks: ['第一战场指挥官!', '御兽王座'],
    coreElements: ['星际', '女强', '科幻', '言情'],
    targetAudience: '喜欢科幻元素和感情线的读者',
    hotScore: 8,
    sampleTitle: '星际指挥官：我的战舰我做主',
    sampleSummary: '21世纪最年轻的女将军沈若琳，在一次实验中意外穿越到三千年后的星际时代。机甲、战舰、星际战争……面对陌生的世界，她凭借过人的军事才能和对战场的敏锐直觉，一步步从底层士兵成长为帝国最年轻的女指挥官。',
    sampleGenre: '科幻',
    sampleWritingStyle: '热血激昂',
    tags: ['星际', '女强', '科幻', '言情']
  },
  {
    id: 'female-city-healing',
    category: 'female',
    title: '都市治愈 × 心灵共鸣',
    description: '现实主义 × 成长救赎 × 情绪共鸣。贴近生活的温暖故事。',
    exampleWorks: ['寂寞的鲸鱼', '她真的很难追'],
    coreElements: ['都市', '治愈', '成长', '现实'],
    targetAudience: '喜欢现实题材、追求情感共鸣的读者',
    hotScore: 8,
    sampleTitle: '海边的治愈小屋',
    sampleSummary: '辞去高压工作后，林念来到海边小镇开了一家民宿。她以为自己只是想要逃避，却发现这里的美景、淳朴的居民，还有一只总是赖在她店门口的橘猫，正在慢慢治愈她千疮百孔的心。',
    sampleGenre: '都市',
    sampleWritingStyle: '细腻温情',
    tags: ['都市', '治愈', '慢热', '现实']
  },
  {
    id: 'unisex-folk-mystery',
    category: 'unisex',
    title: '民俗悬疑 × 单元探案',
    description: '中式恐怖 × 单元破案 × 社会隐喻。融入中国传统文化元素的悬疑故事。',
    exampleWorks: ['鱼灯引魂记', '捞尸人'],
    coreElements: ['民俗', '悬疑', '单元剧', '中式恐怖'],
    targetAudience: '喜欢中式恐怖、社会派推理的读者',
    hotScore: 9,
    sampleTitle: '殡仪馆修复师：我在人间渡亡魂',
    sampleSummary: '姜晚意外继承了祖父的殡仪馆，成为一名遗体修复师。在这个被视为禁忌的行业中，她用双手抚平逝者的容颜，也渐渐发现一些「不该存在」的亡魂在人间徘徊。她发现自己拥有沟通阴阳的能力，而这些亡魂的死因背后，往往藏着惊人的秘密……',
    sampleGenre: '悬疑',
    sampleWritingStyle: '悬疑烧脑',
    tags: ['民俗', '悬疑', '单元剧', '治愈']
  },
  {
    id: 'unisex-historical-research',
    category: 'unisex',
    title: '考据式穿越 × 东方美学',
    description: '细节真实 × 文化考据 × 历史重塑。严谨考据的穿越历史文。',
    exampleWorks: ['青山', '1979黄金时代'],
    coreElements: ['历史', '考据', '穿越', '东方美学'],
    targetAudience: '喜欢历史、有一定文化底蕴的读者',
    hotScore: 8,
    sampleTitle: '大宋工艺师：我用榫卯惊艳世界',
    sampleSummary: '穿越成南宋时期的木匠学徒，陈安发现这个时代的工艺技术远超他的想象。他将现代力学知识与传统榫卯工艺结合，创造出前所未有的建筑结构。从民间小作坊到皇家宫殿，他的名字开始在大宋工匠界传颂。',
    sampleGenre: '历史',
    sampleWritingStyle: '史诗宏大',
    tags: ['历史', '考据', '穿越', '工艺']
  },
  {
    id: 'unisex-light-healing-office',
    category: 'unisex',
    title: '轻治愈职场 × 微异能',
    description: '职场日常 × 设定驱动 × 正向能量。轻松愉快的工作日常。',
    exampleWorks: ['都市异能类日常文'],
    coreElements: ['职场', '异能', '治愈', '日常'],
    targetAudience: '喜欢轻松日常、不想烧脑的读者',
    hotScore: 8,
    sampleTitle: '上班有点烦：我的异能是摸鱼',
    sampleSummary: '社畜李薇发现自己觉醒了一种奇怪的异能——她能看见同事的「摸鱼指数」。凭借这个能力，她在职场如鱼得水，成功避开各种坑爹任务。然而她不知道的是，老板似乎也有什么秘密……',
    sampleGenre: '都市',
    sampleWritingStyle: '轻松幽默',
    tags: ['都市', '职场', '异能', '日常']
  }
]

export function getInspirationsByCategory(category?: InspirationCategory, limit?: number): HotInspiration[] {
  let result = inspirations
  
  if (category) {
    result = result.filter(ins => ins.category === category)
  }
  
  result.sort((a, b) => b.hotScore - a.hotScore)
  
  if (limit) {
    result = result.slice(0, limit)
  }
  
  return enhanceInspirations(result)
}

export function getRandomInspirations(category?: InspirationCategory, count: number = 6): HotInspiration[] {
  let pool = [...inspirations]
  
  if (category) {
    pool = pool.filter(ins => ins.category === category)
  }
  
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  
  return enhanceInspirations(pool.slice(0, count))
}
