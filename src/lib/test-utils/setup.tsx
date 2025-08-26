// lib/test-utils/setup.tsx
// Utilidades para pruebas que envuelven componentes con el store de Redux
import type { ReactElement, ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { Provider } from "react-redux";
import { store } from "@/lib/store";

type AllProvidersProps = { children: ReactNode };

function AllProviders({ children }: AllProvidersProps) {
  return <Provider store={store}>{children}</Provider>;
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) => render(ui, { wrapper: AllProviders, ...options });

// Re-exporta todo de RTL y expone nuestro render custom
export * from "@testing-library/react";
export { customRender as render };
