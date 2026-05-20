export interface ForbiddenWord {
  word: string
  level: 'critical' | 'warning' | 'optional'
  reason: string
  replacement?: string
  category: 'adverb' | 'simile' | 'emotion' | 'action' | 'structure' | 'style'
}

export interface ForbiddenPattern {
  pattern: string
  description: string
  level: 'critical' | 'warning'
  example: { bad: string; good: string }
}

// ============================================
// 分层禁用词库
// ============================================

// L1: 必换词（扣分重）- 高频AI词
export const criticalWords: ForbiddenWord[] = [
  { word: '不禁', level: 'critical', reason: 'AI高频词', category: 'emotion', replacement: '（直接写动作）' },
  { word: '顿时', level: 'critical', reason: 'AI高频词', category: 'adverb', replacement: '立刻、马上、一下子' },
  { word: '瞬间', level: 'critical', reason: 'AI高频词', category: 'adverb', replacement: '一转眼、一眨眼、眨眼间' },
  { word: '赫然', level: 'critical', reason: 'AI高频词', category: 'adverb', replacement: '突然、猛地、陡然' },
  { word: '蓦然', level: 'critical', reason: 'AI高频词', category: 'adverb', replacement: '忽然、突然、猛地' },
  { word: '骤然', level: 'critical', reason: 'AI高频词', category: 'adverb', replacement: '猛地、陡然、一下子' },
  { word: '陡然', level: 'critical', reason: 'AI高频词', category: 'adverb', replacement: '忽然、突然、一下' },
  { word: '悄然', level: 'critical', reason: 'AI高频词', category: 'adverb', replacement: '偷偷、悄悄、暗暗' },
  { word: '旋即', level: 'critical', reason: 'AI高频词', category: 'adverb', replacement: '马上、立刻、很快' },
  { word: '确实', level: 'critical', reason: 'AI高频确认词', category: 'style', replacement: '（删除或改写）' },
  { word: '毋庸置疑', level: 'critical', reason: 'AI高频确认词', category: 'style', replacement: '（删除或改写）' },
  { word: '可以说', level: 'critical', reason: 'AI高频确认词', category: 'style', replacement: '（删除或改写）' },
  { word: '不由得', level: 'critical', reason: 'AI高频词（旧L2升级）', category: 'emotion', replacement: '忍不住、情不自禁' },
  { word: '不由自主', level: 'critical', reason: 'AI高频词（旧L2升级）', category: 'action', replacement: '控制不住、忍不住' },
  { word: '下意识', level: 'critical', reason: 'AI高频词（旧L2升级）', category: 'action', replacement: '（直接写动作）' },
  { word: '下意识的', level: 'critical', reason: 'AI高频词（旧L2升级）', category: 'action', replacement: '（直接写动作）' },
  { word: '映入眼帘', level: 'critical', reason: 'AI高频短语', category: 'action', replacement: '（直接描写看到的内容）' },
  { word: '深深地', level: 'critical', reason: 'AI高频修饰', category: 'adverb', replacement: '（删除或改写）' },
  { word: '紧紧地', level: 'critical', reason: 'AI高频修饰', category: 'adverb', replacement: '（删除或改写）' },
  { word: '实在', level: 'critical', reason: 'AI高频强调词', category: 'adverb', replacement: '（删除或改写）' },
  { word: '敦实', level: 'critical', reason: 'AI高频形容词', category: 'style', replacement: '结实、扎实' },
  { word: '并无二致', level: 'critical', reason: 'AI高频短语', category: 'style', replacement: '完全一样、没有区别' },
  { word: '几近', level: 'critical', reason: 'AI高频修饰', category: 'adverb', replacement: '几乎、差不多' },
  { word: '浑身一震', level: 'critical', reason: 'AI高频动作', category: 'action', replacement: '（具体描写身体反应）' },
  { word: '心中一惊', level: 'critical', reason: 'AI高频心理', category: 'emotion', replacement: '（通过动作写惊吓）' },
  { word: '瞳孔一缩', level: 'critical', reason: 'AI高频动作', category: 'action', replacement: '（用具体行为表现）' },
  { word: '眼前一亮', level: 'critical', reason: 'AI高频动作', category: 'action', replacement: '（用具体行为表现）' },
  { word: '心头一紧', level: 'critical', reason: 'AI高频心理', category: 'emotion', replacement: '（通过动作写紧张）' },
  { word: '倒吸一口凉气', level: 'critical', reason: 'AI高频动作', category: 'action', replacement: '（用具体行为表现）' },
  { word: '眉头一皱', level: 'critical', reason: 'AI高频动作', category: 'action', replacement: '（用具体行为表现）' },
  { word: '嘴角一抽', level: 'critical', reason: 'AI高频动作', category: 'action', replacement: '（用具体行为表现）' },
  { word: '眼角一抽', level: 'critical', reason: 'AI高频动作', category: 'action', replacement: '（用具体行为表现）' },
  { word: '在…之下', level: 'critical', reason: 'AI高频僵化句式', category: 'structure', replacement: '（改写句子结构）' },
  { word: '在…之中', level: 'critical', reason: 'AI高频僵化句式', category: 'structure', replacement: '（改写句子结构）' },
  { word: '在…之后', level: 'critical', reason: 'AI高频僵化句式', category: 'structure', replacement: '（改写句子结构）' },
]

