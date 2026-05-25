import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  success,
  successWithMessage,
  error,
  paginatedSuccess,
  operationResult,
} from '@/lib/api-response'

describe('API Response Utilities', () => {
  describe('success', () => {
    it('should create success response with data', () => {
      const data = { id: 1, name: 'test' }
      const response = success(data)

      expect(response.success).toBe(true)
      expect(response.data).toEqual(data)
      expect(response.timestamp).toBeDefined()
      expect(typeof response.timestamp).toBe('string')
    })

    it('should include ISO timestamp', () => {
      const response = success({})
      const timestamp = new Date(response.timestamp)
      expect(timestamp instanceof Date).toBe(true)
      expect(timestamp.toISOString()).toBe(response.timestamp)
    })

    it('should handle empty data', () => {
      const response = success(null)
      expect(response.success).toBe(true)
      expect(response.data).toBeNull()
    })

    it('should handle array data', () => {
      const data = [1, 2, 3]
      const response = success(data)
      expect(response.data).toEqual([1, 2, 3])
    })
  })

  describe('successWithMessage', () => {
    it('should create success response with message', () => {
      const data = { id: 1 }
      const message = 'Operation completed'
      const response = successWithMessage(data, message)

      expect(response.success).toBe(true)
      expect(response.data).toEqual(data)
      expect(response.message).toBe(message)
      expect(response.timestamp).toBeDefined()
    })

    it('should include message field in addition to standard fields', () => {
      const response = successWithMessage({}, 'test')
      expect('message' in response).toBe(true)
    })
  })

  describe('error', () => {
    it('should create error response with code and message', () => {
      const response = error('NOT_FOUND', 'Resource not found')

      expect(response.success).toBe(false)
      expect(response.error.code).toBe('NOT_FOUND')
      expect(response.error.message).toBe('Resource not found')
      expect(response.timestamp).toBeDefined()
    })

    it('should include optional details', () => {
      const details = { field: 'email', reason: 'invalid format' }
      const response = error('VALIDATION_ERROR', 'Invalid input', details)

      expect(response.error.details).toEqual(details)
    })

    it('should handle error without details', () => {
      const response = error('UNKNOWN', 'Something went wrong')
      expect(response.error.details).toBeUndefined()
    })
  })

  describe('paginatedSuccess', () => {
    it('should create paginated response', () => {
      const data = [{ id: 1 }, { id: 2 }]
      const pagination = {
        page: 1,
        pageSize: 10,
        total: 100,
        totalPages: 10,
      }
      const response = paginatedSuccess(data, pagination)

      expect(response.success).toBe(true)
      expect(response.data).toEqual(data)
      expect(response.pagination).toEqual(pagination)
      expect(response.timestamp).toBeDefined()
    })

    it('should handle empty data', () => {
      const response = paginatedSuccess([], {
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 0,
      })

      expect(response.data).toEqual([])
      expect(response.pagination.total).toBe(0)
    })

    it('should calculate totalPages correctly', () => {
      const response = paginatedSuccess([1], {
        page: 1,
        pageSize: 10,
        total: 25,
        totalPages: 3,
      })

      expect(response.pagination.totalPages).toBe(3)
    })
  })

  describe('operationResult', () => {
    it('should create success operation result', () => {
      const response = operationResult(true, 'Chapter created successfully')

      expect(response.success).toBe(true)
      expect(response.data.success).toBe(true)
      expect(response.data.message).toBe('Chapter created successfully')
      expect(response.timestamp).toBeDefined()
    })

    it('should create failure operation result', () => {
      const response = operationResult(false, 'Failed to delete chapter')

      expect(response.success).toBe(true)
      expect(response.data.success).toBe(false)
      expect(response.data.message).toBe('Failed to delete chapter')
    })

    it('should include optional details', () => {
      const response = operationResult(true, 'Project updated', {
        chapterId: 123,
        affectedRows: 1,
      })

      expect((response.data as { chapterId?: number }).chapterId).toBe(123)
      expect((response.data as { affectedRows?: number }).affectedRows).toBe(1)
    })
  })
})
