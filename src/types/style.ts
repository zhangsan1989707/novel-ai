export type StyleSourceType = 'PUBLIC_DOMAIN' | 'LICENSED' | 'USER_UPLOADED' | 'ABSTRACT_TEMPLATE'
export type StyleRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type StyleSafetyMode = 'SAFE_ABSTRACT' | 'STRICT_PUBLIC_DOMAIN' | 'USER_LICENSED'

export interface StyleProse {
  overallTone: string
  sentenceLength: 'short' | 'medium' | 'long' | 'mixed'
  rhythm: string
  descriptionDensity: number
  dialogueDensity: number
  innerMonologueDensity: number
}

export interface StyleVocabulary {
  commonWords: string[]
  forbiddenWords: string[]
  idiomLevel: 'low' | 'medium' | 'high'
  modernity: 'classical' | 'modern' | 'webnovel'
}

export interface StyleSentence {
  commonPatterns: string[]
  paragraphPattern: string
  transitionStyle: string
}

export interface StyleRhetoric {
  devices: string[]
  metaphorStyle: string
  ironyLevel: number
  sensoryDetail: string
}

export interface StyleNarrative {
  pov: 'first' | 'third_limited' | 'third_omniscient' | 'mixed'
  narratorPresence: number
  expositionStyle: string
  suspenseMethod: string
}

export interface StylePlot {
  pacing: string
  conflictDensity: number
  reversalFrequency: number
  cliffhangerStyle: string
  payoffPattern: string
}

export interface StyleCharacter {
  protagonistPattern: string
  dialogueStyle: string
  emotionalExpression: string
  relationshipPattern: string
}

export interface StyleGenerationGuide {
  mustDo: string[]
  avoid: string[]
  sampleInstruction: string
}

export interface StyleProfileData {
  id: string
  name: string
  description?: string | null
  sourceType: StyleSourceType
  riskLevel: StyleRiskLevel
  authorLabel?: string | null
  displayLabel: string
  tags: string[]
  isPublic: boolean
  prose: StyleProse
  vocabulary: StyleVocabulary
  sentence: StyleSentence
  rhetoric: StyleRhetoric
  narrative: StyleNarrative
  plot: StylePlot
  character: StyleCharacter
  generationGuide: StyleGenerationGuide
  promptCard?: string | null
  sampleStats?: StyleSampleStats | null
  sourceNovelId?: string | null
  virtualWriterId?: number | null
  createdAt: string
  updatedAt: string
}

export interface StyleProfilePromptCard {
  displayLabel: string
  prose: string
  vocabulary: string
  sentence: string
  rhetoric: string
  narrative: string
  plot: string
  character: string
  mustDo: string[]
  avoid: string[]
  riskLevel: StyleRiskLevel
  safetyMode: StyleSafetyMode
}

export interface StyleSampleStats {
  totalWords: number
  chapterCount: number
  validParagraphCount: number
  dialogueRatio: number
  avgSentenceLength: number
  sampleExcerpt: string
}

export interface StyleExtractInput {
  projectId: number
  volumeNumber?: number
  sampleSize?: number
  styleProfileName?: string
  authorLabel?: string | null
  displayLabel?: string
  sourceType?: StyleSourceType
}

export interface StyleExtractResult {
  styleProfileId: string
  profileData: StyleProfileData
  sampleStats: StyleSampleStats
}

export interface StyleValidationResult {
  styleConsistencyScore: number
  riskLevel: StyleRiskLevel
  riskNotes: string[]
  proseMatch: number
  sentenceMatch: number
  vocabularyMatch: number
  narrativeMatch: number
  plotMatch: number
  similarityAlerts: string[]
}

export interface StyleListItem {
  id: string
  name: string
  displayLabel: string
  sourceType: StyleSourceType
  riskLevel: StyleRiskLevel
  tags: string[]
  isPublic: boolean
  authorLabel?: string | null
  createdAt: string
}