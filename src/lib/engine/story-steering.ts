import { StorySteering, DEFAULT_STORY_STEERING, STEERING_ACTIONS, SteeringAction } from '@/types'

export function applySteering(basePrompt: string, steering: StorySteering): string {
  const adjustments: string[] = []

  if (steering.pace > 0.6) adjustments.push('节奏加快，减少过渡和铺垫，快速推进剧情')
  if (steering.pace < 0.3) adjustments.push('节奏放缓，增加细节描写和环境烘托')
  if (steering.darkness > 0.6) adjustments.push('增加黑暗氛围，描写残酷现实和人性阴暗面')
  if (steering.darkness < 0.3) adjustments.push('保持明亮基调，减少负面描写')
  if (steering.humor > 0.6) adjustments.push('增加幽默元素和轻松桥段')
  if (steering.romance > 0.6) adjustments.push('增加感情线描写和恋爱互动')
  if (steering.powerGrowth > 0.7) adjustments.push('加快主角实力提升速度，减少瓶颈期')
  if (steering.powerGrowth < 0.3) adjustments.push('控制实力提升节奏，强化成长过程')
  if (steering.conflictIntensity > 0.7) adjustments.push('增加冲突强度和打脸桥段频次')
  if (steering.mysteryDensity > 0.6) adjustments.push('增加悬念和伏笔密度')

  if (adjustments.length === 0) return basePrompt

  return `${basePrompt}\n\n【风格调节指令】\n${adjustments.map(a => `- ${a}`).join('\n')}`
}

export function parseSteeringAction(actionLabel: string): ((steering: StorySteering) => StorySteering) | null {
  const action: SteeringAction | undefined = STEERING_ACTIONS.find(a => a.label === actionLabel)
  return action ? action.apply : null
}

export function getSteeringSummary(steering: StorySteering): string {
  const parts: string[] = []
  if (steering.pace > 0.6) parts.push('快节奏')
  if (steering.pace < 0.3) parts.push('慢节奏')
  if (steering.darkness > 0.6) parts.push('黑暗')
  if (steering.humor > 0.6) parts.push('幽默')
  if (steering.romance > 0.6) parts.push('感情丰富')
  if (steering.powerGrowth > 0.7) parts.push('极速成长')
  if (steering.conflictIntensity > 0.7) parts.push('高冲突')
  if (steering.mysteryDensity > 0.6) parts.push('悬念密布')
  if (parts.length === 0) parts.push('默认')
  return parts.join(' · ')
}