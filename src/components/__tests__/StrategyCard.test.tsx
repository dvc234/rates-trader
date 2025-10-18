/**
 * Tests for StrategyCard component
 * 
 * Tests cover:
 * - Strategy card rendering with all details
 * - Risk level color coding
 * - Conditional button rendering (purchase vs execute)
 * - Loading states
 * - User interactions
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import StrategyCard from '../StrategyCard';
import { Strategy } from '@/types/strategy';

describe('StrategyCard', () => {
  // Mock strategy data for testing
  const mockUnownedStrategy: Strategy = {
    id: 'test-strategy-001',
    name: 'Test Strategy',
    description: 'A test strategy for unit testing',
    risk: 'medium',
    apr: { min: 10, max: 20 },
    price: '5',
    isOwned: false,
    encryptedOperations: 'encrypted-data',
  };

  const mockOwnedStrategy: Strategy = {
    ...mockUnownedStrategy,
    isOwned: true,
  };

  describe('Rendering', () => {
    it('should render strategy name and description', () => {
      render(<StrategyCard strategy={mockUnownedStrategy} />);
      
      expect(screen.getByText('Test Strategy')).toBeInTheDocument();
      expect(screen.getByText('A test strategy for unit testing')).toBeInTheDocument();
    });

    it('should render risk level with correct styling', () => {
      render(<StrategyCard strategy={mockUnownedStrategy} />);
      
      const riskBadge = screen.getByText('Medium');
      expect(riskBadge).toBeInTheDocument();
      expect(riskBadge).toHaveClass('text-yellow-600', 'bg-yellow-50');
    });

    it('should render low risk with green styling', () => {
      const lowRiskStrategy = { ...mockUnownedStrategy, risk: 'low' as const };
      render(<StrategyCard strategy={lowRiskStrategy} />);
      
      const riskBadge = screen.getByText('Low');
      expect(riskBadge).toHaveClass('text-green-600', 'bg-green-50');
    });

    it('should render high risk with red styling', () => {
      const highRiskStrategy = { ...mockUnownedStrategy, risk: 'high' as const };
      render(<StrategyCard strategy={highRiskStrategy} />);
      
      const riskBadge = screen.getByText('High');
      expect(riskBadge).toHaveClass('text-red-600', 'bg-red-50');
    });

    it('should render APR range', () => {
      render(<StrategyCard strategy={mockUnownedStrategy} />);
      
      expect(screen.getByText('10% - 20%')).toBeInTheDocument();
    });

    it('should render price in RLC', () => {
      render(<StrategyCard strategy={mockUnownedStrategy} />);
      
      expect(screen.getByText('5 RLC')).toBeInTheDocument();
    });
  });

  describe('Conditional Button Rendering', () => {
    it('should render purchase button for unowned strategy', () => {
      render(<StrategyCard strategy={mockUnownedStrategy} />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('Purchase for 5 RLC');
      expect(button).toHaveClass('secondary');
    });

    it('should render execute button for owned strategy', () => {
      render(<StrategyCard strategy={mockOwnedStrategy} />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('Execute Strategy');
      expect(button).toHaveClass('primary');
    });
  });

  describe('User Interactions', () => {
    it('should call onPurchase when purchase button is clicked', async () => {
      const user = userEvent.setup();
      const onPurchase = vi.fn();
      
      render(
        <StrategyCard 
          strategy={mockUnownedStrategy} 
          onPurchase={onPurchase}
        />
      );
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(onPurchase).toHaveBeenCalledWith('test-strategy-001');
      expect(onPurchase).toHaveBeenCalledTimes(1);
    });

    it('should call onExecute when execute button is clicked', async () => {
      const user = userEvent.setup();
      const onExecute = vi.fn();
      
      render(
        <StrategyCard 
          strategy={mockOwnedStrategy} 
          onExecute={onExecute}
        />
      );
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(onExecute).toHaveBeenCalledWith('test-strategy-001');
      expect(onExecute).toHaveBeenCalledTimes(1);
    });

    it('should not call callbacks when button is disabled', async () => {
      const user = userEvent.setup();
      const onPurchase = vi.fn();
      
      render(
        <StrategyCard 
          strategy={mockUnownedStrategy} 
          onPurchase={onPurchase}
          isLoading={true}
        />
      );
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(onPurchase).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('should render loading spinner when isLoading is true', () => {
      render(
        <StrategyCard 
          strategy={mockUnownedStrategy} 
          isLoading={true}
        />
      );
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should not render loading state when isLoading is false', () => {
      render(
        <StrategyCard 
          strategy={mockUnownedStrategy} 
          isLoading={false}
        />
      );
      
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing callbacks gracefully', async () => {
      const user = userEvent.setup();
      
      render(<StrategyCard strategy={mockUnownedStrategy} />);
      
      const button = screen.getByRole('button');
      // Should not throw error when clicking without callbacks
      await user.click(button);
    });

    it('should render with minimal strategy data', () => {
      const minimalStrategy: Strategy = {
        id: 'minimal',
        name: 'Minimal',
        description: 'Test',
        risk: 'low',
        apr: { min: 0, max: 0 },
        price: '0',
        isOwned: false,
        encryptedOperations: '',
      };
      
      render(<StrategyCard strategy={minimalStrategy} />);
      
      expect(screen.getByText('Minimal')).toBeInTheDocument();
      expect(screen.getByText('Test')).toBeInTheDocument();
    });
  });
});
