// Last-resort guard: if a view throws, show a recovery message instead of a blank page.

import { Component, type ReactNode } from 'react'

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="banner" role="alert">
        <strong>Something went wrong displaying this view.</strong> {this.state.error.message}{' '}
        <button
          type="button"
          className="link"
          onClick={() => {
            window.location.hash = ''
            window.location.reload()
          }}
        >
          Reset to defaults
        </button>
      </div>
    )
  }
}
