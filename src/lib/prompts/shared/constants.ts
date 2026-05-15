/**
 * 提示词常量定义
 */

// 章节字数常量
export const CHAPTER_WORD_COUNT = {
  MIN: 2000,
  MAX: 5000,
  DEFAULT: 3000,
  TOLERANCE: 0.2, // 20% 浮动
} as const

// 章节节奏比例
export const CHAPTER_PACING = {
  SETUP: 0.2,        // 铺垫
  DEVELOPMENT: 0.5,  // 发展
  CLIMAX: 0.3,       // 高潮
} as const

// 开篇章节字数（较少，建立人设和世界观）
export const OPENING_CHAPTER_WORD_COUNT = {
  MIN: 2000,
  MAX: 2500,
} as const

// 高潮章节字数（较多，重大冲突和转折）
export const CLIMAX_CHAPTER_WORD_COUNT = {
  MIN: 3500,
  MAX: 4500,
} as const

// 摘要字数要求
export const SUMMARY_WORD_COUNT = {
  L1_CHAPTER_MIN: 200,
  L1_CHAPTER_MAX: 300,
  L2_VOLUME_MIN: 500,
  L2_VOLUME_MAX: 800,
  L3_BOOK_MIN: 1000,
  L3_BOOK_MAX: 1500,
} as const

// 章节情节类型
export const PLOT_TYPES = {
  SETUP: 'setup',           // 开篇
  DEVELOPMENT: 'develop',    // 发展
  CLIMAX: 'climax',         // 高潮
  RESOLUTION: 'resolution', // 解决
  TRANSITION: 'transition', // 过渡
} as const

// 标题风格
export const TITLE_STYLES = {
  WEBNOVEL: 'webnovel',     // 网文风格
  TRADITIONAL: 'traditional', // 传统风格
  POETRY: 'poetry',         // 诗词风格
} as const

// 去 AI 味 - 禁止使用的词汇
export const AI_WRITE_FORBIDDEN = [
  '不禁',
  '顿时',
  '瞬间',
  '宛如',
  '仿佛',
  '犹如',
  '不禁',
] as const

// 去 AI 味 - 禁止的模式
export const AI_WRITE_FORBIDDEN_PATTERNS = [
  '排比句堆砌',
  '段落结构过于工整对称',
  '每段都以人名开头',
  '用总结性陈述句结尾',
] as const

// 结局方向
export const ENDING_DIRECTIONS = {
  HAPPY: 'happy',
  TRAGIC: 'tragic',
  OPEN: 'open',
} as const

// 分析维度
export const ANALYSIS_DIMENSIONS = {
  CHARACTER_RELATION: 'CHARACTER_RELATION',
  PLOT_LINE: 'PLOT_LINE',
  FORESHADOWING: 'FORESHADOWING',
  CHAPTER_STRUCTURE: 'CHAPTER_STRUCTURE',
  WORLD_SETTING: 'WORLD_SETTING',
} as const