// L2: 建议换词（扣分轻）- 中频AI词
export const warningWords: ForbiddenWord[] = [
  { word: '缓缓', level: 'warning', reason: 'AI高频词', category: 'adverb', replacement: '慢慢、一点点、逐步' },
  { word: '微微', level: 'warning', reason: 'AI高频词', category: 'adverb', replacement: '稍微、一点、略' },
  { word: '淡淡', level: 'warning', reason: 'AI高频词', category: 'adverb', replacement: '有点、略微、稍' },
  { word: '轻轻', level: 'warning', reason: 'AI高频词', category: 'adverb', replacement: '稍稍、小心' },
  { word: '默默', level: 'warning', reason: 'AI高频词', category: 'adverb', replacement: '悄悄、暗自' },
  { word: '深深', level: 'warning', reason: 'AI高频词', category: 'adverb', replacement: '（删除或改写）' },
  { word: '渐渐', level: 'warning', reason: 'AI高频词', category: 'adverb', replacement: '慢慢、逐步、一点一点' },
  { word: '竟然', level: 'warning', reason: 'AI高频词', category: 'emotion', replacement: '居然、竟、偏' },
  { word: '居然', level: 'warning', reason: 'AI高频词', category: 'emotion', replacement: '竟然、竟、偏' },
  { word: '显然', level: 'warning', reason: 'AI高频词', category: 'style', replacement: '（删除或改写）' },
  { word: '极目', level: 'warning', reason: '过度使用动作词', category: 'action', replacement: '放眼望去、远眺' },
  { word: '举目', level: 'warning', reason: '过度使用动作词', category: 'action', replacement: '抬头、抬眼' },
  { word: '环顾', level: 'warning', reason: '过度使用动作词', category: 'action', replacement: '四处看看、四下张望' },
  { word: '打量', level: 'warning', reason: '过度使用动作词', category: 'action', replacement: '看看、瞧了瞧' },
  { word: '凝望', level: 'warning', reason: '过度使用动作词', category: 'action', replacement: '盯着、注视' },
  { word: '此刻', level: 'warning', reason: 'AI高频时间词', category: 'adverb', replacement: '这会儿、这时候' },
  { word: '此时', level: 'warning', reason: 'AI高频时间词', category: 'adverb', replacement: '这会儿、这时候' },
  { word: '当下', level: 'warning', reason: 'AI高频时间词', category: 'adverb', replacement: '眼下、这会儿' },
  { word: '如今的', level: 'warning', reason: 'AI高频时间词', category: 'adverb', replacement: '现在、眼下的' },
  { word: '现如今', level: 'warning', reason: 'AI高频时间词', category: 'adverb', replacement: '现在、如今' },
  { word: '仿佛', level: 'warning', reason: 'AI高频比喻词', category: 'simile', replacement: '好像、像' },
  { word: '犹如', level: 'warning', reason: 'AI高频比喻词', category: 'simile', replacement: '好像、像' },
  { word: '宛如', level: 'warning', reason: 'AI高频比喻词', category: 'simile', replacement: '好像、像' },
  { word: '宛若', level: 'warning', reason: 'AI高频比喻词', category: 'simile', replacement: '好像、像' },
  { word: '好似', level: 'warning', reason: 'AI高频比喻词', category: 'simile', replacement: '好像、像' },
  { word: '如同', level: 'warning', reason: 'AI高频比喻词', category: 'simile', replacement: '好像、像' },
  { word: '甚为', level: 'warning', reason: 'AI高频程度副词', category: 'adverb', replacement: '很、非常' },
  { word: '极为', level: 'warning', reason: 'AI高频程度副词', category: 'adverb', replacement: '很、非常' },
  { word: '颇为', level: 'warning', reason: 'AI高频程度副词', category: 'adverb', replacement: '有点、挺' },
  { word: '稍微', level: 'warning', reason: 'AI高频程度副词', category: 'adverb', replacement: '有点、略微' },
  { word: '略微', level: 'warning', reason: 'AI高频程度副词', category: 'adverb', replacement: '有点、稍微' },
  { word: '些许', level: 'warning', reason: 'AI高频程度副词', category: 'adverb', replacement: '一点、几分' },
  { word: '绝佳', level: 'warning', reason: 'AI高频修饰', category: 'style', replacement: '很好、极好' },
  { word: '绝妙', level: 'warning', reason: 'AI高频修饰', category: 'style', replacement: '巧妙、精妙' },
  { word: '绝顶', level: 'warning', reason: 'AI高频修饰', category: 'adverb', replacement: '极其、极为' },
  { word: '极其', level: 'warning', reason: 'AI高频程度副词', category: 'adverb', replacement: '非常、十分' },
  { word: '异常地', level: 'warning', reason: 'AI高频程度副词', category: 'adverb', replacement: '非常、格外' },
  { word: '大抵', level: 'warning', reason: 'AI高频推断词', category: 'style', replacement: '大多、大都' },
  { word: '大抵上', level: 'warning', reason: 'AI高频推断词', category: 'style', replacement: '大多、大都' },
  { word: '多半', level: 'warning', reason: 'AI高频推断词', category: 'style', replacement: '大多、大都' },
  { word: '多半是', level: 'warning', reason: 'AI高频推断词', category: 'style', replacement: '大多是、可能是' },
  { word: '几乎', level: 'warning', reason: 'AI高频程度副词', category: 'adverb', replacement: '差不多、快要' },
  { word: '近乎', level: 'warning', reason: 'AI高频程度副词', category: 'adverb', replacement: '差不多、接近' },
  { word: '近乎于', level: 'warning', reason: 'AI高频程度副词', category: 'adverb', replacement: '差不多、接近' },
  { word: '的确', level: 'warning', reason: 'AI高频确认词', category: 'style', replacement: '（删除或改用细节刻画）' },
  { word: '着实', level: 'warning', reason: 'AI高频确认词', category: 'style', replacement: '（删除或改用细节刻画）' },
  { word: '实实在在地', level: 'warning', reason: 'AI高频确认词', category: 'style', replacement: '（删除或改用细节刻画）' },
  { word: '明显地', level: 'warning', reason: 'AI高频判断词', category: 'style', replacement: '（删除，直接写现象）' },
  { word: '明显地看出来', level: 'warning', reason: 'AI高频判断词', category: 'style', replacement: '（删除，直接写现象）' },
  { word: '很显然', level: 'warning', reason: 'AI高频判断词', category: 'style', replacement: '（删除，直接写现象）' },
  { word: '一动不动', level: 'warning', reason: 'AI高频动作描写', category: 'action', replacement: '（具体描写静态状态）' },
  { word: '一声不吭', level: 'warning', reason: 'AI高频动作描写', category: 'action', replacement: '沉默、不说话' },
  { word: '一言不发', level: 'warning', reason: 'AI高频动作描写', category: 'action', replacement: '沉默、不说话' },
  { word: '目光落在', level: 'warning', reason: 'AI高频视线描写', category: 'action', replacement: '看向、望着' },
  { word: '视线落在', level: 'warning', reason: 'AI高频视线描写', category: 'action', replacement: '看向、望着' },
  { word: '眼神落在', level: 'warning', reason: 'AI高频视线描写', category: 'action', replacement: '看向、望着' },
]

