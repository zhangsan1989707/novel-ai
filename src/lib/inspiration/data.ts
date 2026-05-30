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
    return '超长篇连载，建议 200 万字以上，适合 700 章以上'
  }
  if (/(悬疑|烧脑|轻松|日常)/.test(writingStyle)) {
    return '长篇连载，建议 80 万字起步，适合 300 章左右'
  }
  if (category === 'female') {
    return '中长篇连载，建议 30-80 万字，适合 100-300 章'
  }
  return '长篇连载，建议 80 万字以上，适合 300 章起步'
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
  },
  {
    id: 'male-system-gaming',
    category: 'male',
    title: '游戏系统流 × 无限升级',
    description: '游戏面板 × 数据化世界 × 疯狂升级。主角获得游戏系统，将现实变成升级游戏。',
    exampleWorks: ['我有一座恐怖屋', '全球高武'],
    coreElements: ['系统流', '游戏面板', '升级', '爽文'],
    targetAudience: '喜欢数据化升级、追求爽感的读者',
    hotScore: 9,
    sampleTitle: '全球游戏化：我能看见属性面板',
    sampleSummary: '一夜之间，全球变成了游戏世界。所有人都获得了属性面板，而林辰发现自己的面板上多了一个「无限加点」按钮。当别人还在为一点属性苦苦挣扎时，他已经把所有属性拉满了……',
    sampleGenre: '都市',
    sampleWritingStyle: '快节奏爽文',
    tags: ['系统', '游戏', '升级', '爽文']
  },
  {
    id: 'male-reborn-investor',
    category: 'male',
    title: '重生商战 × 投资封神',
    description: '重生逆袭 × 商业博弈 × 投资神话。带着记忆重生，用信息差封神。',
    exampleWorks: ['重生之资本帝国', '重生之神级败家子'],
    coreElements: ['重生', '商战', '投资', '逆袭'],
    targetAudience: '喜欢商战、追求逆袭爽感的读者',
    hotScore: 8,
    sampleTitle: '重生2008：我用比特币封神',
    sampleSummary: '互联网高管重生回到2008年金融危机前夕。这一世，他要抓住比特币、移动互联网、短视频三大风口，从零开始打造一个万亿商业帝国。但他很快发现，重生者不止他一个……',
    sampleGenre: '都市',
    sampleWritingStyle: '快节奏爽文',
    tags: ['重生', '商战', '投资', '都市']
  },
  {
    id: 'male-martial-peak',
    category: 'male',
    title: '武道巅峰 × 无敌流',
    description: '武道世界 × 无敌碾压 × 热血战斗。主角以无敌之姿横扫一切对手。',
    exampleWorks: ['武炼巅峰', '万古武帝'],
    coreElements: ['武道', '无敌', '热血', '碾压'],
    targetAudience: '喜欢热血战斗、追求无敌爽感的读者',
    hotScore: 8,
    sampleTitle: '武道至尊：一拳破万法',
    sampleSummary: '林天穿越到武道为尊的世界，觉醒了「绝对力量」天赋。当别人还在苦修武技时，他已经一拳打爆了所有花里胡哨。宗门大比？一拳。世家挑衅？一拳。天骄对决？还是一拳。',
    sampleGenre: '玄幻',
    sampleWritingStyle: '快节奏爽文',
    tags: ['武道', '无敌', '热血', '玄幻']
  },
  {
    id: 'female-reborn-ancient',
    category: 'female',
    title: '重生古言 × 宅斗翻盘',
    description: '重生复仇 × 宅斗智谋 × 逆袭上位。前世惨死，今生翻盘。',
    exampleWorks: ['知否知否', '庶女攻略'],
    coreElements: ['重生', '宅斗', '复仇', '逆袭'],
    targetAudience: '喜欢宅斗、重生复仇线的读者',
    hotScore: 9,
    sampleTitle: '重生嫡女：这次我不做棋子',
    sampleSummary: '前世她被继母算计，被庶妹夺走一切，最后惨死冷宫。重生回到出嫁前夜，她发誓不再做任人摆布的棋子。这一世，她要亲手撕碎那些虚伪的面具，夺回属于自己的荣耀。',
    sampleGenre: '言情',
    sampleWritingStyle: '细腻温情',
    tags: ['重生', '古言', '宅斗', '复仇']
  },
  {
    id: 'female-sweet-love',
    category: 'female',
    title: '甜宠文 × 双向奔赴',
    description: '高甜互动 × 双向暗恋 × 宠溺日常。甜甜的恋爱，双向奔赴的心动。',
    exampleWorks: ['偷偷藏不住', '难哄'],
    coreElements: ['甜宠', '双向暗恋', '日常', '高甜'],
    targetAudience: '喜欢甜蜜恋爱、轻松氛围的读者',
    hotScore: 9,
    sampleTitle: '偷偷喜欢你：学霸的暗恋日记',
    sampleSummary: '全校都知道学霸陆言清冷高不可攀，只有苏念知道他会在她感冒时悄悄在她桌上放姜茶。她以为这是单方面的暗恋，却不知道他抽屉里那本日记，每一页都写满了她的名字。',
    sampleGenre: '言情',
    sampleWritingStyle: '轻松幽默',
    tags: ['甜宠', '校园', '暗恋', '高甜']
  },
  {
    id: 'female-fantasy-romance',
    category: 'female',
    title: '玄幻言情 × 女主修仙',
    description: '修仙世界 × 女主成长 × 跨种族恋爱。在修仙世界中绽放的女主。',
    exampleWorks: ['仙逆', '一仙难求'],
    coreElements: ['修仙', '女强', '言情', '成长'],
    targetAudience: '喜欢修仙世界观和感情线结合的读者',
    hotScore: 8,
    sampleTitle: '仙途：我在修仙界搞科研',
    sampleSummary: '化学博士穿越到修仙世界，发现这个世界虽然有灵力，但炼丹术还停留在「经验主义」阶段。她决定用现代科学方法革新修仙界，从建立灵草分子数据库开始，一步步成为修仙界的「科研女神」。',
    sampleGenre: '仙侠',
    sampleWritingStyle: '轻松幽默',
    tags: ['修仙', '女强', '穿越', '科研']
  },
  {
    id: 'female-entertainment',
    category: 'female',
    title: '娱乐圈女强 × 逆袭封后',
    description: '娱乐圈 × 逆袭打脸 × 事业为王。从十八线到顶流的逆袭之路。',
    exampleWorks: ['影后', '国民校草是女生'],
    coreElements: ['娱乐圈', '逆袭', '打脸', '事业'],
    targetAudience: '喜欢娱乐圈题材、逆袭打脸剧情的读者',
    hotScore: 8,
    sampleTitle: '影后重生：这次我不靠任何人',
    sampleSummary: '前世她是最年轻的影后，却在巅峰时期被全网黑，含冤而死。重生回到出道前，她发誓不再相信任何人。用自己的演技打脸所有质疑她的人，一步步重回巅峰，这次她要站得更高。',
    sampleGenre: '都市',
    sampleWritingStyle: '热血激昂',
    tags: ['娱乐圈', '重生', '逆袭', '女强']
  },
  {
    id: 'unisex-cosmic-horror',
    category: 'unisex',
    title: '克苏鲁 × 无限流',
    description: '不可名状的恐惧 × 无限副本 × 团队生存。在恐怖世界中挣扎求生。',
    exampleWorks: ['全球高武', '恐怖广播'],
    coreElements: ['克苏鲁', '无限流', '恐怖', '团队'],
    targetAudience: '喜欢恐怖氛围、团队协作剧情的读者',
    hotScore: 8,
    sampleTitle: '无限回廊：我在恐怖世界带队求生',
    sampleSummary: '午夜十二点，全球随机抽取玩家进入「回廊」——一个充满克苏鲁式恐怖的无限副本世界。秦风发现自己的「理智值」永远是满的，这让他成为最冷静的队长。带着一群随时可能疯掉的队友，他要在不可名状的恐惧中杀出一条血路。',
    sampleGenre: '悬疑',
    sampleWritingStyle: '悬疑烧脑',
    tags: ['克苏鲁', '无限流', '恐怖', '生存']
  },
  {
    id: 'unisex-litrpg-adventure',
    category: 'unisex',
    title: 'LitRPG × 地下城冒险',
    description: '数据化冒险 × 地下城探索 × 装备升级。经典RPG体验的网文化呈现。',
    exampleWorks: ['全职高手', '超神机械师'],
    coreElements: ['LitRPG', '地下城', '装备', '冒险'],
    targetAudience: '游戏玩家、喜欢数据化成长的读者',
    hotScore: 8,
    sampleTitle: '地下城工匠：我打造的神器满天飞',
    sampleSummary: '在地下城与勇士并存的世界，苏晨觉醒了「万物锻造」天赋。当冒险者们还在为一把紫色武器发愁时，他的仓库里已经堆满了金色传说。他不仅是最好的工匠，更是地下城中最神秘的幕后玩家。',
    sampleGenre: '游戏',
    sampleWritingStyle: '快节奏爽文',
    tags: ['游戏', '锻造', '冒险', '爽文']
  },
  {
    id: 'unisex-food-healing',
    category: 'unisex',
    title: '美食治愈 × 种田慢生活',
    description: '田园美食 × 慢节奏生活 × 温暖人心。远离内卷的治愈系故事。',
    exampleWorks: ['舌尖上的霍格沃茨', '我在星际做美食'],
    coreElements: ['美食', '种田', '治愈', '慢生活'],
    targetAudience: '压力大、想看轻松治愈故事的读者',
    hotScore: 7,
    sampleTitle: '山间小厨：我用美食治愈所有人',
    sampleSummary: '辞去996工作后，苏暖回到老家山间开了一家小饭馆。没有米其林的精致，只有最朴实的食材和最用心的烹饪。来吃饭的人有失恋的姑娘、加班到崩溃的程序员、吵架后赌气的老夫妻……每个人都被她的美食治愈了。',
    sampleGenre: '都市',
    sampleWritingStyle: '细腻温情',
    tags: ['美食', '治愈', '种田', '慢生活']
  },
  {
    id: 'unisex-time-loop',
    category: 'unisex',
    title: '时间循环 × 无限试错',
    description: '死亡回归 × 信息积累 × 逐步破局。每次死亡都是新线索。',
    exampleWorks: ['十日终焉', '开端'],
    coreElements: ['时间循环', '试错', '悬疑', '烧脑'],
    targetAudience: '喜欢烧脑、享受逐步解谜快感的读者',
    hotScore: 9,
    sampleTitle: '第99次循环：这次我一定能逃出去',
    sampleSummary: '方远发现自己被困在同一天。每次死亡都会回到早上七点，但所有记忆都会保留。第一次他以为是做梦，第十次他开始恐慌，第五十次他已经麻木。到了第九十九次，他已经摸清了这座城市的每一个秘密——包括那场即将毁灭一切的阴谋。',
    sampleGenre: '悬疑',
    sampleWritingStyle: '悬疑烧脑',
    tags: ['时间循环', '悬疑', '烧脑', '解谜']
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
