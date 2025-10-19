/**
 * Tests for StrategyConfigForm Component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StrategyConfigForm from '../StrategyConfigForm';
import type { StrategyConfig } from '@/types/strategy';

describe('StrategyConfigForm', () => {
  const mockConfig: StrategyConfig = {
    executionMode: 'instant',
    slippageTolerance: 1.0,
    spreadPercentage: undefined,
    capitalAllocation: undefined,
  };

  const mockOnChange = vi.fn();

  it('renders all form fields', () => {
    render(<StrategyConfigForm config={mockConfig} onChange={mockOnChange} />);

    expect(screen.getByText('Execution Mode')).toBeInTheDocument();
    expect(screen.getByText('Spread Percentage')).toBeInTheDocument();
    expect(screen.getByText('Slippage Tolerance')).toBeInTheDocument();
    expect(screen.getByText('Capital Allocation (Optional)')).toBeInTheDocument();
  });

  it('displays instant and optimized mode buttons', () => {
    render(<StrategyConfigForm config={mockConfig} onChange={mockOnChange} />);

    expect(screen.getByText('Instant')).toBeInTheDocument();
    expect(screen.getByText('Optimized')).toBeInTheDocument();
  });

  it('disables spread percentage input in instant mode', () => {
    render(<StrategyConfigForm config={mockConfig} onChange={mockOnChange} />);

    const spreadInput = screen.getByLabelText(/Spread Percentage/i);
    expect(spreadInput).toBeDisabled();
  });

  it('enables spread percentage input in optimized mode', () => {
    const optimizedConfig: StrategyConfig = {
      ...mockConfig,
      executionMode: 'optimized',
      spreadPercentage: 0.5,
    };

    render(<StrategyConfigForm config={optimizedConfig} onChange={mockOnChange} />);

    const spreadInput = screen.getByLabelText(/Spread Percentage/i);
    expect(spreadInput).not.toBeDisabled();
  });

  it('calls onChange when execution mode changes', () => {
    render(<StrategyConfigForm config={mockConfig} onChange={mockOnChange} />);

    const optimizedButton = screen.getByText('Optimized');
    fireEvent.click(optimizedButton);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        executionMode: 'optimized',
      })
    );
  });

  it('calls onChange when slippage tolerance changes', () => {
    render(<StrategyConfigForm config={mockConfig} onChange={mockOnChange} />);

    const slippageInput = screen.getByLabelText(/Slippage Tolerance/i);
    fireEvent.change(slippageInput, { target: { value: '2.5' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        slippageTolerance: 2.5,
      })
    );
  });

  it('calls onChange when capital allocation changes', () => {
    render(<StrategyConfigForm config={mockConfig} onChange={mockOnChange} />);

    const capitalInput = screen.getByLabelText(/Capital Allocation/i);
    fireEvent.change(capitalInput, { target: { value: '1000' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        capitalAllocation: '1000',
      })
    );
  });

  it('displays configuration summary', () => {
    render(<StrategyConfigForm config={mockConfig} onChange={mockOnChange} />);

    expect(screen.getByText('Configuration Summary')).toBeInTheDocument();
    expect(screen.getByText('Instant (Market)')).toBeInTheDocument();
  });

  it('disables all inputs when disabled prop is true', () => {
    render(<StrategyConfigForm config={mockConfig} onChange={mockOnChange} disabled={true} />);

    const slippageInput = screen.getByLabelText(/Slippage Tolerance/i);
    const capitalInput = screen.getByLabelText(/Capital Allocation/i);

    expect(slippageInput).toBeDisabled();
    expect(capitalInput).toBeDisabled();
  });

  it('clears spread percentage when switching to instant mode', () => {
    const optimizedConfig: StrategyConfig = {
      ...mockConfig,
      executionMode: 'optimized',
      spreadPercentage: 0.5,
    };

    render(<StrategyConfigForm config={optimizedConfig} onChange={mockOnChange} />);

    const instantButton = screen.getByText('Instant');
    fireEvent.click(instantButton);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        executionMode: 'instant',
        spreadPercentage: undefined,
      })
    );
  });

  describe('Gas Cost Estimates', () => {
    it('displays estimated gas costs section', () => {
      render(<StrategyConfigForm config={mockConfig} onChange={mockOnChange} />);

      expect(screen.getByText('Estimated Gas Costs')).toBeInTheDocument();
      expect(screen.getByText(/Approximate cost to execute this strategy/i)).toBeInTheDocument();
    });

    it('shows gas cost in USD', () => {
      render(<StrategyConfigForm config={mockConfig} onChange={mockOnChange} />);

      // Should display a dollar amount (format: $X.XX)
      const gasCostElements = screen.getAllByText(/\$\d+\.\d{2}/);
      expect(gasCostElements.length).toBeGreaterThan(0);
    });

    it('shows gas units estimate', () => {
      render(<StrategyConfigForm config={mockConfig} onChange={mockOnChange} />);

      // Should display gas units with "gas" text (more specific match)
      expect(screen.getByText(/~\d+.*gas/i)).toBeInTheDocument();
    });

    it('shows gas price in Gwei', () => {
      render(<StrategyConfigForm config={mockConfig} onChange={mockOnChange} />);

      expect(screen.getByText(/Gas Price:/i)).toBeInTheDocument();
      expect(screen.getByText(/Gwei/i)).toBeInTheDocument();
    });

    it('includes gas cost in configuration summary', () => {
      render(<StrategyConfigForm config={mockConfig} onChange={mockOnChange} />);

      expect(screen.getByText('Est. Gas Cost:')).toBeInTheDocument();
    });
  });

  describe('Capital Allocation Validation', () => {
    it('validates minimum capital allocation of $10', () => {
      render(<StrategyConfigForm config={mockConfig} onChange={mockOnChange} />);

      const capitalInput = screen.getByLabelText(/Capital Allocation/i);
      
      // Enter amount below minimum
      fireEvent.change(capitalInput, { target: { value: '5' } });
      
      // Should show validation error
      expect(screen.getByText(/Minimum capital allocation is \$10/i)).toBeInTheDocument();
    });

    it('accepts capital allocation above minimum', () => {
      render(<StrategyConfigForm config={mockConfig} onChange={mockOnChange} />);

      const capitalInput = screen.getByLabelText(/Capital Allocation/i);
      
      // Enter valid amount
      fireEvent.change(capitalInput, { target: { value: '100' } });
      
      // Should not show validation error
      expect(screen.queryByText(/Minimum capital allocation/i)).not.toBeInTheDocument();
    });

    it('validates positive numbers only', () => {
      render(<StrategyConfigForm config={mockConfig} onChange={mockOnChange} />);

      const capitalInput = screen.getByLabelText(/Capital Allocation/i);
      
      // Enter negative amount
      fireEvent.change(capitalInput, { target: { value: '-100' } });
      
      // Should show validation error
      expect(screen.getByText(/must be a positive number/i)).toBeInTheDocument();
    });

    it('allows empty capital allocation (optional field)', () => {
      render(<StrategyConfigForm config={mockConfig} onChange={mockOnChange} />);

      const capitalInput = screen.getByLabelText(/Capital Allocation/i);
      
      // Clear the input
      fireEvent.change(capitalInput, { target: { value: '' } });
      
      // Should not show validation error
      expect(screen.queryByText(/must be a positive number/i)).not.toBeInTheDocument();
    });
  });

  describe('Funding Rates Display', () => {
    it('does not show funding rates by default', () => {
      render(<StrategyConfigForm config={mockConfig} onChange={mockOnChange} />);

      expect(screen.queryByText('Current Funding Rate')).not.toBeInTheDocument();
    });

    it('shows funding rates when enabled', () => {
      render(
        <StrategyConfigForm 
          config={mockConfig} 
          onChange={mockOnChange} 
          showFundingRates={true}
          strategyId="test-strategy"
        />
      );

      expect(screen.getByText('Current Funding Rate')).toBeInTheDocument();
    });

    it('displays funding rate percentage', () => {
      render(
        <StrategyConfigForm 
          config={mockConfig} 
          onChange={mockOnChange} 
          showFundingRates={true}
          strategyId="test-strategy"
        />
      );

      // Should display percentage with "per 8 hours" text
      expect(screen.getByText(/per 8 hours/i)).toBeInTheDocument();
    });

    it('shows positive funding rate indicator', () => {
      render(
        <StrategyConfigForm 
          config={mockConfig} 
          onChange={mockOnChange} 
          showFundingRates={true}
          strategyId="test-strategy"
        />
      );

      // Should show explanation for positive rates
      expect(screen.getByText(/Longs pay shorts/i)).toBeInTheDocument();
    });
  });
});
