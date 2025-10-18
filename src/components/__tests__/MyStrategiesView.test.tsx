/**
 * Tests for MyStrategiesView Component
 * 
 * Note: These tests verify the component structure and basic rendering.
 * Full integration testing with wallet connection and execution flow
 * would require more complex mocking of wagmi and iExec services.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MyStrategiesView from '../MyStrategiesView';

// Mock wagmi
vi.mock('wagmi', () => ({
  useAccount: vi.fn(() => ({
    address: undefined,
    isConnected: false,
  })),
}));

// Mock strategies
vi.mock('@/strategies', () => ({
  MockStrategy: vi.fn().mockImplementation(() => ({
    id: 'mock-strategy',
    name: 'Mock Strategy',
    description: 'A mock strategy for testing',
    risk: 'low',
    apr: { min: 5, max: 15 },
    price: '10',
    isOwned: false,
  })),
  BTCDeltaNeutralStrategy: vi.fn().mockImplementation(() => ({
    id: 'btc-delta-neutral',
    name: 'BTC Delta Neutral',
    description: 'BTC delta neutral strategy',
    risk: 'medium',
    apr: { min: 10, max: 20 },
    price: '20',
    isOwned: false,
  })),
  ETHDeltaNeutralStrategy: vi.fn().mockImplementation(() => ({
    id: 'eth-delta-neutral',
    name: 'ETH Delta Neutral',
    description: 'ETH delta neutral strategy',
    risk: 'medium',
    apr: { min: 8, max: 18 },
    price: '15',
    isOwned: false,
  })),
}));

// Mock services
vi.mock('@/services/IExecExecutionService', () => ({
  IExecExecutionService: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    executeStrategy: vi.fn().mockResolvedValue({
      success: true,
      taskId: '0xmocktask',
    }),
    getExecutionStatus: vi.fn().mockResolvedValue({
      status: 'completed',
      taskId: '0xmocktask',
      result: {
        success: true,
        executedOperations: 3,
      },
    }),
  })),
}));

vi.mock('@/services/StrategyDataProtectorService', () => ({
  getStrategyDataProtectorService: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    isReady: vi.fn(() => true),
  })),
}));

describe('MyStrategiesView', () => {
  it('renders wallet connection prompt when not connected', () => {
    render(<MyStrategiesView />);

    expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument();
    expect(screen.getByText(/Please connect your wallet to view your strategies/i)).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<MyStrategiesView />);
    expect(container).toBeTruthy();
  });

  it('accepts onExecute callback prop', () => {
    const mockOnExecute = vi.fn();
    const { container } = render(<MyStrategiesView onExecute={mockOnExecute} />);
    expect(container).toBeTruthy();
  });
});
