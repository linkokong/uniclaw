// ============================================================
// ErrorBoundary - 捕获子组件 JS 错误，显示友好提示而非白屏
// ============================================================

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  /** 是否向上传播错误（用于页面级边界） */
  propagate?: boolean
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn('[ErrorBoundary] Caught:', error.message, errorInfo.componentStack?.slice(0, 300))
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div
          style={{
            padding: '32px',
            textAlign: 'center',
            color: '#9ca3af',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <p style={{ fontSize: '24px', marginBottom: '8px' }}>⚠</p>
          <p style={{ fontSize: '14px', color: '#ef4444', marginBottom: '16px' }}>
            {this.state.error?.message || 'Something went wrong'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '8px 16px',
              background: '#374151',
              border: '1px solid #4b5563',
              borderRadius: '8px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

// ─── 页面级 Error Boundary ───────────────────────────────────────────────
export function PageErrorFallback({ message }: { message?: string }) {
  return (
    <div
      style={{
        padding: '48px 24px',
        textAlign: 'center',
        maxWidth: '480px',
        margin: '0 auto',
      }}
    >
      <div
        style={{
          fontSize: '48px',
          marginBottom: '16px',
        }}
      >
        🔌
      </div>
      <h2
        style={{
          fontSize: '18px',
          fontWeight: 600,
          color: '#fff',
          marginBottom: '8px',
        }}
      >
        Page failed to load
      </h2>
      <p
        style={{
          fontSize: '14px',
          color: '#9ca3af',
          marginBottom: '24px',
          lineHeight: 1.6,
        }}
      >
        {message ||
          'This page encountered an error. Try refreshing or connecting your wallet.'}
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: '10px 24px',
          background: 'linear-gradient(135deg, #9945FF, #14F195)',
          border: 'none',
          borderRadius: '12px',
          color: '#fff',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Refresh Page
      </button>
    </div>
  )
}
