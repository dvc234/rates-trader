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
});
