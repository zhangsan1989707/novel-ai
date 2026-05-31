import { describe, it, expect } from 'vitest';
import { ErrorHandler } from '../../lib/errors/handler';
import { ErrorCategory } from '../../lib/errors/types';

describe('ErrorHandler', () => {
  describe('normalize', () => {
    it('should handle database NOT_FOUND errors', () => {
      const error = {
        code: 'P2025',
        message: 'Record to delete does not exist'
      };

      const result = ErrorHandler.normalize(error);

      expect(result.category).toBe(ErrorCategory.NOT_FOUND);
      expect(result.code).toContain('NOT_FOUND');
    });

    it('should handle database constraint errors', () => {
      const error = {
        code: 'P2002',
        message: 'Unique constraint failed'
      };

      const result = ErrorHandler.normalize(error);

      expect(result.category).toBe(ErrorCategory.VALIDATION);
    });

    it('should handle AI quota errors', () => {
      const error = {
        message: 'You have exceeded your monthly quota'
      };

      const result = ErrorHandler.normalize(error);

      expect(result.category).toBe(ErrorCategory.AI_PROVIDER);
      expect(result.code).toContain('AI_');
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions!.length).toBeGreaterThan(0);
    });

    it('should handle AI rate limit errors', () => {
      const error = {
        code: '429',
        message: 'Rate limit exceeded'
      };

      const result = ErrorHandler.normalize(error);

      expect(result.category).toBe(ErrorCategory.AI_PROVIDER);
      expect(result.code).toContain('AI_');
    });

    it('should handle AI API key errors', () => {
      const error = {
        message: 'Invalid API key provided'
      };

      const result = ErrorHandler.normalize(error);

      expect(result.category).toBe(ErrorCategory.AI_PROVIDER);
      expect(result.code).toContain('AI_');
    });

    it('should handle database connection errors', () => {
      const error = {
        message: 'database connection failed'
      };

      const result = ErrorHandler.normalize(error);

      expect(result.category).toBe(ErrorCategory.DATABASE);
    });

    it('should handle authentication errors', () => {
      const error = {
        code: '401',
        message: 'unauthorized access'
      };

      const result = ErrorHandler.normalize(error);

      expect(result.category).toBe(ErrorCategory.AUTHENTICATION);
    });

    it('should handle validation errors', () => {
      const error = {
        message: 'input validation failed'
      };

      const result = ErrorHandler.normalize(error);

      expect(result.category).toBe(ErrorCategory.VALIDATION);
    });

    it('should handle unknown errors as INTERNAL', () => {
      const error = {
        message: 'Something unexpected happened'
      };

      const result = ErrorHandler.normalize(error);

      expect(result.category).toBe(ErrorCategory.INTERNAL);
    });

    it('should preserve AppError objects', () => {
      const appError = {
        code: 'CUSTOM_001',
        category: ErrorCategory.VALIDATION,
        message: 'Custom error'
      };

      const result = ErrorHandler.normalize(appError);

      expect(result).toEqual(appError);
    });

    it('should extract details in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = {
        message: 'Test error',
        stack: 'Error: Test error\n at line 1'
      };

      const result = ErrorHandler.normalize(error);

      expect(result.details).toBeDefined();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('toResponse', () => {
    it('should format error as API response', () => {
      const error = { message: 'Something went wrong' };
      const response = ErrorHandler.toResponse(error);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error.message).toBeDefined();
      expect(response.error.code).toBeDefined();
      expect(response.error.category).toBeDefined();
    });

    it('should include suggestions in response', () => {
      const error = { message: 'AI quota exceeded' };
      const response = ErrorHandler.toResponse(error);

      expect(response.error.suggestions).toBeDefined();
      expect(Array.isArray(response.error.suggestions)).toBe(true);
    });
  });

  describe('create', () => {
    it('should create error with custom message', () => {
      const error = ErrorHandler.create('AI_004', { message: '自定义配额消息' });

      expect(error.code).toBe('AI_004');
      expect(error.message).toBe('自定义配额消息');
      expect(error.category).toBe(ErrorCategory.AI_PROVIDER);
    });

    it('should create error with suggestions', () => {
      const suggestions = ['选项1', '选项2'];
      const error = ErrorHandler.create('VALIDATION_001', { suggestions });

      expect(error.suggestions).toEqual(suggestions);
    });

    it('should use default message when not provided', () => {
      const error = ErrorHandler.create('PROJECT_001');

      expect(error.message).toBe('项目不存在或已被删除');
    });

    it('should create error with details', () => {
      const error = ErrorHandler.create('DB_002', { details: { field: 'value' } });

      expect(error.details).toBeDefined();
      expect((error.details as any).field).toBe('value');
    });
  });
});
