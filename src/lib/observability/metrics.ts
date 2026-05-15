import { logger } from '../logger'

// ================================
// 指标类型
// ================================

export interface MetricData {
  name: string
  value: number
  tags?: Record<string, string>
  timestamp?: number
}

export interface CounterMetric extends MetricData {
  type: 'counter'
}

export interface GaugeMetric extends MetricData {
  type: 'gauge'
}

export interface HistogramMetric extends MetricData {
  type: 'histogram'
  buckets?: number[]
}

export type Metric = CounterMetric | GaugeMetric | HistogramMetric

// ================================
// 追踪 Span
// ================================

export interface Span {
  spanId: string
  parentSpanId?: string
  traceId: string
  name: string
  startTime: number
  endTime?: number
  duration?: number
  attributes: Record<string, unknown>
  events: Array<{ name: string; timestamp: number; attributes?: Record<string, unknown> }>
  status?: 'OK' | 'ERROR'
  error?: string
}

// ================================
// 指标收集器
// ================================

class MetricsCollector {
  private counters: Map<string, number> = new Map()
  private gauges: Map<string, number> = new Map()
  private histograms: Map<string, number[]> = new Map()

  // ================================
  // Counter 操作
  // ================================

  increment(name: string, value: number = 1, tags?: Record<string, string>): void {
    const key = this.getKeyWithTags(name, tags)
    const current = this.counters.get(key) || 0
    this.counters.set(key, current + value)
    logger.debug({ metric: name, value, tags }, 'Counter incremented')
  }

  decrement(name: string, value: number = 1, tags?: Record<string, string>): void {
    this.increment(name, -value, tags)
  }

  getCounter(name: string, tags?: Record<string, string>): number {
    const key = this.getKeyWithTags(name, tags)
    return this.counters.get(key) || 0
  }

  // ================================
  // Gauge 操作
  // ================================

  setGauge(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.getKeyWithTags(name, tags)
    this.gauges.set(key, value)
    logger.debug({ metric: name, value, tags }, 'Gauge set')
  }

  getGauge(name: string, tags?: Record<string, string>): number {
    const key = this.getKeyWithTags(name, tags)
    return this.gauges.get(key) || 0
  }

  // ================================
  // Histogram 操作
  // ================================

  recordHistogram(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.getKeyWithTags(name, tags)
    const values = this.histograms.get(key) || []
    values.push(value)
    this.histograms.set(key, values)
    logger.debug({ metric: name, value, tags }, 'Histogram recorded')
  }

  getHistogram(name: string, tags?: Record<string, string>): number[] {
    const key = this.getKeyWithTags(name, tags)
    return this.histograms.get(key) || []
  }

  // ================================
  // 辅助方法
  // ================================

  private getKeyWithTags(name: string, tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) {
      return name
    }
    const tagStr = Object.entries(tags)
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join(',')
    return `${name}?${tagStr}`
  }

  // ================================
  // 导出指标
  // ================================

  exportMetrics(): Metric[] {
    const metrics: Metric[] = []

    for (const [key, value] of this.counters) {
      const { name, tags } = this.parseKey(key)
      metrics.push({ type: 'counter', name, value, tags })
    }

    for (const [key, value] of this.gauges) {
      const { name, tags } = this.parseKey(key)
      metrics.push({ type: 'gauge', name, value, tags })
    }

    for (const [key, values] of this.histograms) {
      const { name, tags } = this.parseKey(key)
      metrics.push({
        type: 'histogram',
        name,
        value: values.length,
        tags,
        timestamp: Date.now()
      })
    }

    return metrics
  }

  private parseKey(key: string): { name: string; tags?: Record<string, string> } {
    const parts = key.split('?')
    if (parts.length === 1) {
      return { name: parts[0] }
    }
    const name = parts[0]
    const tagStr = parts[1]
    const tags: Record<string, string> = {}
    for (const pair of tagStr.split(',')) {
      const [k, v] = pair.split('=')
      if (k && v) {
        tags[k] = v
      }
    }
    return { name, tags }
  }

  reset(): void {
    this.counters.clear()
    this.gauges.clear()
    this.histograms.clear()
    logger.info('Metrics reset')
  }
}

// ================================
// 追踪器
// ================================

class Tracer {
  private spans: Map<string, Span> = new Map()
  private activeSpans: Stack<Span> = []

  // ================================
  // 创建 Span
  // ================================

