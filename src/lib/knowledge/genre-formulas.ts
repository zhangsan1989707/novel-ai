export interface GenreFormula {
  id: string
  genre: string
  name: string
  structure: string
  keyElements: string[]
  pacingGuide: string
  readerExpectations: string[]
  commonPitfalls: string[]
}

export const genreFormulas: GenreFormula[] = [
  { id: 'gf-1', genre: '玄幻', name: '升级流公式', structure: '废柴开局→获得金手指→初露锋芒→遭遇强敌→突破升级→碾压对手', keyElements: ['金手指', '等级体系', '打脸', '升级', '地图扩展'], pacingGuide: '每5章一个小升级，每20章一个大升级', readerExpectations: ['爽点密集', '升级感强', '打脸干脆'], commonPitfalls: ['升级太快失去期待', '打脸套路重复', '金手指太无敌'] },
  { id: 'gf-2', genre: '都市', name: '逆袭流公式', structure: '低谷开局→意外机遇→小试牛刀→被人看轻→实力展示→全面逆袭', keyElements: ['身份反差', '隐藏实力', '打脸', '商战/职场', '感情线'], pacingGuide: '前3章建立低谷，5章内第一次反转', readerExpectations: ['代入感强', '反转爽', '现实感'], commonPitfalls: ['主角太完美', '反派太蠢', '脱离现实'] },
  { id: 'gf-3', genre: '仙侠', name: '修仙流公式', structure: '凡人入道→拜师学艺→宗门历练→秘境探险→渡劫飞升', keyElements: ['修炼体系', '宗门', '法宝', '渡劫', '道心'], pacingGuide: '修炼阶段慢节奏，战斗阶段快节奏', readerExpectations: ['仙气飘飘', '道法自然', '意境深远'], commonPitfalls: ['修炼描写太枯燥', '境界设定混乱', '缺少人间烟火'] },
  { id: 'gf-4', genre: '言情', name: '甜宠流公式', structure: '意外相遇→产生误会→逐渐了解→感情升温→危机考验→甜蜜结局', keyElements: ['男主宠溺', '女主独立', '误会推动', '甜度爆表', '安全感'], pacingGuide: '每3章一个甜蜜场景，每10章一个小危机', readerExpectations: ['甜', '宠', '安全感', '代入感'], commonPitfalls: ['女主太弱', '误会太狗血', '男主太霸道'] },
  { id: 'gf-5', genre: '科幻', name: '硬核科幻公式', structure: '设定引入→问题出现→科学探索→技术突破→危机升级→终极对决', keyElements: ['硬核设定', '科学逻辑', '技术细节', '文明冲突', '哲学思考'], pacingGuide: '设定铺垫要充分，逻辑推演要严谨', readerExpectations: ['设定严谨', '逻辑自洽', '脑洞大'], commonPitfalls: ['设定太复杂', '逻辑漏洞', '缺少人文关怀'] },
  { id: 'gf-6', genre: '悬疑', name: '推理流公式', structure: '案件发生→线索收集→推理分析→反转颠覆→真相揭示', keyElements: ['伏笔', '误导', '逻辑链', '反转', '公平线索'], pacingGuide: '每5章一个小反转，结尾大反转', readerExpectations: ['逻辑严密', '反转惊喜', '伏笔回收'], commonPitfalls: ['线索不公平', '反转生硬', '逻辑漏洞'] },
]

export function getFormulaByGenre(genre: string): GenreFormula | undefined {
  return genreFormulas.find(f => f.genre === genre)
}

export function getAllGenres(): string[] {
  return genreFormulas.map(f => f.genre)
}
