'use client'

import { Component, type ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './Card'
import { Button } from './Button'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Card className="mx-auto max-w-md border-red-200">
          <CardHeader>
            <CardTitle>组件加载异常</CardTitle>
            <CardDescription>
              该模块遇到了意外错误，已自动隔离，不会影响其他模块的正常使用。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-gray-500">
              {this.state.error?.message || '未知错误'}
            </p>
            <Button variant="outline" onClick={this.handleReset}>
              重试加载
            </Button>
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}