// L3: 可选优化词 - 句式问题
export const optionalWords: ForbiddenWord[] = [
  { word: '首先', level: 'optional', reason: '过度规整', category: 'structure', replacement: '（改用自然的叙述）' },
  { word: '其次', level: 'optional', reason: '过度规整', category: 'structure', replacement: '（改用自然的叙述）' },
  { word: '最后', level: 'optional', reason: '过度规整', category: 'structure', replacement: '（改用自然的叙述）' },
  { word: '总之', level: 'optional', reason: '过度规整', category: 'structure', replacement: '（改用自然的叙述）' },
  { word: '综上所述', level: 'optional', reason: '过度规整', category: 'structure', replacement: '（删除或改写）' },
  { word: '可见', level: 'optional', reason: '过度规整', category: 'structure', replacement: '（删除或改写）' },
  { word: '此时此刻', level: 'optional', reason: '过度强调', category: 'style', replacement: '现在、这会儿' },
  { word: '换言之', level: 'optional', reason: '过度规整', category: 'style', replacement: '（删除或改写）' },
  { word: '换句话说', level: 'optional', reason: '过度规整', category: 'style', replacement: '（删除或改写）' },
  { word: '事实上', level: 'optional', reason: '过度规整', category: 'style', replacement: '（删除或改写）' },
  { word: '实际上', level: 'optional', reason: '过度规整', category: 'style', replacement: '（删除或改写）' },
  { word: '客观来说', level: 'optional', reason: '过度规整', category: 'style', replacement: '（删除或改写）' },
  { word: '主观来讲', level: 'optional', reason: '过度规整', category: 'style', replacement: '（删除或改写）' },
  { word: '不得不承认', level: 'optional', reason: '过度规整', category: 'style', replacement: '（删除或改写）' },
  { word: '有目共睹', level: 'optional', reason: '过度规整', category: 'style', replacement: '（删除或改写）' },
  { word: '众所周知', level: 'optional', reason: '过度规整', category: 'style', replacement: '（删除或改写）' },
  { word: '不言而喻', level: 'optional', reason: '过度规整', category: 'style', replacement: '（删除或改写）' },
  { word: '或许', level: 'optional', reason: 'AI高频揣测词', category: 'style', replacement: '可能、说不定' },
  { word: '也许', level: 'optional', reason: 'AI高频揣测词', category: 'style', replacement: '可能、说不定' },
  { word: '大概', level: 'optional', reason: 'AI高频揣测词', category: 'style', replacement: '可能、约莫' },
  { word: '可能', level: 'optional', reason: 'AI高频揣测词', category: 'style', replacement: '说不定、兴许' },
  { word: '说不定', level: 'optional', reason: 'AI高频揣测词', category: 'style', replacement: '兴许、也许' },
  { word: '总而言之', level: 'optional', reason: '过度规整', category: 'structure', replacement: '（删除或改写）' },
  { word: '总的来说', level: 'optional', reason: '过度规整', category: 'structure', replacement: '（删除或改写）' },
  { word: '概括来说', level: 'optional', reason: '过度规整', category: 'structure', replacement: '（删除或改写）' },
  { word: '从某种角度来说', level: 'optional', reason: '过度规整', category: 'structure', replacement: '（删除或改写）' },
  { word: '从某种意义上说', level: 'optional', reason: '过度规整', category: 'structure', replacement: '（删除或改写）' },
  { word: '某种程度上', level: 'optional', reason: '过度规整', category: 'structure', replacement: '（删除或改写）' },
  { word: '在这个时代', level: 'optional', reason: 'AI高频宏大叙述', category: 'style', replacement: '（用具体细节替代）' },
  { word: '在这个世界', level: 'optional', reason: 'AI高频宏大叙述', category: 'style', replacement: '（用具体细节替代）' },
  { word: '在这样的情况下', level: 'optional', reason: 'AI高频过渡句', category: 'structure', replacement: '（删除或改写）' },
  { word: '令人惊讶的是', level: 'optional', reason: 'AI高频评价句', category: 'style', replacement: '（通过描写传达惊讶）' },
  { word: '令人感到', level: 'optional', reason: 'AI高频评价句', category: 'style', replacement: '（直接描写感受）' },
  { word: '令所有人', level: 'optional', reason: 'AI高频夸大叙述', category: 'style', replacement: '（限定范围或删除）' },
  { word: '不由的', level: 'optional', reason: 'AI高频口语词', category: 'emotion', replacement: '忍不住、不由得' },
  { word: '不由得想起来', level: 'optional', reason: 'AI高频回忆句式', category: 'emotion', replacement: '想起了、记起了' },
  { word: '一时间', level: 'optional', reason: 'AI高频时间模糊词', category: 'adverb', replacement: '（具体描写时间长度）' },
  { word: '不得不说', level: 'optional', reason: 'AI高频强调句式', category: 'style', replacement: '（删除或改写）' },
  { word: '毫无保留', level: 'optional', reason: 'AI高频程度描写', category: 'style', replacement: '（通过行为体现）' },
  { word: '毫无顾忌', level: 'optional', reason: 'AI高频程度描写', category: 'style', replacement: '（通过行为体现）' },
]

