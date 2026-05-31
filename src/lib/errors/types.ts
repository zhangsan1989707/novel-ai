export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTH',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  DATABASE = 'DATABASE',
  AI_PROVIDER = 'AI_PROVIDER',
  PIPELINE = 'PIPELINE',
  INTERNAL = 'INTERNAL'
}

export type ErrorCode = `${ErrorCategory}_${string}` | string;

export interface AppError {
  code: string;
  category: ErrorCategory;
  message: string;
  details?: Record<string, unknown>;
  suggestions?: string[];
}

export interface RawError {
  code?: string;
  message: string;
  stack?: string;
  [key: string]: unknown;
}
