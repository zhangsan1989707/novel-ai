export interface EmotionalArcTemplate {
  id: string
  name: string
  description: string
  phases: { name: string; emotion: number; description: string }[]
  applicableGenres: string[]
  chapterRange: { min: number; max: number }
}

export const emotionalArcTemplates: EmotionalArcTemplate[] = [
  { id: 'ea-1', name: '上升弧线', description: '从低谷到高峰，持续上升', phases: [{ name: '低谷', emotion: 20, description: '主角处于困境' }, { name: '转折', emotion: 40, description: '出现转机' }, { name: '上升', emotion: 60, description: '逐步变强' }, { name: '高潮', emotion: 90, description: '全面爆发' }], applicableGenres: ['玄幻', '都市'], chapterRange: { min: 20, max: 50 } },
  { id: 'ea-2', name: 'V型弧线', description: '先跌后升，触底反弹', phases: [{ name: '起点', emotion: 50, description: '正常状态' }, { name: '跌落', emotion: 15, description: '重大打击' }, { name: '触底', emotion: 10, description: '最低谷' }, { name: '反弹', emotion: 70, description: '触底反弹' }, { name: '巅峰', emotion: 95, description: '超越从前' }], applicableGenres: ['都市', '言情', '玄幻'], chapterRange: { min: 30, max: 80 } },
  { id: 'ea-3', name: '波浪弧线', description: '起伏交替，持续升级', phases: [{ name: '小高潮', emotion: 60, description: '第一个小胜利' }, { name: '回落', emotion: 35, description: '新的挑战' }, { name: '大高潮', emotion: 75, description: '更大的胜利' }, { name: '深落', emotion: 25, description: '重大危机' }, { name: '终极高潮', emotion: 95, description: '最终胜利' }], applicableGenres: ['玄幻', '仙侠', '科幻'], chapterRange: { min: 50, max: 200 } },
  { id: 'ea-4', name: '阶梯弧线', description: '每阶段上升一个台阶', phases: [{ name: '第一阶', emotion: 30, description: '入门' }, { name: '第二阶', emotion: 50, description: '进阶' }, { name: '第三阶', emotion: 70, description: '高手' }, { name: '第四阶', emotion: 85, description: '巅峰' }, { name: '超越', emotion: 95, description: '超越极限' }], applicableGenres: ['玄幻', '都市', '游戏'], chapterRange: { min: 100, max: 500 } },
  { id: 'ea-5', name: '悲剧弧线', description: '从高处跌落，不可挽回', phases: [{ name: '辉煌', emotion: 80, description: '处于巅峰' }, { name: '裂痕', emotion: 60, description: '隐患出现' }, { name: '崩塌', emotion: 30, description: '一切崩塌' }, { name: '深渊', emotion: 10, description: '无法挽回' }], applicableGenres: ['历史', '文艺', '悬疑'], chapterRange: { min: 20, max: 60 } },
  { id: 'ea-6', name: '甜虐弧线', description: '甜虐交替，以甜收尾', phases: [{ name: '初遇', emotion: 60, description: '甜蜜初遇' }, { name: '误会', emotion: 25, description: '虐心误会' }, { name: '和解', emotion: 70, description: '甜蜜和解' }, { name: '考验', emotion: 20, description: '重大考验' }, { name: '圆满', emotion: 90, description: '甜蜜结局' }], applicableGenres: ['言情', '都市'], chapterRange: { min: 30, max: 100 } },
]

export function getArcByGenre(genre: string): EmotionalArcTemplate[] {
  return emotionalArcTemplates.filter(a => a.applicableGenres.includes(genre))
}

export function getArcById(id: string): EmotionalArcTemplate | undefined {
  return emotionalArcTemplates.find(a => a.id === id)
}