// 合并所有词库
export const forbiddenWords: ForbiddenWord[] = [...criticalWords, ...warningWords, ...optionalWords]

export const forbiddenPatterns: ForbiddenPattern[] = [
  { pattern: '排比句堆砌', description: '三个以上结构相同的短语并列', level: 'critical', example: { bad: '他感到愤怒、悲伤、迷茫、无助。', good: '他攥紧了拳头。' } },
  { pattern: '段落结构过于工整', description: '每段长度和结构相似', level: 'warning', example: { bad: '第一段：他做了A。第二段：他做了B。第三段：他做了C。', good: '他做了A。然后——算了，B的事以后再说。C倒是等不及了。' } },
  { pattern: '每段都以人名开头', description: '连续多段以同一人名开始', level: 'warning', example: { bad: '他看着窗外。他想起了过去。他叹了口气。', good: '窗外下着雨。过去的事不想也罢。叹气有什么用？' } },
  { pattern: '总结性陈述句结尾', description: '段落末尾用总结性陈述收束', level: 'warning', example: { bad: '这一天，他学到了重要的一课：永远不要放弃希望。', good: '他攥着那张皱巴巴的纸条，攥了很久。' } },
  { pattern: '过度比喻', description: '连续使用比喻或类比', level: 'critical', example: { bad: '她的笑容如春风般温暖，如阳光般明媚，如花朵般绽放。', good: '她笑了。' } },
  { pattern: '心理描写直白', description: '直接描述情绪而非通过行为体现', level: 'warning', example: { bad: '他感到非常愤怒，内心充满了怒火。', good: '他攥紧了拳头，指甲嵌进掌心。' } },
  { pattern: '过度使用副词', description: '连续使用"-地"结构的副词', level: 'warning', example: { bad: '他缓缓地站起身，轻轻地推开门，默默地走了出去。', good: '他站起来，推开门，走了出去。' } },
  { pattern: '句式过于对称', description: '相邻句子长度和结构完全相同', level: 'warning', example: { bad: '他点了点头。他笑了笑。他挥了挥手。', good: '他点点头，笑了笑，摆摆手。' } },
  { pattern: 'AI风格结尾', description: '以总结性、升华性语句结尾', level: 'warning', example: { bad: '这一刻，他明白了人生的真谛。', good: '他把那张纸条叠好，放进口袋。' } },
  { pattern: '连续短句', description: '三个以上短句连续出现', level: 'warning', example: { bad: '他来了。他走了。他回来了。他又走了。', good: '他来了又走，走了又来，来来回回好几趟。' } },
  { pattern: '省略号堆砌', description: '连续使用省略号制造悬念', level: 'warning', example: { bad: '他转身……然后……接着……', good: '他转身，停了停，又继续走。' } },
  { pattern: '对话-动作机械绑定', description: '每句话说完必跟动作描写', level: 'critical', example: { bad: '"你好。"他点了点头。"你好。"她笑了笑。"吃饭了吗？"他问道。', good: '"你好。""你好。""吃饭了吗？"他这才抬起头。' } },
  { pattern: '感叹号滥用', description: '频繁使用感叹号表达情绪', level: 'warning', example: { bad: '他来了！所有人都震惊了！太厉害了！', good: '他来的时候，会议室安静了两秒。' } },
  { pattern: '破折号滥用', description: '过度使用破折号做补充说明', level: 'warning', example: { bad: '他——这个曾经的天才——如今——已经——', good: '这个曾经的天才，如今落魄到了谁都不认识的地步。' } },
  { pattern: '观点反复强调', description: '同一意思用多句话反复表达', level: 'warning', example: { bad: '这很重要。这意味着什么？这绝对不是小事。这关系到所有人。', good: '所有人都在等一个答案。' } },
  { pattern: '细节堆砌', description: '罗列无关紧要的环境细节', level: 'warning', example: { bad: '桌上摆着茶杯、烟灰缸、打火机、笔记本、钢笔、眼镜盒。', good: '桌上散落着几件杂物。' } },
  { pattern: '说教句式', description: '段落中出现说教或总结性人生道理', level: 'critical', example: { bad: '真正的强者，不是没有眼泪的人，而是含着眼泪奔跑的人。', good: '他擦了擦眼睛，继续往前走。' } },
  { pattern: '面部表情堆砌', description: '连续描写眉眼嘴等面部动作', level: 'warning', example: { bad: '他眉头一皱，眼睛一眯，嘴角一撇，鼻翼一扇。', good: '他的表情变了变。' } },
  { pattern: '同义词堆砌', description: '连续使用含义重复的修饰词', level: 'warning', example: { bad: '巨大的、庞大的、硕大无比的力量', good: '那股力量让人窒息。' } },
  { pattern: '感知动词泛滥', description: '频繁使用"感到""觉得""认为"等', level: 'warning', example: { bad: '他感到一阵恐惧。他觉得自己完了。他认为没有希望了。', good: '恐惧像冰水一样漫上来。完了，彻底完了。' } },
]