  startSpan(
    name: string,
    options: {
      parentSpanId?: string
      attributes?: Record<string, unknown>
    } = {}
  ): Span {
    const traceId = this.getTraceId(options.parentSpanId)
    const spanId = this.generateId()

    const span: Span = {
      spanId,
      parentSpanId: options.parentSpanId,
      traceId,
      name,
      startTime: Date.now(),
      attributes: options.attributes || {},
      events: []
    }

    this.spans.set(spanId, span)
    this.activeSpans.push(span)

    logger.debug({ spanId, traceId, name }, 'Span started')
    return span
  }

  endSpan(spanId: string, status: 'OK' | 'ERROR' = 'OK'): void {
    const span = this.spans.get(spanId)
    if (!span) return

    span.endTime = Date.now()
    span.duration = span.endTime - span.startTime
    span.status = status

    // 从活跃栈移除
    const index = this.activeSpans.findIndex(s => s.spanId === spanId)
    if (index > -1) {
      this.activeSpans.splice(index, 1)
    }

    logger.debug({ spanId, traceId: span.traceId, duration: span.duration }, 'Span ended')
  }

  // ================================
  // 添加事件/属性
  // ================================

  addEvent(
    spanId: string,
    name: string,
    attributes?: Record<string, unknown>
  ): void {
    const span = this.spans.get(spanId)
    if (!span) return

    span.events.push({
      name,
      timestamp: Date.now(),
      attributes
    })
  }

  setAttribute(
    spanId: string,
    key: string,
    value: unknown
  ): void {
    const span = this.spans.get(spanId)
    if (!span) return
    span.attributes[key] = value
  }

  setError(spanId: string, error: string): void {
    const span = this.spans.get(spanId)
    if (!span) return
    span.status = 'ERROR'
    span.error = error
  }

  // ================================
  // 获取 Span
  // ================================

  getActiveSpan(): Span | null {
    return this.activeSpans[this.activeSpans.length - 1] || null
  }

  getSpan(spanId: string): Span | null {
    return this.spans.get(spanId) || null
  }

  getSpansByTrace(traceId: string): Span[] {
    return Array.from(this.spans.values()).filter(s => s.traceId === traceId)
  }

  // ================================
  // 辅助方法
  // ================================

  private getTraceId(parentSpanId?: string): string {
    if (parentSpanId) {
      const parent = this.spans.get(parentSpanId)
      if (parent) {
        return parent.traceId
      }
    }
    return this.generateId()
  }

  private generateId(): string {
    return `span-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}

// ================================
// 辅助栈类型
// ================================

class Stack<T> extends Array<T> {
  push(item: T): number {
    return super.push(item)
  }

  pop(): T | undefined {
    return super.pop()
  }

  peek(): T | undefined {
    return this[this.length - 1]
  }
}

// ================================
// 导出单例
// ================================

export const metrics = new MetricsCollector()
export const tracer = new Tracer()

// ================================
// 预定义指标名称
// ================================

export const Metrics = {
  CHAPTER_GENERATION_TOTAL: 'chapter_generation_total',
  CHAPTER_GENERATION_SUCCESS: 'chapter_generation_success',
  CHAPTER_GENERATION_FAILURE: 'chapter_generation_failure',
  AI_REQUEST_DURATION: 'ai_request_duration_seconds',
  AI_REQUEST_TOTAL: 'ai_request_total',
  TASK_QUEUE_LENGTH: 'task_queue_length',
  TASK_DURATION: 'task_duration_seconds'
}

// ================================
// 便捷装饰器
// ================================

export function withSpan(name: string, options: { attributes?: Record<string, unknown> } = {}) {
  return function <T extends (...args: any[]) => any>(
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const originalMethod = descriptor.value!
    descriptor.value = function (this: any, ...args: any[]) {
      const span = tracer.startSpan(name, options)
      try {
        const result = originalMethod.apply(this, args)
        if (result instanceof Promise) {
          return result.then((r) => {
            tracer.endSpan(span.spanId, 'OK')
            return r
          }).catch((err) => {
            tracer.setError(span.spanId, err.message)
            tracer.endSpan(span.spanId, 'ERROR')
            throw err
          })
        }
        tracer.endSpan(span.spanId, 'OK')
        return result
      } catch (err) {
        tracer.setError(span.spanId, (err as Error).message)
        tracer.endSpan(span.spanId, 'ERROR')
        throw err
      }
    } as T
  }
}
