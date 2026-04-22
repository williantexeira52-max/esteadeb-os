import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<any, any> {
  state: any = { hasError: false, error: null };

  constructor(props: any) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  render() {
    const self = this as any;
    if (self.state.hasError) {
      let errorMessage = "Ocorreu um erro inesperado.";
      try {
        const parsed = JSON.parse(self.state.error?.message || "");
        if (parsed.error && parsed.error.includes("insufficient permissions")) {
          errorMessage = "Você não tem permissão para realizar esta ação ou acessar estes dados.";
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-navy text-white p-6">
          <h1 className="text-2xl font-bold mb-4">Ops! Algo deu errado.</h1>
          <p className="text-gray-300 mb-6 text-center max-w-md">
            {errorMessage}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-petrol hover:bg-petrol-dark rounded-md transition-colors"
          >
            Recarregar Sistema
          </button>
        </div>
      );
    }

    return self.props.children;
  }
}
