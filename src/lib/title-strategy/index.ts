export type {
  TitleStrategyInput,
  TitleCandidate,
  TitleScoreBreakdown,
  ScoredTitleCandidate,
  TitleFactoryResult,
} from './types'

export { scoreTitle, totalScore, rankCandidates } from './scorer'
export { buildTitleFactoryPrompt } from './prompt'
