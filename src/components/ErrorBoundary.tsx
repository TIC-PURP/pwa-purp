"use client";

import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error?: Error;
};

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Aquí puedes enviar el error a un servicio como Sentry o tu backend
    if (process.env.NODE_ENV !== "development") {
      console.error("App Error:", error, info);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center text-red-500">
          <h2 className="text-lg font-semibold">¡Algo salió mal!</h2>
          <p>Por favor, intenta de nuevo más tarde.</p>
        </div>
      );
    }

    return this.props.children;
  }
}
