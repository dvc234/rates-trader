/**
 * Test utilities for React component testing
 * Provides custom render function with necessary providers
 */

import { ReactElement } from 'react';
import { render as rtlRender, RenderOptions } from '@testing-library/react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, createConfig } from 'wagmi';
import { arbitrumSepolia, base } from 'wagmi/chains';

/**
 * Create a mock wagmi config for testing
 */
const mockWagmiConfig = createConfig({
  chains: [arbitrumSepolia, base],
  transports: {
    [arbitrumSepolia.id]: http(),
    [base.id]: http(),
  },
});

/**
 * Custom render function that wraps components with necessary providers
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <WagmiProvider config={mockWagmiConfig}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    );
  }

  return rtlRender(ui, { wrapper: Wrapper, ...options });
}

// Re-export everything from React Testing Library
export * from '@testing-library/react';
export { renderWithProviders as render };
