import { ErrorCategory } from './types';

export const ProjectErrors = {
  NOT_FOUND: { code: 'PROJECT_001', category: ErrorCategory.NOT_FOUND },
  CREATE_FAILED: { code: 'PROJECT_002', category: ErrorCategory.DATABASE },
  UPDATE_FAILED: { code: 'PROJECT_003', category: ErrorCategory.DATABASE },
  DELETE_FAILED: { code: 'PROJECT_004', category: ErrorCategory.DATABASE },
} as const;

export const ChapterErrors = {
  NOT_FOUND: { code: 'CHAPTER_001', category: ErrorCategory.NOT_FOUND },
  GENERATION_FAILED: { code: 'CHAPTER_002', category: ErrorCategory.PIPELINE },
  VALIDATION_FAILED: { code: 'CHAPTER_003', category: ErrorCategory.VALIDATION },
  WORD_COUNT_EXCEEDED: { code: 'CHAPTER_004', category: ErrorCategory.VALIDATION },
} as const;

export const AIErrors = {
  PROVIDER_UNAVAILABLE: { code: 'AI_001', category: ErrorCategory.AI_PROVIDER },
  API_KEY_INVALID: { code: 'AI_002', category: ErrorCategory.AI_PROVIDER },
  RATE_LIMIT_EXCEEDED: { code: 'AI_003', category: ErrorCategory.AI_PROVIDER },
  QUOTA_EXCEEDED: { code: 'AI_004', category: ErrorCategory.AI_PROVIDER },
  GENERATION_TIMEOUT: { code: 'AI_005', category: ErrorCategory.AI_PROVIDER },
} as const;

export const DatabaseErrors = {
  CONNECTION_FAILED: { code: 'DB_001', category: ErrorCategory.DATABASE },
  QUERY_FAILED: { code: 'DB_002', category: ErrorCategory.DATABASE },
  TRANSACTION_FAILED: { code: 'DB_003', category: ErrorCategory.DATABASE },
} as const;

export const ValidationErrors = {
  INVALID_INPUT: { code: 'VALIDATION_001', category: ErrorCategory.VALIDATION },
  MISSING_REQUIRED: { code: 'VALIDATION_002', category: ErrorCategory.VALIDATION },
  INVALID_FORMAT: { code: 'VALIDATION_003', category: ErrorCategory.VALIDATION },
} as const;

export const AllErrors = {
  ...ProjectErrors,
  ...ChapterErrors,
  ...AIErrors,
  ...DatabaseErrors,
  ...ValidationErrors,
} as const;
