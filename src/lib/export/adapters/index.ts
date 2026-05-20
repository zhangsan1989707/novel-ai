import { ExportFormat } from '../types'

export const PLATFORM_CONFIGS = {
  qidian: {
    name: '起点中文网',
    formats: [ExportFormat.TXT],
    chapterPrefix: '',
    chapterTitleFormat: '第{chapterNo}章 {title}',
    maxChapterSize: 50000,
    requiresVolumeGrouping: true,
  },
  fanqie: {
    name: '番茄小说',
    formats: [ExportFormat.TXT, ExportFormat.DOCX],
    chapterPrefix: '',
    chapterTitleFormat: '第{chapterNo}章 {title}',
    maxChapterSize: 30000,
    requiresVolumeGrouping: false,
  },
  feilu: {
    name: '飞卢小说',
    formats: [ExportFormat.TXT],
    chapterPrefix: '',
    chapterTitleFormat: '{chapterNo}、{title}',
    maxChapterSize: 20000,
    requiresVolumeGrouping: false,
  },
  jinjiang: {
    name: '晋江文学城',
    formats: [ExportFormat.TXT],
    chapterPrefix: '',
    chapterTitleFormat: '第{chapterNo}章 {title}',
    maxChapterSize: 50000,
    requiresVolumeGrouping: false,
  },
  qimao: {
    name: '七猫小说',
    formats: [ExportFormat.TXT],
    chapterPrefix: '',
    chapterTitleFormat: '第{chapterNo}章 {title}',
    maxChapterSize: 40000,
    requiresVolumeGrouping: false,
  },
  epub: {
    name: 'EPUB电子书',
    formats: ['epub' as ExportFormat],
    chapterPrefix: '',
    chapterTitleFormat: '第{chapterNo}章 {title}',
    maxChapterSize: Infinity,
    requiresVolumeGrouping: false,
  },
  generic: {
    name: '通用格式',
    formats: [ExportFormat.TXT, ExportFormat.MD, ExportFormat.JSON],
    chapterPrefix: '',
    chapterTitleFormat: '第{chapterNo}章 {title}',
    maxChapterSize: Infinity,
    requiresVolumeGrouping: false,
  },
} as const

export type PlatformKey = keyof typeof PLATFORM_CONFIGS

export interface PlatformConfig {
  name: string
  formats: readonly ExportFormat[]
  chapterPrefix: string
  chapterTitleFormat: string
  maxChapterSize: number
  requiresVolumeGrouping: boolean
}

export function getPlatformConfig(platform: PlatformKey): PlatformConfig {
  return PLATFORM_CONFIGS[platform] || PLATFORM_CONFIGS.generic
}

export function formatChapterTitle(
  chapterNo: number,
  title: string,
  platform: PlatformKey
): string {
  const config = getPlatformConfig(platform)
  return config.chapterTitleFormat
    .replace('{chapterNo}', String(chapterNo))
    .replace('{title}', title)
}