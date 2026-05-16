export interface StyleModule {
  id: string
  name: string
  category: 'combat' | 'dialogue' | 'emotion' | 'description' | 'pacing'
  description: string
  rules: string[]
  examples: { good: string; bad: string }[]
  applicableGenres: string[]
}

export const styleModules: StyleModule[] = [
  { id: 'style-combat', name: '打斗写法', category: 'combat', description: '策略+反转，不写流水账', rules: ['不要"你一拳我一脚"的流水账', '写策略和反转', '用短句加速节奏', '关键一击用慢镜头'], examples: [{ good: '他没有躲。刀锋贴着脸颊划过的时候，他已经欺身而入——左手扣住对方手腕，右肘砸向咽喉。', bad: '他出了一拳，对方也出了一拳，他又出了一拳，对方又出了一拳。' }], applicableGenres: ['玄幻', '都市', '武侠'] },
  { id: 'style-face', name: '装逼打脸', category: 'combat', description: '先抑后扬，反差爆发', rules: ['先铺垫对手的轻视', '主角低调不解释', '一击制胜，干净利落', '围观者震惊反应'], examples: [{ good: '"就凭你？"对方甚至没有拔剑。他也没拔。只是走过的时候，对方的剑鞘上多了一道裂纹。', bad: '他很厉害，一招就把对方打败了，所有人都很惊讶。' }], applicableGenres: ['玄幻', '都市', '仙侠'] },
  { id: 'style-dialogue', name: '对话技法', category: 'dialogue', description: '推进剧情或揭示性格', rules: ['对话要有潜台词', '不能只为了凑字数', '偶尔干对话不加动作描写', '用语气词增加真实感'], examples: [{ good: '"你来了。""嗯。""……坐吧。""不坐。"她把钥匙放在桌上，"我来拿东西。"', bad: '"你好，"他微笑着说道，"很高兴见到你，"他继续说道，眼神中充满了喜悦。' }], applicableGenres: ['都市', '言情', '悬疑'] },
  { id: 'style-emotion', name: '情绪描写', category: 'emotion', description: '用行为细节代替心理描写', rules: ['情绪通过行为体现', '用身体反应代替内心独白', '不要"他感到愤怒"', '允许意识流'], examples: [{ good: '他攥紧了拳头，指甲嵌进掌心。茶杯在桌上晃了一下。', bad: '他感到非常愤怒，内心充满了怒火，他觉得这一切太不公平了。' }], applicableGenres: ['都市', '言情', '玄幻'] },
  { id: 'style-pacing', name: '节奏控制', category: 'pacing', description: '快慢交替，张弛有度', rules: ['重要情节可以"拖戏"', '无聊过场一句话带过', '段落长短参差不齐', '高潮用短句'], examples: [{ good: '三年后。他站在同一座桥上，风比记忆中更冷。', bad: '经过了漫长的三年时间，他终于再次来到了这座桥上，站在了和三年前一样的位置。' }], applicableGenres: ['玄幻', '都市', '仙侠'] },
]

export function getStylesByCategory(category: StyleModule['category']): StyleModule[] {
  return styleModules.filter(s => s.category === category)
}

export function getStylesByGenre(genre: string): StyleModule[] {
  return styleModules.filter(s => s.applicableGenres.includes(genre))
}
