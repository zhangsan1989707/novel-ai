export interface HookTechnique {
  id: string
  name: string
  category: 'chapter_start' | 'chapter_end' | 'paragraph'
  description: string
  example: string
  applicableGenres: string[]
  strength: 'strong' | 'medium' | 'weak'
}

export const chapterStartHooks: HookTechnique[] = [
  { id: 'cs-1', name: '悬念开场', category: 'chapter_start', description: '以一个未解之谜或反常现象开篇', example: '尸体是三天后才发现的，但日记却在五天前就停了。', applicableGenres: ['悬疑', '都市', '玄幻'], strength: 'strong' },
  { id: 'cs-2', name: '冲突开场', category: 'chapter_start', description: '直接进入冲突场景', example: '"你被开除了。"经理把文件甩在桌上。', applicableGenres: ['都市', '言情', '职场'], strength: 'strong' },
  { id: 'cs-3', name: '反转开场', category: 'chapter_start', description: '以出乎意料的信息打破读者预期', example: '所有人都以为他死了——包括他自己。', applicableGenres: ['玄幻', '科幻', '都市'], strength: 'strong' },
  { id: 'cs-4', name: '对话开场', category: 'chapter_start', description: '用一段引人入胜的对话开始', example: '"你知道规矩的。"老人把茶杯推到桌中间，"喝了这杯茶，就没有回头路。"', applicableGenres: ['仙侠', '历史', '都市'], strength: 'medium' },
  { id: 'cs-5', name: '感官开场', category: 'chapter_start', description: '用强烈的感官描写制造沉浸感', example: '血腥味比记忆中更浓。', applicableGenres: ['玄幻', '军事', '悬疑'], strength: 'medium' },
  { id: 'cs-6', name: '时间压力开场', category: 'chapter_start', description: '设定紧迫的时间限制', example: '距离爆炸还有七分钟，而他还在三楼。', applicableGenres: ['悬疑', '科幻', '都市'], strength: 'strong' },
  { id: 'cs-7', name: '对比开场', category: 'chapter_start', description: '用强烈反差制造戏剧性', example: '全城都在庆祝，只有他知道灾难即将降临。', applicableGenres: ['玄幻', '科幻', '历史'], strength: 'medium' },
]

export const chapterEndHooks: HookTechnique[] = [
  { id: 'ce-1', name: '悬念截断', category: 'chapter_end', description: '在关键时刻截断叙述', example: '门开了，他看见了一张不该出现的脸。', applicableGenres: ['悬疑', '都市', '玄幻'], strength: 'strong' },
  { id: 'ce-2', name: '危机升级', category: 'chapter_end', description: '问题比之前更加严重', example: '他终于解开了密码，屏幕上显示：自毁程序已启动。', applicableGenres: ['科幻', '悬疑', '都市'], strength: 'strong' },
  { id: 'ce-3', name: '秘密揭示', category: 'chapter_end', description: '揭示一个改变全局的秘密', example: '她翻开日记最后一页，上面写着她自己的名字——和死亡日期。', applicableGenres: ['悬疑', '言情', '都市'], strength: 'strong' },
  { id: 'ce-4', name: '角色转变', category: 'chapter_end', description: '角色做出出乎意料的决定', example: '他放下剑，朝敌人走去。', applicableGenres: ['玄幻', '仙侠', '历史'], strength: 'medium' },
  { id: 'ce-5', name: '新威胁出现', category: 'chapter_end', description: '引入新的威胁或敌人', example: '电话响了，来电显示：已故之人。', applicableGenres: ['悬疑', '都市', '科幻'], strength: 'strong' },
  { id: 'ce-6', name: '承诺与期待', category: 'chapter_end', description: '暗示即将发生的重要事件', example: '明天，一切都会不同。她这样告诉自己，却不知道"不同"意味着什么。', applicableGenres: ['言情', '都市', '玄幻'], strength: 'medium' },
  { id: 'ce-7', name: '反讽结尾', category: 'chapter_end', description: '用反差或讽刺制造回味', example: '他终于得到了梦寐以求的职位，代价是出卖了唯一的朋友。', applicableGenres: ['都市', '职场', '历史'], strength: 'medium' },
  { id: 'ce-8', name: '伏笔埋设', category: 'chapter_end', description: '不经意地埋下后续线索', example: '她没有注意到，街角的监控摄像头正缓缓转向她的方向。', applicableGenres: ['悬疑', '科幻', '都市'], strength: 'medium' },
  { id: 'ce-9', name: '情感高潮', category: 'chapter_end', description: '在情感最高点结束', example: '他终于说出了那句藏了十年的话，泪水模糊了视线。', applicableGenres: ['言情', '都市', '历史'], strength: 'strong' },
  { id: 'ce-10', name: '选择困境', category: 'chapter_end', description: '角色面临两难选择', example: '左边是母亲，右边是女儿，他只能救一个。', applicableGenres: ['玄幻', '都市', '悬疑'], strength: 'strong' },
  { id: 'ce-11', name: '时间跳跃预告', category: 'chapter_end', description: '暗示时间线即将变化', example: '他不知道的是，三年后的自己正站在同一片废墟上。', applicableGenres: ['科幻', '都市', '玄幻'], strength: 'medium' },
  { id: 'ce-12', name: '疑问抛出', category: 'chapter_end', description: '抛出一个让读者思考的问题', example: '如果重来一次，他还会做出同样的选择吗？', applicableGenres: ['都市', '言情', '历史'], strength: 'weak' },
  { id: 'ce-13', name: '命运暗示', category: 'chapter_end', description: '暗示角色的命运走向', example: '她笑着关上门，不知道这扇门再也不会为她打开。', applicableGenres: ['言情', '历史', '都市'], strength: 'medium' },
]

export const paragraphHooks: HookTechnique[] = [
  { id: 'ph-1', name: '微悬念', category: 'paragraph', description: '段落末尾留下小悬念', example: '他打开抽屉，愣住了。', applicableGenres: ['悬疑', '都市', '玄幻'], strength: 'medium' },
  { id: 'ph-2', name: '信息差', category: 'paragraph', description: '读者知道角色不知道的信息', example: '她不知道，身后的人已经举起了刀。', applicableGenres: ['悬疑', '都市', '言情'], strength: 'strong' },
  { id: 'ph-3', name: '感官锚点', category: 'paragraph', description: '用感官细节锚定读者注意力', example: '空气里弥漫着铁锈的味道——那是血干涸后的气味。', applicableGenres: ['玄幻', '军事', '悬疑'], strength: 'medium' },
]

const allHooks: HookTechnique[] = [...chapterStartHooks, ...chapterEndHooks, ...paragraphHooks]

export function getHooksByCategory(category: HookTechnique['category']): HookTechnique[] {
  return allHooks.filter(h => h.category === category)
}

export function getHooksByGenre(genre: string): HookTechnique[] {
  return allHooks.filter(h => h.applicableGenres.includes(genre))
}

export function getRandomHook(category?: HookTechnique['category'], genre?: string): HookTechnique {
  let pool = allHooks
  if (category) pool = pool.filter(h => h.category === category)
  if (genre) pool = pool.filter(h => h.applicableGenres.includes(genre))
  return pool[Math.floor(Math.random() * pool.length)]
}
