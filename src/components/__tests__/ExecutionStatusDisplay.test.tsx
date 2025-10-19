/**
 * Tests for ExecutionStatusDisplay Component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExecutionStatusDisplay from '../ExecutionStatusDisplay';
import type { ExecutionResult } from '@/types/strategy';

describe('ExecutionStatusDisplay', () => {
  it('renders nothing when status is idle', () => {
    const { container } = render(
      <ExecutionStatusDisplay status="idle" />
    );

    expect(container.firstChild).toBeNull();
  });

  it('displays pending state with loading spinner', () => {
    render(
      <ExecutionStatusDisplay
        status="pending"
        taskId="0x123abc"
      />
    );

    expect(screen.getByText('Initializing Execution')).toBeInTheDocument();
    expect(screen.getByText(/Waiting for a worker to be assigned/i)).toBeInTheDocument();
    expect(screen.getByText('0x123abc')).toBeInTheDocument();
  });

  it('displays running state with progress steps', () => {
    render(
      <ExecutionStatusDisplay
        status="running"
        taskId="0x123abc"
      />
    );

    expect(screen.getByText('Executing Strategy')).toBeInTheDocument();
    expect(screen.getByText(/being executed securely/i)).toBeInTheDocument();
    expect(screen.getByText('Worker assigned')).toBeInTheDocument();
    expect(screen.getByText('TEE container started')).toBeInTheDocument();
  });

  it('displays completed state with results', () => {
    const mockResult: ExecutionResult = {
      success: true,
      executedOperations: 3,
      metrics: {
        gasUsed: '0.0025',
        profitEstimate: 125.50,
        fundingRates: {
          'BTC/USD': 0.0001,
        },
      },
    };

    render(
      <ExecutionStatusDisplay
        status="completed"
        result={mockResult}
        taskId="0x123abc"
      />
    );

    expect(screen.getByText('Execution Completed Successfully')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // Operations executed
    expect(screen.getByText('0.0025 ETH')).toBeInTheDocument(); // Gas used
    // Profit is now displayed with a + sign and in a larger format
    expect(screen.getByText('+$125.50')).toBeInTheDocument(); // Profit estimate
  });

  it('displays failed state with error message', () => {
    render(
      <ExecutionStatusDisplay
        status="failed"
        error="Insufficient funds"
        taskId="0x123abc"
      />
    );

    expect(screen.getByText('Execution Failed')).toBeInTheDocument();
    expect(screen.getByText('Insufficient funds')).toBeInTheDocument();
    expect(screen.getByText(/Troubleshooting/i)).toBeInTheDocument();
  });

  it('displays position details when available', () => {
    const mockResult: ExecutionResult = {
      success: true,
      executedOperations: 2,
      metrics: {
        positions: [
          {
            type: 'short',
            ticker: 'BTC/USD',
            entryPrice: '45000',
            size: '0.1',
            leverage: 2,
            transactionHash: '0xabc123',
          },
        ],
      },
    };

    render(
      <ExecutionStatusDisplay
        status="completed"
        result={mockResult}
      />
    );

    // Updated label for enhanced display
    expect(screen.getByText('Short Position Details:')).toBeInTheDocument();
    expect(screen.getByText('SHORT')).toBeInTheDocument();
    expect(screen.getByText('BTC/USD')).toBeInTheDocument();
    // Entry price is now formatted - check for the label and value separately
    expect(screen.getByText('Entry Price')).toBeInTheDocument();
    expect(screen.getByText(/45/)).toBeInTheDocument(); // Flexible match for formatted number
    expect(screen.getByText('2x Leverage')).toBeInTheDocument();
  });

  it('displays spot trade details when available', () => {
    const mockResult: ExecutionResult = {
      success: true,
      executedOperations: 1,
      metrics: {
        spotTrades: [
          {
            type: 'buy',
            ticker: 'BTC/USDC',
            asset: 'BTC',
            amount: '0.1',
            executionPrice: '45000',
            transactionHash: '0xdef456',
          },
        ],
      },
    };

    render(
      <ExecutionStatusDisplay
        status="completed"
        result={mockResult}
      />
    );

    // Updated label for enhanced display
    expect(screen.getByText('Spot Holding Details:')).toBeInTheDocument();
    expect(screen.getByText('BUY')).toBeInTheDocument();
    expect(screen.getByText('BTC')).toBeInTheDocument();
    // Execution price is now formatted - check for the label
    expect(screen.getByText('Execution Price')).toBeInTheDocument();
    expect(screen.getByText('Total Value')).toBeInTheDocument();
    // Check that the amount is displayed
    expect(screen.getByText('0.1 BTC')).toBeInTheDocument();
  });

  it('displays funding rates when available', () => {
    const mockResult: ExecutionResult = {
      success: true,
      executedOperations: 1,
      metrics: {
        fundingRates: {
          'BTC/USD': 0.0001,
          'ETH/USD': 0.0002,
        },
      },
    };

    render(
      <ExecutionStatusDisplay
        status="completed"
        result={mockResult}
      />
    );

    // Updated label for enhanced display
    expect(screen.getByText('Funding Rate Used:')).toBeInTheDocument();
    expect(screen.getByText('BTC/USD:')).toBeInTheDocument();
    expect(screen.getByText('0.0100%')).toBeInTheDocument();
    // Check for the explanation text - use getAllByText since there are multiple funding rates
    const explanations = screen.getAllByText('(Long pays Short)');
    expect(explanations.length).toBeGreaterThan(0);
  });

  it('displays default error message when no error provided', () => {
    render(
      <ExecutionStatusDisplay
        status="failed"
      />
    );

    expect(screen.getByText(/An error occurred during strategy execution/i)).toBeInTheDocument();
  });
});
