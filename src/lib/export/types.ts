// ============================================
// 导出格式类型定义
// ============================================

export enum ExportFormat {
  TXT = 'txt',
  MD = 'md',
  DOCX = 'docx',
  JSON = 'json',
}

export interface ExportOptions {
  format: ExportFormat
  includeMetadata: boolean       // 包含标题、作者等信息
  includeChapterTitles: boolean // 包含章节标题
  compress: boolean             // 压缩成 zip
}

export interface ExportResult {
  success: boolean
  fileName: string
  filePath?: string
  downloadUrl?: string
  content?: string
  contentType?: string
  isBase64?: boolean
  error?: string
}

// 导出元数据
export interface NovelMetadata {
  title: string
  author?: string
  genre?: string
  description?: string
  wordCount: number
  chapterCount: number
  createdAt: string
  updatedAt: string
  reusableContext?: ExportReusableContext
}

// 导出章节结构
export interface ExportedChapter {
  number: number
  title: string
  content: string
  wordCount: number
}

// 完整导出结构
export interface ExportedNovel {
  metadata: NovelMetadata
  chapters: ExportedChapter[]
}

export interface ExportedBlueprint {
  corePitch: string
  worldDirection?: string | null
  mainlineDirection?: string | null
  growthDirection?: string | null
  endingDirection?: string | null
  platformStrategy?: string | null
  genreStrategy?: string | null
  styleStrategy?: string | null
  popularFictionProfile?: Record<string, unknown> | null
  constraints: string[]
  createdAt?: string
  updatedAt?: string
}

export interface ExportedArcPlan {
  arcNumber: number
  name: string
  stage: string
  description?: string | null
  batchSize: number
  startChapter: number
  endChapter?: number | null
  goals: string[]
  keyEvents: string[]
  isCompleted: boolean
  createdAt?: string
  updatedAt?: string
}

export interface ExportedStoryState {
  currentChapter: number
  totalPlanned: number
  mainConflict?: string | null
  emotionalArc: unknown[]
  subConflicts: unknown[]
  metadata?: Record<string, unknown> | null
  createdAt?: string
  updatedAt?: string
}

export interface ExportReusableContext {
  exportedAt: string
  blueprint?: ExportedBlueprint
  arcPlans: ExportedArcPlan[]
  storyState?: ExportedStoryState
}

// ============================================
// 模板系统类型
// ============================================

export enum TemplateCategory {
  GENRE = 'genre',         // 按类型
  STYLE = 'style',         // 按风格
  STRUCTURE = 'structure'  // 按结构
}

export interface WritingTemplate {
  id: string
  name: string
  category: TemplateCategory
  description: string
  // 项目预设值
  defaultGenre?: string
  defaultWritingStyle?: string
  defaultTargetWordCount?: number
  defaultChapterWordCount?: number
  // 大纲模板
  outlineTemplate?: string
  // 设定模板
  worldSettingTemplate?: string
  powerSystemTemplate?: string
  protagonistProfileTemplate?: string
  antagonistSettingTemplate?: string
  // 示例章节
  sampleChapterContent?: string
  // 标签
  tags: string[]
  isBuiltIn: boolean
  creatorId?: number
}

// 模板预览
export interface TemplatePreview {
  id: string
  name: string
  category: TemplateCategory
  description: string
  tags: string[]
  usageCount: number
}

// ============================================
// 创作数据复用库类型
// ============================================

export interface CharacterTemplate {
  id: string
  name: string
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor'
  description: string
  aliases?: string[]
  appearance?: string
  personality?: string
  catchphrases?: string[]
  background?: string
  isPublic: boolean
  creatorId: number
  usageCount: number
  tags: string[]
}

export interface WorldSettingTemplate {
  id: string
  name: string
  description: string
  content: string
  category: string
  isPublic: boolean
  creatorId: number
  usageCount: number
  tags: string[]
}

export interface PlotlineTemplate {
  id: string
  name: string
  description: string
  template: string
  isPublic: boolean
  creatorId: number
  usageCount: number
  tags: string[]
}

// 复用库统计
export interface ReusableLibraryStats {
  characterCount: number
  worldSettingCount: number
  plotlineCount: number
  myUploads: number
  publicLibrary: number
}
