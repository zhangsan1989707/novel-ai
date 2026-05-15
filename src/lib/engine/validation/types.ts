// ============================================
// 质量校验报告类型
// ============================================

export enum ValidationIssueType {
  CHARACTER_NAME_INCONSISTENCY = 'CHARACTER_NAME_INCONSISTENCY',  // 角色名不一致
  TIMELINE_LOGIC_ERROR = 'TIMELINE_LOGIC_ERROR',                  // 时间线逻辑错误
  FORESHADOW_NOT_RESOLVED = 'FORESHADOW_NOT_RESOLVED',            // 伏笔未回收
  PLOTLINE_CONTRADICTION = 'PLOTLINE_CONTRADICTION',              // 剧情线矛盾
  DUPLICATE_EVENT = 'DUPLICATE_EVENT',                            // 重复事件
  CHARACTER_DISAPPEARED = 'CHARACTER_DISAPPEARED',                // 角色消失
}

export enum ValidationSeverity {
  ERROR = 'error',     // 必须修复
  WARNING = 'warning', // 建议修复
  INFO = 'info',       // 提示
}

export interface ValidationIssue {
  type: ValidationIssueType
  severity: ValidationSeverity
  message: string
  location?: {
    chapterNumber?: number
    paragraphIndex?: number
    characterName?: string
  }
  suggestion?: string
}

export interface CharacterValidation {
  name: string
  aliases: string[]
  firstAppearChapter: number
  lastAppearChapter: number
  totalMentions: number
  isConsistent: boolean
}

export interface TimelineValidation {
  events: {
    chapter: number
    description: string
    timestamp?: string
    isLogical: boolean
    issues: string[]
  }[]
  inconsistencies: string[]
}

export interface ForeshadowingValidation {
  planted: number
  resolved: number
  pending: { setup: string; plantedAt: number; plannedPayoff?: number }[]
  resolvedOnTime: { setup: string; plantedAt: number; resolvedAt: number }[]
  resolvedLate: { setup: string; plantedAt: number; resolvedAt: number; delay: number }[]
  neverResolved: { setup: string; plantedAt: number }[]
}

export interface ValidationReport {
  isPass: boolean
  score: number  // 0-100
  chapterNumber: number
  summary: string
  issues: ValidationIssue[]
  characterValidation: CharacterValidation[]
  timelineValidation: TimelineValidation
  foreshadowingValidation: ForeshadowingValidation
  checkedAt: string
}

export interface ProjectValidationResult {
  projectId: number
  isPass: boolean
  overallScore: number  // 0-100
  totalChaptersChecked: number
  totalIssues: number
  issuesByChapter: Record<number, ValidationIssue[]>
  characterSummary: {
    totalCharacters: number
    consistentCharacters: number
    inconsistentCharacters: string[]
  }
  foreshadowingSummary: {
    totalPlanted: number
    resolved: number
    unresolved: number
    resolutionRate: number  // percentage
  }
  recommendations: string[]
}