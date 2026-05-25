export interface Villain {
  name: string
  tier: 'stage' | 'arc' | 'final'
  isFinalBoss: boolean
  introducedAt?: number
  defeatedAt?: number
  lifecycle: 'active' | 'defeated' | 'escaped' | 'transformed'
}

export function classifyVillain(villain: Villain, progressRatio: number): 'stage' | 'arc' | 'final' {
  if (villain.isFinalBoss) return 'final'
  if (progressRatio >= 0.7) return villain.tier
  return 'stage'
}

export function shouldIntroduceFinalBoss(progressRatio: number): boolean {
  return progressRatio >= 0.7
}

export function getVillainPrompt(villains: Villain[], currentChapter: number, progressRatio: number): string {
  const activeVillains = villains.filter(v => v.lifecycle === 'active')
  const escapedVillains = villains.filter(v => v.lifecycle === 'escaped')
  const stageBosses = activeVillains.filter(v => v.tier === 'stage')

  const parts: string[] = []

  if (stageBosses.length > 0) {
    parts.push(`当前活跃的阶段Boss：${stageBosses.map(v => v.name).join('、')}`)
  }
  if (escapedVillains.length > 0) {
    parts.push(`已逃脱的反派（可复用）：${escapedVillains.map(v => v.name).join('、')}`)
  }
  if (!shouldIntroduceFinalBoss(progressRatio)) {
    parts.push(`注意：当前进度${Math.round(progressRatio * 100)}%，终极Boss暂不出场。当前Boss只是阶段Boss，击败后世界还有更大的敌人。`)
  }

  return parts.join('\n')
}