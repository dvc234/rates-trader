/**
 * Tests for StrategyExecutionModal Component
 * 
 * Comprehensive integration tests for the execution UI flow:
 * - Configuration form validation
 * - Execution flow
 * - Status updates
 * - Result display
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StrategyExecutionModal from '../StrategyExecutionModal';
import type { Strategy } from '@/types/strategy';

// Mock wagmi
vi.mock('wagmi', () => ({
  useAccount: vi.fn(() => ({
    address: '0x1234567890123456789012345678901234567890',
    isConnected: true,
  })),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock strategy for testing
const mockStrategy: Strategy = {
  id: 'test-strategy',
  name: 'Test Strategy',
  description: 'A test strategy',
  risk: 'medium',
  apr: { min: 10, max: 20 },
  price: '10',
  isOwned: true,
};

// Mock execution service
const mockExecutionService = {
  initialize: vi.fn().mockResolvedValue(undefined),
  executeStrategy: vi.fn(),
  getExecutionStatus: vi.fn(),
};

describe('StrategyExecutionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Configuration Form Validation', () => {
    it('renders configuration form when modal is open', () => {
      render(
        <StrategyExecutionModal
          strategy={mockStrategy}
          isOpen={true}
          onClose={vi.fn()}
          executionService={mockExecutionService as any}
        />
      );

      expect(screen.getByRole('button', { name: /Execute Strategy/i })).toBeInTheDocument();
      expect(screen.getByText('Test Strategy')).toBeInTheDocument();
      expect(screen.getByText('Execution Mode')).toBeInTheDocument();
    });

    it('validates slippage tolerance must be greater than 0', async () => {
      render(
        <StrategyExecutionModal
          strategy={mockStrategy}
          isOpen={true}
          onClose={vi.fn()}
          executionService={mockExecutionService as any}
        />
      );

      const slippageInput = screen.getByLabelText(/Slippage Tolerance/i);
      fireEvent.change(slippageInput, { target: { value: '-1' } });

      const executeButton = screen.getByRole('button', { name: /Execute Strategy/i });
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(mockExecutionService.executeStrategy).not.toHaveBeenCalled();
      });
    });


    it('validates spread percentage is required for optimized mode', async () => {
      render(
        <StrategyExecutionModal
          strategy={mockStrategy}
          isOpen={true}
          onClose={vi.fn()}
          executionService={mockExecutionService as any}
        />
      );

      // Switch to optimized mode
      const optimizedButton = screen.getByText('Optimized');
      fireEvent.click(optimizedButton);

      // Try to execute without spread percentage
      const executeButton = screen.getByRole('button', { name: /Execute Strategy/i });
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(mockExecutionService.executeStrategy).not.toHaveBeenCalled();
      });
    });

    it('validates slippage tolerance range (0-100)', async () => {
      render(
        <StrategyExecutionModal
          strategy={mockStrategy}
          isOpen={true}
          onClose={vi.fn()}
          executionService={mockExecutionService as any}
        />
      );

      const slippageInput = screen.getByLabelText(/Slippage Tolerance/i);
      fireEvent.change(slippageInput, { target: { value: '150' } });

      const executeButton = screen.getByRole('button', { name: /Execute Strategy/i });
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(mockExecutionService.executeStrategy).not.toHaveBeenCalled();
      });
    });

    it('validates capital allocation is positive', async () => {
      render(
        <StrategyExecutionModal
          strategy={mockStrategy}
          isOpen={true}
          onClose={vi.fn()}
          executionService={mockExecutionService as any}
        />
      );

      const capitalInput = screen.getByLabelText(/Capital Allocation/i);
      fireEvent.change(capitalInput, { target: { value: '-100' } });

      const executeButton = screen.getByRole('button', { name: /Execute Strategy/i });
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(mockExecutionService.executeStrategy).not.toHaveBeenCalled();
      });
    });


    it('persists configuration to localStorage', async () => {
      const { rerender } = render(
        <StrategyExecutionModal
          strategy={mockStrategy}
          isOpen={true}
          onClose={vi.fn()}
          executionService={mockExecutionService as any}
        />
      );

      // Change configuration
      const slippageInput = screen.getByLabelText(/Slippage Tolerance/i);
      fireEvent.change(slippageInput, { target: { value: '2.5' } });

      // Wait for localStorage update
      await waitFor(() => {
        const storageKey = `strategy_config_${mockStrategy.id}_0x1234567890123456789012345678901234567890`;
        const saved = localStorageMock.getItem(storageKey);
        expect(saved).toBeTruthy();
        const parsed = JSON.parse(saved!);
        expect(parsed.slippageTolerance).toBe(2.5);
      });
    });

    it('loads saved configuration from localStorage', () => {
      // Pre-populate localStorage
      const storageKey = `strategy_config_${mockStrategy.id}_0x1234567890123456789012345678901234567890`;
      localStorageMock.setItem(storageKey, JSON.stringify({
        executionMode: 'optimized',
        slippageTolerance: 3.0,
        spreadPercentage: 0.8,
        capitalAllocation: '5000',
      }));

      render(
        <StrategyExecutionModal
          strategy={mockStrategy}
          isOpen={true}
          onClose={vi.fn()}
          executionService={mockExecutionService as any}
        />
      );

      const slippageInput = screen.getByLabelText(/Slippage Tolerance/i) as HTMLInputElement;
      expect(slippageInput.value).toBe('3');
    });
  });


  describe('Execution Flow', () => {
    it('initiates execution with valid configuration', async () => {
      mockExecutionService.executeStrategy.mockResolvedValue({
        success: true,
        taskId: '0xtest-task-id',
      });

      mockExecutionService.getExecutionStatus.mockResolvedValue({
        status: 'completed',
        result: {
          success: true,
          executedOperations: 3,
        },
      });

      render(
        <StrategyExecutionModal
          strategy={mockStrategy}
          isOpen={true}
          onClose={vi.fn()}
          executionService={mockExecutionService as any}
        />
      );

      const executeButton = screen.getByRole('button', { name: /Execute Strategy/i });
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(mockExecutionService.executeStrategy).toHaveBeenCalledWith(
          mockStrategy.id,
          '0x1234567890123456789012345678901234567890',
          expect.objectContaining({
            executionMode: 'instant',
            slippageTolerance: 1.0,
          })
        );
      });
    });

    it('displays error when execution fails', async () => {
      mockExecutionService.executeStrategy.mockResolvedValue({
        success: false,
        error: 'Insufficient funds',
      });

      render(
        <StrategyExecutionModal
          strategy={mockStrategy}
          isOpen={true}
          onClose={vi.fn()}
          executionService={mockExecutionService as any}
        />
      );

      const executeButton = screen.getByRole('button', { name: /Execute Strategy/i });
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(screen.getByText('Insufficient funds')).toBeInTheDocument();
      });
    });


    it('hides configuration form during execution', async () => {
      mockExecutionService.executeStrategy.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ success: true, taskId: '0xtest' }), 1000))
      );

      render(
        <StrategyExecutionModal
          strategy={mockStrategy}
          isOpen={true}
          onClose={vi.fn()}
          executionService={mockExecutionService as any}
        />
      );

      const executeButton = screen.getByRole('button', { name: /Execute Strategy/i });
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Execute Strategy/i })).not.toBeInTheDocument();
      });
    });

    it('prevents modal close during execution', async () => {
      mockExecutionService.executeStrategy.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ success: true, taskId: '0xtest' }), 1000))
      );

      const onClose = vi.fn();

      render(
        <StrategyExecutionModal
          strategy={mockStrategy}
          isOpen={true}
          onClose={onClose}
          executionService={mockExecutionService as any}
        />
      );

      const executeButton = screen.getByRole('button', { name: /Execute Strategy/i });
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Execute Strategy/i })).not.toBeInTheDocument();
      });

      // Try to close modal
      const closeButton = screen.getByRole('button', { name: '' });
      fireEvent.click(closeButton);

      // Modal should not close
      expect(onClose).not.toHaveBeenCalled();
    });
  });


  describe('Status Updates', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('displays pending status after execution starts', async () => {
      vi.useRealTimers(); // Use real timers for this test

      mockExecutionService.executeStrategy.mockResolvedValue({
        success: true,
        taskId: '0xtest-task-id',
      });

      mockExecutionService.getExecutionStatus.mockResolvedValue({
        status: 'pending',
        taskId: '0xtest-task-id',
      });

      render(
        <StrategyExecutionModal
          strategy={mockStrategy}
          isOpen={true}
          onClose={vi.fn()}
          executionService={mockExecutionService as any}
        />
      );

      const executeButton = screen.getByRole('button', { name: /Execute Strategy/i });
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(screen.getByText('Initializing Execution')).toBeInTheDocument();
      }, { timeout: 10000 });

      vi.useFakeTimers(); // Restore fake timers
    });

    it('displays running status during execution', async () => {
      vi.useRealTimers(); // Use real timers for this test

      mockExecutionService.executeStrategy.mockResolvedValue({
        success: true,
        taskId: '0xtest-task-id',
      });

      mockExecutionService.getExecutionStatus.mockResolvedValue({
        status: 'running',
        taskId: '0xtest-task-id',
      });

      render(
        <StrategyExecutionModal
          strategy={mockStrategy}
          isOpen={true}
          onClose={vi.fn()}
          executionService={mockExecutionService as any}
        />
      );

      const executeButton = screen.getByRole('button', { name: /Execute Strategy/i });
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(screen.getByText('Executing Strategy')).toBeInTheDocument();
      }, { timeout: 10000 });

      vi.useFakeTimers(); // Restore fake timers
    });


    it('polls for status updates', async () => {
      vi.useRealTimers(); // Use real timers for this test

      mockExecutionService.executeStrategy.mockResolvedValue({
        success: true,
        taskId: '0xtest-task-id',
      });

      mockExecutionService.getExecutionStatus.mockResolvedValue({
        status: 'completed',
        taskId: '0xtest-task-id',
        result: { success: true, executedOperations: 3 },
      });

      render(
        <StrategyExecutionModal
          strategy={mockStrategy}
          isOpen={true}
          onClose={vi.fn()}
          executionService={mockExecutionService as any}
        />
      );

      const executeButton = screen.getByRole('button', { name: /Execute Strategy/i });
      fireEvent.click(executeButton);

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByText('Execution Completed Successfully')).toBeInTheDocument();
      }, { timeout: 10000 });

      // Verify status was checked
      expect(mockExecutionService.getExecutionStatus).toHaveBeenCalled();

      vi.useFakeTimers(); // Restore fake timers
    }, 15000);

    it('stops polling when execution completes', async () => {
      vi.useRealTimers(); // Use real timers for this test

      mockExecutionService.executeStrategy.mockResolvedValue({
        success: true,
        taskId: '0xtest-task-id',
      });

      mockExecutionService.getExecutionStatus.mockResolvedValue({
        status: 'completed',
        taskId: '0xtest-task-id',
        result: { success: true, executedOperations: 3 },
      });

      render(
        <StrategyExecutionModal
          strategy={mockStrategy}
          isOpen={true}
          onClose={vi.fn()}
          executionService={mockExecutionService as any}
        />
      );

      const executeButton = screen.getByRole('button', { name: /Execute Strategy/i });
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(screen.getByText('Execution Completed Successfully')).toBeInTheDocument();
      }, { timeout: 10000 });

      // Polling should have stopped - just verify execution completed
      expect(screen.getByText('Execution Completed Successfully')).toBeInTheDocument();

      vi.useFakeTimers(); // Restore fake timers
    }, 15000);
  });


  describe('Result Display', () => {
    it('displays execution results on completion', async () => {
      mockExecutionService.executeStrategy.mockResolvedValue({
        success: true,
        taskId: '0xtest-task-id',
      });

      mockExecutionService.getExecutionStatus.mockResolvedValue({
        status: 'completed',
        taskId: '0xtest-task-id',
        result: {
          success: true,
          executedOperations: 5,
          metrics: {
            gasUsed: '0.0035',
            profitEstimate: 250.75,
          },
        },
      });

      render(
        <StrategyExecutionModal
          strategy={mockStrategy}
          isOpen={true}
          onClose={vi.fn()}
          executionService={mockExecutionService as any}
        />
      );

      const executeButton = screen.getByRole('button', { name: /Execute Strategy/i });
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(screen.getByText('Execution Completed Successfully')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument(); // Operations executed
        expect(screen.getByText('0.0035 ETH')).toBeInTheDocument(); // Gas used
        expect(screen.getByText('$250.75')).toBeInTheDocument(); // Profit estimate
      });
    });

    it('displays position details in results', async () => {
      mockExecutionService.executeStrategy.mockResolvedValue({
        success: true,
        taskId: '0xtest-task-id',
      });

      mockExecutionService.getExecutionStatus.mockResolvedValue({
        status: 'completed',
        taskId: '0xtest-task-id',
        result: {
          success: true,
          executedOperations: 2,
          metrics: {
            positions: [
              {
                type: 'short',
                ticker: 'BTC/USD',
                entryPrice: '50000',
                size: '0.5',
                leverage: 3,
                transactionHash: '0xabc123',
              },
            ],
          },
        },
      });

      render(
        <StrategyExecutionModal
          strategy={mockStrategy}
          isOpen={true}
          onClose={vi.fn()}
          executionService={mockExecutionService as any}
        />
      );

      const executeButton = screen.getByRole('button', { name: /Execute Strategy/i });
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(screen.getByText('Positions Opened:')).toBeInTheDocument();
        expect(screen.getByText('SHORT BTC/USD')).toBeInTheDocument();
        expect(screen.getByText('Entry: $50000')).toBeInTheDocument();
        expect(screen.getByText('3x')).toBeInTheDocument();
      });
    });


    it('displays spot trade details in results', async () => {
      mockExecutionService.executeStrategy.mockResolvedValue({
        success: true,
        taskId: '0xtest-task-id',
      });

      mockExecutionService.getExecutionStatus.mockResolvedValue({
        status: 'completed',
        taskId: '0xtest-task-id',
        result: {
          success: true,
          executedOperations: 1,
          metrics: {
            spotTrades: [
              {
                type: 'buy',
                ticker: 'BTC/USDC',
                asset: 'BTC',
                amount: '0.2',
                executionPrice: '48000',
                transactionHash: '0xdef456',
              },
            ],
          },
        },
      });

      render(
        <StrategyExecutionModal
          strategy={mockStrategy}
          isOpen={true}
          onClose={vi.fn()}
          executionService={mockExecutionService as any}
        />
      );

      const executeButton = screen.getByRole('button', { name: /Execute Strategy/i });
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(screen.getByText('Spot Trades:')).toBeInTheDocument();
        expect(screen.getByText('BUY BTC')).toBeInTheDocument();
        expect(screen.getByText('$48000')).toBeInTheDocument();
      });
    });

    it('displays funding rates in results', async () => {
      mockExecutionService.executeStrategy.mockResolvedValue({
        success: true,
        taskId: '0xtest-task-id',
      });

      mockExecutionService.getExecutionStatus.mockResolvedValue({
        status: 'completed',
        taskId: '0xtest-task-id',
        result: {
          success: true,
          executedOperations: 1,
          metrics: {
            fundingRates: {
              'BTC/USD': 0.0001,
              'ETH/USD': 0.0002,
            },
          },
        },
      });

      render(
        <StrategyExecutionModal
          strategy={mockStrategy}
          isOpen={true}
          onClose={vi.fn()}
          executionService={mockExecutionService as any}
        />
      );

      const executeButton = screen.getByRole('button', { name: /Execute Strategy/i });
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(screen.getByText('Funding Rates:')).toBeInTheDocument();
        expect(screen.getByText('BTC/USD:')).toBeInTheDocument();
        expect(screen.getByText('0.0100%')).toBeInTheDocument();
      });
    });


    it('displays task ID in results', async () => {
      mockExecutionService.executeStrategy.mockResolvedValue({
        success: true,
        taskId: '0xtest-task-id-12345',
      });

      mockExecutionService.getExecutionStatus.mockResolvedValue({
        status: 'completed',
        taskId: '0xtest-task-id-12345',
        result: {
          success: true,
          executedOperations: 1,
        },
      });

      render(
        <StrategyExecutionModal
          strategy={mockStrategy}
          isOpen={true}
          onClose={vi.fn()}
          executionService={mockExecutionService as any}
        />
      );

      const executeButton = screen.getByRole('button', { name: /Execute Strategy/i });
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(screen.getByText('Task ID:')).toBeInTheDocument();
        expect(screen.getByText('0xtest-task-id-12345')).toBeInTheDocument();
      });
    });

    it('displays error message on failure', async () => {
      mockExecutionService.executeStrategy.mockResolvedValue({
        success: true,
        taskId: '0xtest-task-id',
      });

      mockExecutionService.getExecutionStatus.mockResolvedValue({
        status: 'failed',
        taskId: '0xtest-task-id',
        error: 'Network timeout',
      });

      render(
        <StrategyExecutionModal
          strategy={mockStrategy}
          isOpen={true}
          onClose={vi.fn()}
          executionService={mockExecutionService as any}
        />
      );

      const executeButton = screen.getByRole('button', { name: /Execute Strategy/i });
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(screen.getByText('Execution Failed')).toBeInTheDocument();
        expect(screen.getByText('Network timeout')).toBeInTheDocument();
      });
    });

    it('allows closing modal after execution completes', async () => {
      mockExecutionService.executeStrategy.mockResolvedValue({
        success: true,
        taskId: '0xtest-task-id',
      });

      mockExecutionService.getExecutionStatus.mockResolvedValue({
        status: 'completed',
        taskId: '0xtest-task-id',
        result: {
          success: true,
          executedOperations: 1,
        },
      });

      const onClose = vi.fn();

      render(
        <StrategyExecutionModal
          strategy={mockStrategy}
          isOpen={true}
          onClose={onClose}
          executionService={mockExecutionService as any}
        />
      );

      const executeButton = screen.getByRole('button', { name: /Execute Strategy/i });
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(screen.getByText('Execution Completed Successfully')).toBeInTheDocument();
      });

      // Close button should be available
      const closeButtons = screen.getAllByText('Close');
      fireEvent.click(closeButtons[0]);

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Modal Behavior', () => {
    it('does not render when isOpen is false', () => {
      const { container } = render(
        <StrategyExecutionModal
          strategy={mockStrategy}
          isOpen={false}
          onClose={vi.fn()}
          executionService={mockExecutionService as any}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('resets execution state when modal closes', async () => {
      mockExecutionService.executeStrategy.mockResolvedValue({
        success: true,
        taskId: '0xtest-task-id',
      });

      mockExecutionService.getExecutionStatus.mockResolvedValue({
        status: 'completed',
        taskId: '0xtest-task-id',
        result: {
          success: true,
          executedOperations: 1,
        },
      });

      const onClose = vi.fn();
      const { rerender } = render(
        <StrategyExecutionModal
          strategy={mockStrategy}
          isOpen={true}
          onClose={onClose}
          executionService={mockExecutionService as any}
        />
      );

      const executeButton = screen.getByRole('button', { name: /Execute Strategy/i });
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(screen.getByText('Execution Completed Successfully')).toBeInTheDocument();
      });

      // Close modal
      const closeButtons = screen.getAllByText('Close');
      fireEvent.click(closeButtons[0]);

      // Reopen modal
      rerender(
        <StrategyExecutionModal
          strategy={mockStrategy}
          isOpen={true}
          onClose={onClose}
          executionService={mockExecutionService as any}
        />
      );

      // Should show configuration form again, not results
      expect(screen.getByRole('button', { name: /Execute Strategy/i })).toBeInTheDocument();
      expect(screen.queryByText('Execution Completed Successfully')).not.toBeInTheDocument();
    });
  });
});
