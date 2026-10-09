import { Component, type ErrorInfo, type ReactNode } from 'react';

// Last-resort catch for render errors (e.g. a malformed vehicle record), so one
// bad value shows a recoverable message instead of blanking the whole app.
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('AutoBrowse: render error —', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24, color: 'var(--ink)', fontFamily: 'var(--sans)' }}>
        <div style={{ maxWidth: 420, padding: 20, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--paper)' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5, marginBottom: 16 }}>{this.state.error.message}</div>
          <button className="btn btn-secondary" onClick={() => { window.location.href = '/'; }}>Back to dashboard</button>
        </div>
      </div>
    );
  }
}
