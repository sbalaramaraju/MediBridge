import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      try {
        const parsedError = JSON.parse(this.state.error?.message || "");
        if (parsedError.error) {
          errorMessage = `Medical Data Error: ${parsedError.error}`;
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div role="alert" className="flex min-h-screen flex-col items-center justify-center bg-teal-50 p-4 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-red-100 text-red-600">
            <AlertCircle className="h-10 w-10" aria-hidden="true" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-teal-900">Something went wrong</h1>
          <p className="mb-8 max-w-md text-teal-600/60">
            {errorMessage}
          </p>
          <button
            onClick={() => window.location.reload()}
            aria-label="Reload the application"
            className="flex items-center gap-2 rounded-2xl bg-teal-900 px-8 py-3 font-bold text-white transition-all hover:bg-teal-800"
          >
            <RefreshCw className="h-5 w-5" aria-hidden="true" />
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
