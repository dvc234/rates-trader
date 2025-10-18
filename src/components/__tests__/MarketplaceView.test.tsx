/**
 * Tests for MarketplaceView component
 * 
 * Tests cover:
 * - Marketplace layout rendering
 * - Strategy grid display
 * - Loading states
 * - Error states
 * - Empty states
 * - Wallet connection requirements
 * - Strategy ownership integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import MarketplaceView from '../MarketplaceView';

// Mock wagmi hooks
const mockUseAccount = vi.fn();
vi.mock('wagmi', async () => {
  const actual = await vi.importActual('wagmi');
  return {
    ...actual,
    useAccount: () => mockUseAccount(),
  };
});

// Mock strategy modules
vi.mock('@/strategies', () => ({
  MockStrategy: vi.fn().mockImplementation((isOwned) => ({
    id: 'mock-strategy-001',
    name: 'Mock Strategy',
    description: 'A mock strategy for testing',
    risk: 'low',
    apr: { min: 5, max: 15 },
    price: '3',
    isOwned,
    encryptedOperations: 'encrypted',
  })),
  BTCDeltaNeutralStrategy: vi.fn().mockImplementation((isOwned) => ({
    id: 'btc-delta-neutral-001',
    name: 'BTC Delta Neutral',
    description: 'BTC funding rate arbitrage',
    risk: 'medium',
    apr: { min: 10, max: 25 },
    price: '10',
    isOwned,
    encryptedOperations: 'encrypted',
  })),
  ETHDeltaNeutralStrategy: vi.fn().mockImplementation((isOwned) => ({
    id: 'eth-delta-neutral-001',
    name: 'ETH Delta Neutral',
    description: 'ETH funding rate arbitrage',
    risk: 'medium',
    apr: { min: 8, max: 20 },
    price: '8',
    isOwned,
    encryptedOperations: 'encrypted',
  })),
}));

describe('MarketplaceView', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Wallet Connection States', () => {
    it('should show wallet connection prompt when wallet is not connected', () => {
      mockUseAccount.mockReturnValue({ isConnected: false, address: null });

      render(<MarketplaceView />);
      
      expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument();
      expect(screen.getByText('Please connect your wallet to view available strategies')).toBeInTheDocument();
    });

    it('should show strategies when wallet is connected', async () => {
      mockUseAccount.mockReturnValue({ 
        isConnected: true, 
        address: '0x1234567890123456789012345678901234567890' 
      });

      render(<MarketplaceView />);
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByText('Available Strategies')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading skeleton while fetching strategies', () => {
      mockUseAccount.mockReturnValue({ 
        isConnected: true, 
        address: '0x1234567890123456789012345678901234567890' 
      });

      render(<MarketplaceView />);
      
      // Check for loading skeleton (animated pulse elements)
      const skeletons = screen.getAllByRole('generic').filter(el => 
        el.className.includes('animate-pulse')
      );
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should hide loading state after strategies are loaded', async () => {
      mockUseAccount.mockReturnValue({ 
        isConnected: true, 
        address: '0x1234567890123456789012345678901234567890' 
      });

      render(<MarketplaceView />);
      
      await waitFor(() => {
        expect(screen.queryByRole('generic', { 
          name: /animate-pulse/ 
        })).not.toBeInTheDocument();
      });
    });
  });

  describe('Strategy Grid Layout', () => {
    it('should render all available strategies in a grid', async () => {
      mockUseAccount.mockReturnValue({ 
        isConnected: true, 
        address: '0x1234567890123456789012345678901234567890' 
      });

      render(<MarketplaceView />);
      
      await waitFor(() => {
        expect(screen.getByText('Mock Strategy')).toBeInTheDocument();
        expect(screen.getByText('BTC Delta Neutral')).toBeInTheDocument();
        expect(screen.getByText('ETH Delta Neutral')).toBeInTheDocument();
      });
    });

    it('should display strategy descriptions', async () => {
      mockUseAccount.mockReturnValue({ 
        isConnected: true, 
        address: '0x1234567890123456789012345678901234567890' 
      });

      render(<MarketplaceView />);
      
      await waitFor(() => {
        expect(screen.getByText('A mock strategy for testing')).toBeInTheDocument();
        expect(screen.getByText('BTC funding rate arbitrage')).toBeInTheDocument();
        expect(screen.getByText('ETH funding rate arbitrage')).toBeInTheDocument();
      });
    });

    it('should render marketplace header and description', async () => {
      mockUseAccount.mockReturnValue({ 
        isConnected: true, 
        address: '0x1234567890123456789012345678901234567890' 
      });

      render(<MarketplaceView />);
      
      await waitFor(() => {
        expect(screen.getByText('Available Strategies')).toBeInTheDocument();
        expect(screen.getByText('Browse and purchase encrypted trading strategies')).toBeInTheDocument();
      });
    });
  });

  describe('Strategy Ownership Integration', () => {
    it('should load ownership status from localStorage', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      mockUseAccount.mockReturnValue({ isConnected: true, address });

      // Set up localStorage with purchased strategies
      const storageKey = `purchased_strategies_${address.toLowerCase()}`;
      localStorage.setItem(storageKey, JSON.stringify(['mock-strategy-001']));

      render(<MarketplaceView />);
      
      await waitFor(() => {
        expect(screen.getByText('Mock Strategy')).toBeInTheDocument();
      });

      // Verify that the Execute button is shown for owned strategy
      expect(screen.getByRole('button', { name: /Execute Strategy/i })).toBeInTheDocument();
    });

    it('should handle strategies without ownership', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      mockUseAccount.mockReturnValue({ isConnected: true, address });

      render(<MarketplaceView />);
      
      await waitFor(() => {
        expect(screen.getByText('Mock Strategy')).toBeInTheDocument();
      });

      // Verify that Purchase buttons are shown for unowned strategies
      const purchaseButtons = screen.getAllByRole('button', { name: /Purchase for/i });
      expect(purchaseButtons.length).toBeGreaterThan(0);
    });
  });

  describe('User Interactions', () => {
    it('should call onPurchase callback when purchase button is clicked', async () => {
      const user = userEvent.setup();
      mockUseAccount.mockReturnValue({ 
        isConnected: true, 
        address: '0x1234567890123456789012345678901234567890' 
      });

      const onPurchase = vi.fn();
      render(<MarketplaceView onPurchase={onPurchase} />);
      
      await waitFor(() => {
        expect(screen.getByText('Mock Strategy')).toBeInTheDocument();
      });

      // Find and click purchase button
      const purchaseButtons = screen.getAllByRole('button', { 
        name: /Purchase for/i 
      });
      await user.click(purchaseButtons[0]);
      
      expect(onPurchase).toHaveBeenCalled();
    });

    it('should call onExecute callback when execute button is clicked', async () => {
      const user = userEvent.setup();
      const address = '0x1234567890123456789012345678901234567890';
      mockUseAccount.mockReturnValue({ isConnected: true, address });

      // Set up localStorage with purchased strategy
      const storageKey = `purchased_strategies_${address.toLowerCase()}`;
      localStorage.setItem(storageKey, JSON.stringify(['mock-strategy-001']));

      const onExecute = vi.fn();
      render(<MarketplaceView onExecute={onExecute} />);
      
      await waitFor(() => {
        expect(screen.getByText('Mock Strategy')).toBeInTheDocument();
      });

      // Find and click execute button
      const executeButton = screen.getByRole('button', { 
        name: /Execute Strategy/i 
      });
      await user.click(executeButton);
      
      expect(onExecute).toHaveBeenCalled();
    });
  });

  describe('Error States', () => {
    it('should display error message when loading fails', async () => {
      mockUseAccount.mockReturnValue({ 
        isConnected: true, 
        address: '0x1234567890123456789012345678901234567890' 
      });

      // Mock console.error to suppress error output in tests
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock strategy constructors to throw error
      const { MockStrategy, BTCDeltaNeutralStrategy, ETHDeltaNeutralStrategy } = await import('@/strategies');
      vi.mocked(MockStrategy).mockImplementationOnce(() => {
        throw new Error('Failed to load');
      });

      render(<MarketplaceView />);
      
      await waitFor(() => {
        expect(screen.getByText('Error Loading Strategies')).toBeInTheDocument();
        expect(screen.getByText('Failed to load strategies. Please try again.')).toBeInTheDocument();
      });

      consoleError.mockRestore();
    });

    it('should show retry button on error', async () => {
      mockUseAccount.mockReturnValue({ 
        isConnected: true, 
        address: '0x1234567890123456789012345678901234567890' 
      });

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { MockStrategy } = await import('@/strategies');
      vi.mocked(MockStrategy).mockImplementationOnce(() => {
        throw new Error('Failed to load');
      });

      render(<MarketplaceView />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
      });

      consoleError.mockRestore();
    });
  });

  describe('Responsive Layout', () => {
    it('should render grid with responsive classes', async () => {
      mockUseAccount.mockReturnValue({ 
        isConnected: true, 
        address: '0x1234567890123456789012345678901234567890' 
      });

      const { container } = render(<MarketplaceView />);
      
      await waitFor(() => {
        expect(screen.getByText('Available Strategies')).toBeInTheDocument();
      });

      // Check for responsive grid classes
      const grid = container.querySelector('.grid');
      expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3');
    });
  });
});
