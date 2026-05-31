export * from './types';
export * from './codes';
export * from './messages';
export * from './handler';

import { ErrorHandler } from './handler';
import { AppError, RawError } from './types';

export function createError(
  code: string,
  message?: string,
  suggestions?: string[]
): AppError {
  return ErrorHandler.create(code, { message, suggestions });
}

export function toErrorResponse(error: RawError) {
  return ErrorHandler.toResponse(error);
}
