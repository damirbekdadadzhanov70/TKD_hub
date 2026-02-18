import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg-primary flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <h1 className="font-heading text-2xl text-text-heading mb-3">
              Что-то пошло не так
            </h1>
            <p className="font-body text-text-secondary mb-6">
              Произошла непредвиденная ошибка. Попробуйте перезагрузить приложение.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-accent text-white font-body font-medium rounded-xl cursor-pointer active:opacity-80 hover:opacity-90 transition-opacity"
            >
              Перезагрузить
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