export function scanForbiddenWords(text: string): { word: ForbiddenWord; count: number; positions: number[] }[] {
  const results: { word: ForbiddenWord; count: number; positions: number[] }[] = []
  for (const fw of forbiddenWords) {
    const positions: number[] = []
    let idx = text.indexOf(fw.word)
    while (idx !== -1) {
      const beforeChar = idx > 0 ? text[idx - 1] : ''
      const afterChar = idx + fw.word.length < text.length ? text[idx + fw.word.length] : ''
      const beforeIsCjk = /[\u4e00-\u9fa5]/.test(beforeChar)
      const afterIsCjk = /[\u4e00-\u9fa5]/.test(afterChar)
      const beforeIsPunctOrSpace = /[，。！？、；：""''（）\s\n\r,.\-—…]/.test(beforeChar) || idx === 0
      const afterIsPunctOrSpace = /[，。！？、；：""''（）\s\n\r,.\-—…]/.test(afterChar) || idx + fw.word.length >= text.length
      let isPartOfLongerWord = false
      if (beforeIsCjk || afterIsCjk) {
        if (beforeIsCjk && afterIsCjk) {
          isPartOfLongerWord = true
        } else if (beforeIsCjk && afterIsPunctOrSpace) {
          isPartOfLongerWord = false
        } else if (beforeIsPunctOrSpace && afterIsCjk) {
          isPartOfLongerWord = false
        }
      }
      if (!isPartOfLongerWord) {
        positions.push(idx)
      }
      idx = text.indexOf(fw.word, idx + fw.word.length)
    }
    if (positions.length > 0) {
      results.push({ word: fw, count: positions.length, positions })
    }
  }
  return results
}

