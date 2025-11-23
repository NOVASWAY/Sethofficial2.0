"use client"

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react'
import { AppError, createError, logError, ERROR_TYPES } from '@/lib/error-handler'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: AppError) => void
  context?: string
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  appError: AppError | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      appError: null
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return { 
      hasError: true, 
      error, 
      errorInfo: null,
      appError: createError(
        ERROR_TYPES.UNKNOWN,
        error.message || 'An unexpected error occurred',
        { originalError: error }
      )
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const appError = createError(
      ERROR_TYPES.UNKNOWN,
      error.message || 'An unexpected error occurred',
      { 
        originalError: error,
        componentStack: errorInfo.componentStack,
        errorBoundary: this.props.context || 'Unknown'
      }
    )

    this.setState({
      error,
      errorInfo,
      appError
    })

    // Log error using our error handling system
    logError(appError, this.props.context || 'ErrorBoundary')

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(appError)
    }

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo)
    }
  }

  handleRetry = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null,
      appError: null
    })
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  handleReportBug = () => {
    if (this.state.appError) {
      // In a real application, you would send this to your error tracking service
      console.log('Reporting bug:', this.state.appError)
      
      // For now, just copy error details to clipboard
      const errorDetails = {
        message: this.state.appError.message,
        code: this.state.appError.code,
        timestamp: this.state.appError.timestamp,
        details: this.state.appError.details
      }
      
      navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2))
        .then(() => {
          alert('Error details copied to clipboard. Please share this with support.')
        })
        .catch(() => {
          alert('Error details: ' + JSON.stringify(errorDetails, null, 2))
        })
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-xl">Something went wrong</CardTitle>
              <CardDescription>
                An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.state.error && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Error Details:</p>
                  <p className="text-sm text-destructive font-mono break-words">
                    {this.state.error.message || 'Unknown error occurred'}
                  </p>
                  {this.state.error.stack && (
                    <details className="mt-2">
                      <summary className="text-xs text-muted-foreground cursor-pointer">
                        Error Stack
                      </summary>
                      <pre className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap max-h-40 overflow-auto">
                        {this.state.error.stack}
                      </pre>
                    </details>
                  )}
                  {this.state.errorInfo && (
                    <details className="mt-2">
                      <summary className="text-xs text-muted-foreground cursor-pointer">
                        Component Stack
                      </summary>
                      <pre className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap max-h-40 overflow-auto">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}
              
              <div className="flex flex-col gap-2">
                <Button onClick={this.handleRetry} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={this.handleGoHome} className="flex-1">
                    <Home className="h-4 w-4 mr-2" />
                    Go Home
                  </Button>
                  <Button variant="outline" onClick={this.handleReportBug} className="flex-1">
                    <Bug className="h-4 w-4 mr-2" />
                    Report Bug
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

// Higher-order component for wrapping components with error boundaries
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}
