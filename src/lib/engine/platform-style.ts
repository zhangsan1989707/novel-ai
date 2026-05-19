import { Platform, PlatformTemplate } from '@/types'

const platformTemplates: Record<Platform, PlatformTemplate> = {
  qidian: {
    platform: 'qidian',
    pace: 'medium',
    cliffhangerDensity: 'high',
    slapFaceDensity: 'medium',
    foreshadowDensity: 'high',
    growthDensity: 'high',
    chapterWordTarget: 3000,
    batchSizeBaseline: 20,
  },
  fanqie: {
    platform: 'fanqie',
    pace: 'fast',
    cliffhangerDensity: 'very_high',
    slapFaceDensity: 'very_high',
    foreshadowDensity: 'medium',
    growthDensity: 'high',
    chapterWordTarget: 2000,
    batchSizeBaseline: 15,
  },
  feilu: {
    platform: 'feilu',
    pace: 'ultra_fast',
    cliffhangerDensity: 'very_high',
    slapFaceDensity: 'very_high',
    foreshadowDensity: 'low',
    growthDensity: 'very_high',
    chapterWordTarget: 1500,
    batchSizeBaseline: 10,
  },
  jinjiang: {
    platform: 'jinjiang',
    pace: 'medium',
    cliffhangerDensity: 'high',
    slapFaceDensity: 'low',
    foreshadowDensity: 'high',
    growthDensity: 'medium',
    chapterWordTarget: 3500,
    batchSizeBaseline: 20,
  },
  qimao: {
    platform: 'qimao',
    pace: 'fast',
    cliffhangerDensity: 'high',
    slapFaceDensity: 'high',
    foreshadowDensity: 'medium',
    growthDensity: 'high',
    chapterWordTarget: 2500,
    batchSizeBaseline: 15,
  },
}

export function getPlatformTemplate(platform: Platform): PlatformTemplate {
  return platformTemplates[platform] || platformTemplates.qidian
}

export function getStylePrompt(platform: Platform, genre: string, style: string): string {
  const template = getPlatformTemplate(platform)
  return `平台要求：${platform}平台
节奏：${template.pace}
每章字数目标：${template.chapterWordTarget}字
爽点密度：${template.slapFaceDensity}
钩子密度：${template.cliffhangerDensity}
伏笔密度：${template.foreshadowDensity}
成长密度：${template.growthDensity}
题材：${genre}
风格：${style}`
}