// 获取分层扫描结果
export function scanWordsByLevel(text: string): {
  critical: { word: ForbiddenWord; count: number }[]
  warning: { word: ForbiddenWord; count: number }[]
  optional: { word: ForbiddenWord; count: number }[]
} {
  const results = scanForbiddenWords(text)
  return {
    critical: results.filter(r => r.word.level === 'critical').map(r => ({ word: r.word, count: r.count })),
    warning: results.filter(r => r.word.level === 'warning').map(r => ({ word: r.word, count: r.count })),
    optional: results.filter(r => r.word.level === 'optional').map(r => ({ word: r.word, count: r.count })),
  }
}

export function scanForbiddenPatterns(text: string): { pattern: ForbiddenPattern; matches: string[]; severity: number }[] {
  const results: { pattern: ForbiddenPattern; matches: string[]; severity: number }[] = []
  const paragraphs = text.split(/\n+/).filter(p => p.trim().length > 0)

  // 1. 每段都以人名开头
  if (paragraphs.length >= 3) {
    const startsWithSameName = paragraphs.slice(0, 5).filter(p => /^[\u4e00-\u9fa5]{1,3}[看着想坐站走说叹]/.test(p.trim()))
    if (startsWithSameName.length >= 3) {
      const pattern = forbiddenPatterns.find(p => p.pattern === '每段都以人名开头')!
      results.push({ pattern, matches: startsWithSameName, severity: 1 })
    }
  }

  // 2. 排比句堆砌
  const parallelPattern = /[^，。！？、]+[、][^，。！？、]+[、][^，。！？、]+[、]/
  const parallelMatches = text.match(new RegExp(parallelPattern.source, 'g'))
  if (parallelMatches && parallelMatches.length > 0) {
    const pattern = forbiddenPatterns.find(p => p.pattern === '排比句堆砌')!
    results.push({ pattern, matches: parallelMatches, severity: 2 })
  }

  // 3. 总结性陈述句结尾
  const summaryPattern = /[这一他她][天战次，].*[：:].*[永远不要重要必须]/
  const summaryMatches = text.match(new RegExp(summaryPattern.source, 'g'))
  if (summaryMatches && summaryMatches.length > 0) {
    const pattern = forbiddenPatterns.find(p => p.pattern === '总结性陈述句结尾')!
    results.push({ pattern, matches: summaryMatches, severity: 1 })
  }

  // 4. 过度比喻
  const similePattern = /[宛如仿佛犹如].*[般似的]/g
  const simileMatches = text.match(similePattern)
  if (simileMatches && simileMatches.length >= 2) {
    const pattern = forbiddenPatterns.find(p => p.pattern === '过度比喻')!
    results.push({ pattern, matches: simileMatches, severity: 2 })
  }

  // 5. 心理描写直白
  const emotionPattern = /[他她][感到觉得].*[愤怒悲伤快乐恐惧]/g
  const emotionMatches = text.match(emotionPattern)
  if (emotionMatches && emotionMatches.length > 0) {
    const pattern = forbiddenPatterns.find(p => p.pattern === '心理描写直白')!
    results.push({ pattern, matches: emotionMatches, severity: 1 })
  }

  // 6. 过度使用副词
  const adverbPattern = /[\u4e00-\u9fa5]+地[\u4e00-\u9fa5]+[，,]?/g
  const adverbMatches = text.match(adverbPattern)
  if (adverbMatches && adverbMatches.length >= 3) {
    const pattern = forbiddenPatterns.find(p => p.pattern === '过度使用副词')!
    results.push({ pattern, matches: adverbMatches, severity: 1 })
  }

  // 7. 句式过于对称
  const sentences = text.split(/[。！？]/).filter(s => s.trim().length > 0)
  if (sentences.length >= 4) {
    const sentenceLengths = sentences.slice(0, 6).map(s => s.replace(/\s/g, '').length)
    const uniqueLengths = new Set(sentenceLengths)
    if (uniqueLengths.size <= 2 && sentenceLengths.length >= 4) {
      const pattern = forbiddenPatterns.find(p => p.pattern === '句式过于对称')!
      results.push({ pattern, matches: sentences.slice(0, 4), severity: 1 })
    }
  }

  // 8. AI风格结尾
  const aiEndingPattern = /[，,]这一刻[，,]?[他她].*[真谛|意义|道理|领悟|明白]/
  const aiEndingMatches = text.match(aiEndingPattern)
  if (aiEndingMatches && aiEndingMatches.length > 0) {
    const pattern = forbiddenPatterns.find(p => p.pattern === 'AI风格结尾')!
    results.push({ pattern, matches: aiEndingMatches, severity: 1 })
  }

  // 9. 连续短句
  const shortSentencePattern = /[他她][来了走了说跑跳坐站][。][他她][来了走了说跑跳坐站][。][他她][来了走了说跑跳坐站][。]/g
  const shortMatches = text.match(shortSentencePattern)
  if (shortMatches && shortMatches.length > 0) {
    const pattern = forbiddenPatterns.find(p => p.pattern === '连续短句')!
    results.push({ pattern, matches: shortMatches, severity: 1 })
  }

  return results
}

export function getAntiAiPrompt(): string {
  const criticalWordsList = forbiddenWords.filter(w => w.level === 'critical').map(w => w.word)
  const warningWordsList = forbiddenWords.filter(w => w.level === 'warning').map(w => w.word)
  const optionalWordsList = forbiddenWords.filter(w => w.level === 'optional').map(w => w.word)
  const lines: string[] = []
  lines.push('【L1 必换词（命中即替换）】')
  lines.push(criticalWordsList.join('、'))
  lines.push('【L2 建议换词】')
  lines.push(warningWordsList.join('、'))
  lines.push('【L3 可选优化词（提升质量）】')
  lines.push(optionalWordsList.join('、'))
  lines.push('【禁止模式】')
  for (const p of forbiddenPatterns) {
    lines.push(`- ${p.pattern}：${p.description}`)
    lines.push(`  反例：${p.example.bad}`)
    lines.push(`  正例：${p.example.good}`)
  }
  return lines.join('\n')
}

// 获取分层禁用词列表
export function getForbiddenWordsByLevel(level: 'critical' | 'warning' | 'optional'): ForbiddenWord[] {
  return forbiddenWords.filter(w => w.level === level)
}
