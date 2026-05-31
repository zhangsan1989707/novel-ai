import { AppError, ErrorCategory, RawError } from './types';
import { ErrorMessages } from './messages';
import { AllErrors } from './codes';

export class ErrorHandler {
  static normalize(error: RawError): AppError {
    if ('code' in error && 'category' in error) {
      return error as unknown as AppError;
    }

    const category = this.categorize(error);
    const { code, message, suggestions } = this.getErrorInfo(error, category);

    return {
      code,
      category,
      message,
      details: this.extractDetails(error),
      suggestions
    };
  }

  private static categorize(error: RawError): ErrorCategory {
    const message = error.message?.toLowerCase() || '';
    const code = error.code?.toString() || '';

    if (code.includes('P2001')) return ErrorCategory.NOT_FOUND;
    if (code.includes('P2002')) return ErrorCategory.VALIDATION;
    if (code.includes('P2025')) return ErrorCategory.NOT_FOUND;

    if (message.includes('database') && message.includes('connection')) {
      return ErrorCategory.DATABASE;
    }

    if (message.includes('unauthorized') || message.includes('401')) {
      return ErrorCategory.AUTHENTICATION;
    }

    if (message.includes('api key')) {
      return ErrorCategory.AI_PROVIDER;
    }
    if (message.includes('rate limit') || message.includes('429')) {
      return ErrorCategory.AI_PROVIDER;
    }
    if (message.includes('quota') || message.includes('limit')) {
      return ErrorCategory.AI_PROVIDER;
    }

    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorCategory.VALIDATION;
    }

    return ErrorCategory.INTERNAL;
  }

  private static getErrorInfo(
    error: RawError,
    category: ErrorCategory
  ): { code: string; message: string; suggestions?: string[] } {
    const errorCode = error.code?.toString() || '';

    const matchedCode = Object.keys(AllErrors).find(
      key => errorCode.includes(key) || error.message?.toLowerCase().includes(key.toLowerCase())
    );

    if (matchedCode && ErrorMessages[matchedCode]) {
      const info = ErrorMessages[matchedCode];
      return {
        code: (AllErrors as any)[matchedCode]?.code || matchedCode,
        message: info.message,
        suggestions: info.suggestions
      };
    }

    const genericInfo = ErrorMessages[category] || ErrorMessages[ErrorCategory.INTERNAL];
    return {
      code: `${category}_UNKNOWN`,
      message: genericInfo.message,
      suggestions: genericInfo.suggestions
    };
  }

  private static extractDetails(error: RawError): Record<string, unknown> {
    const details: Record<string, unknown> = {};

    if (error.stack) {
      if (process.env.NODE_ENV === 'development') {
        details.stack = error.stack;
      }
    }

    if (error.code) {
      details.originalCode = error.code;
    }

    return details;
  }

  static toResponse(error: RawError): {
    success: false;
    error: AppError;
  } {
    const normalizedError = this.normalize(error);
    return {
      success: false,
      error: normalizedError
    };
  }

  static create(
    code: string,
    overrides?: Partial<AppError>
  ): AppError {
    const baseError = ErrorMessages[code] || ErrorMessages[ErrorCategory.INTERNAL];
    const errorDef = Object.values(AllErrors as Record<string, { code: string; category: ErrorCategory }>).find(
      e => e.code === code
    );

    return {
      code,
      category: errorDef?.category || ErrorCategory.INTERNAL,
      message: overrides?.message || baseError.message,
      suggestions: overrides?.suggestions || baseError.suggestions,
      details: overrides?.details,
      ...overrides
    };
  }
}
