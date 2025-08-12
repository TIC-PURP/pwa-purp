"use client";

import { Component, ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean; error?: Error };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("ErrorBoundary:", error, info);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-red-600">
          Ocurrió un error inesperado. Recarga la página.
        </div>
      );
    }
    return this.props.children;
  }
}
