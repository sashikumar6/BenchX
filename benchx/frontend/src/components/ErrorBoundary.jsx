import { Component } from 'react'
import Button from './Button'

export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  handleReset = () => this.setState({ hasError: false })

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-bg-card border border-danger/40 rounded-2xl p-8 text-center">
          <p className="text-lg font-semibold text-text-primary">This view couldn’t load</p>
          <p className="text-sm text-text-secondary mt-2">Your saved BenchX data is safe. Try loading this view again.</p>
          <Button onClick={this.handleReset} size="sm" className="mt-5">
            Try again
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
