/**
 * Tests for AppLayout component
 * 
 * Tests cover:
 * - Navigation between tabs
 * - Tab content rendering
 * - Wallet connection integration
 * - Network switching
 * - Responsive layout
 * - Active tab styling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import AppLayout from '../AppLayout';

// Mock functions
const mockUseAppKit = vi.fn();
const mockUseAccount = vi.fn();
const mockUseDisconnect = vi.fn();
const mockUseChainId = vi.fn();
const mockUseSwitchChain = vi.fn();

// Mock Reown AppKit
vi.mock('@reown/appkit/react', () => ({
  useAppKit: () => mockUseAppKit(),
}));

// Mock wagmi hooks
vi.mock('wagmi', async () => {
  const actual = await vi.importActual('wagmi');
  return {
    ...actual,
    useAccount: () => mockUseAccount(),
    useDisconnect: () => mockUseDisconnect(),
    useChainId: () => mockUseChainId(),
    useSwitchChain: () => mockUseSwitchChain(),
  };
});

// Mock wagmi networks
vi.mock('@/config/wagmiNetworks', () => ({
  default: {
    arbitrumSepolia: {
      id: 421614,
      name: 'Arbitrum Sepolia',
    },
    base: {
      id: 8453,
      name: 'Base',
    },
  },
}));

describe('AppLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    mockUseAppKit.mockReturnValue({ open: vi.fn() });
    mockUseAccount.mockReturnValue({ isConnected: false });
    mockUseDisconnect.mockReturnValue({ disconnectAsync: vi.fn() });
    mockUseChainId.mockReturnValue(421614);
    mockUseSwitchChain.mockReturnValue({ switchChain: vi.fn() });
  });

  describe('Layout Structure', () => {
    it('should render navigation bar with brand name', () => {
      render(<AppLayout />);
      
      expect(screen.getByText('DeFi Strategy Platform')).toBeInTheDocument();
    });

    it('should render both tab buttons', () => {
      render(<AppLayout />);
      
      expect(screen.getByRole('tab', { name: /marketplace/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /my strategies/i })).toBeInTheDocument();
    });

    it('should have sticky navigation bar', () => {
      const { container } = render(<AppLayout />);
      
      const nav = container.querySelector('nav');
      expect(nav).toHaveClass('sticky', 'top-0');
    });
  });

  describe('Tab Navigation', () => {
    it('should show marketplace tab as active by default', () => {
      render(<AppLayout />);
      
      const marketplaceTab = screen.getByRole('tab', { name: /marketplace/i });
      expect(marketplaceTab).toHaveClass('text-primary', 'border-b-2', 'border-primary');
    });

    it('should switch to My Strategies tab when clicked', async () => {
      const user = userEvent.setup();
      render(<AppLayout />);
      
      const myStrategiesTab = screen.getByRole('tab', { name: /my strategies/i });
      await user.click(myStrategiesTab);
      
      expect(myStrategiesTab).toHaveClass('text-primary', 'border-b-2', 'border-primary');
    });

    it('should switch back to Marketplace tab when clicked', async () => {
      const user = userEvent.setup();
      render(<AppLayout />);
      
      // Click My Strategies first
      const myStrategiesTab = screen.getByRole('tab', { name: /my strategies/i });
      await user.click(myStrategiesTab);
      
      // Click Marketplace
      const marketplaceTab = screen.getByRole('tab', { name: /marketplace/i });
      await user.click(marketplaceTab);
      
      expect(marketplaceTab).toHaveClass('text-primary', 'border-b-2', 'border-primary');
    });

    it('should remove active styling from inactive tab', async () => {
      const user = userEvent.setup();
      render(<AppLayout />);
      
      const marketplaceTab = screen.getByRole('tab', { name: /marketplace/i });
      const myStrategiesTab = screen.getByRole('tab', { name: /my strategies/i });
      
      await user.click(myStrategiesTab);
      
      expect(marketplaceTab).not.toHaveClass('text-primary', 'border-b-2', 'border-primary');
      expect(marketplaceTab).toHaveClass('text-gray-600');
    });
  });

  describe('Tab Content Rendering', () => {
    it('should render marketplace content by default', () => {
      const marketplaceContent = <div>Marketplace Content</div>;
      render(<AppLayout marketplaceContent={marketplaceContent} />);
      
      expect(screen.getByText('Marketplace Content')).toBeInTheDocument();
    });

    it('should render my strategies content when tab is active', async () => {
      const user = userEvent.setup();
      const myStrategiesContent = <div>My Strategies Content</div>;
      
      render(<AppLayout myStrategiesContent={myStrategiesContent} />);
      
      const myStrategiesTab = screen.getByRole('tab', { name: /my strategies/i });
      await user.click(myStrategiesTab);
      
      expect(screen.getByText('My Strategies Content')).toBeInTheDocument();
    });

    it('should not render marketplace content when My Strategies tab is active', async () => {
      const user = userEvent.setup();
      const marketplaceContent = <div>Marketplace Content</div>;
      const myStrategiesContent = <div>My Strategies Content</div>;
      
      render(
        <AppLayout 
          marketplaceContent={marketplaceContent}
          myStrategiesContent={myStrategiesContent}
        />
      );
      
      const myStrategiesTab = screen.getByRole('tab', { name: /my strategies/i });
      await user.click(myStrategiesTab);
      
      expect(screen.queryByText('Marketplace Content')).not.toBeInTheDocument();
    });

    it('should render default content when no content provided', () => {
      render(<AppLayout />);
      
      expect(screen.getByRole('heading', { name: /Marketplace/i })).toBeInTheDocument();
      expect(screen.getByText('Browse and purchase encrypted trading strategies')).toBeInTheDocument();
    });
  });

  describe('Wallet Connection', () => {
    it('should show Connect Wallet button when not connected', () => {
      mockUseAccount.mockReturnValue({ isConnected: false });

      render(<AppLayout />);
      
      expect(screen.getByRole('button', { name: /Connect Wallet/i })).toBeInTheDocument();
    });

    it('should show Disconnect button when connected', () => {
      mockUseAccount.mockReturnValue({ isConnected: true });

      render(<AppLayout />);
      
      expect(screen.getByRole('button', { name: /Disconnect/i })).toBeInTheDocument();
    });

    it('should call open modal when Connect Wallet is clicked', async () => {
      const user = userEvent.setup();
      
      const openMock = vi.fn();
      mockUseAppKit.mockReturnValue({ open: openMock });
      mockUseAccount.mockReturnValue({ isConnected: false });

      render(<AppLayout />);
      
      const connectButton = screen.getByRole('button', { name: /Connect Wallet/i });
      await user.click(connectButton);
      
      expect(openMock).toHaveBeenCalledWith({ view: 'Connect' });
    });

    it('should call disconnect when Disconnect button is clicked', async () => {
      const user = userEvent.setup();
      
      const disconnectMock = vi.fn();
      mockUseAccount.mockReturnValue({ isConnected: true });
      mockUseDisconnect.mockReturnValue({ disconnectAsync: disconnectMock });

      render(<AppLayout />);
      
      const disconnectButton = screen.getByRole('button', { name: /Disconnect/i });
      await user.click(disconnectButton);
      
      expect(disconnectMock).toHaveBeenCalled();
    });
  });

  describe('Network Switching', () => {
    it('should show network selector when wallet is connected', () => {
      mockUseAccount.mockReturnValue({ isConnected: true });

      render(<AppLayout />);
      
      expect(screen.getByLabelText(/Chain:/i)).toBeInTheDocument();
    });

    it('should not show network selector when wallet is not connected', () => {
      mockUseAccount.mockReturnValue({ isConnected: false });

      render(<AppLayout />);
      
      expect(screen.queryByLabelText(/Chain:/i)).not.toBeInTheDocument();
    });

    it('should display available networks in selector', () => {
      mockUseAccount.mockReturnValue({ isConnected: true });

      render(<AppLayout />);
      
      expect(screen.getByText('Arbitrum Sepolia')).toBeInTheDocument();
      expect(screen.getByText('Base')).toBeInTheDocument();
    });

    it('should call switchChain when network is changed', async () => {
      const user = userEvent.setup();
      
      const switchChainMock = vi.fn();
      mockUseAccount.mockReturnValue({ isConnected: true });
      mockUseSwitchChain.mockReturnValue({ switchChain: switchChainMock });

      render(<AppLayout />);
      
      const selector = screen.getByLabelText(/Chain:/i);
      await user.selectOptions(selector, '8453');
      
      expect(switchChainMock).toHaveBeenCalledWith({ chainId: 8453 });
    });

    it('should not call switchChain when selecting current network', async () => {
      const user = userEvent.setup();
      
      const switchChainMock = vi.fn();
      mockUseAccount.mockReturnValue({ isConnected: true });
      mockUseChainId.mockReturnValue(421614);
      mockUseSwitchChain.mockReturnValue({ switchChain: switchChainMock });

      render(<AppLayout />);
      
      const selector = screen.getByLabelText(/Chain:/i);
      await user.selectOptions(selector, '421614');
      
      expect(switchChainMock).not.toHaveBeenCalled();
    });
  });

  describe('Responsive Design', () => {
    it('should have responsive padding classes', () => {
      const { container } = render(<AppLayout />);
      
      const mainContent = container.querySelector('.max-w-7xl');
      expect(mainContent).toHaveClass('px-4', 'sm:px-6', 'lg:px-8');
    });

    it('should hide Chain label on small screens', () => {
      mockUseAccount.mockReturnValue({ isConnected: true });

      render(<AppLayout />);
      
      const label = screen.getByText('Chain:');
      expect(label).toHaveClass('hidden', 'md:block');
    });
  });

  describe('Tab Icons', () => {
    it('should render shopping cart icon for Marketplace tab', () => {
      const { container } = render(<AppLayout />);
      
      const marketplaceTab = screen.getByRole('tab', { name: /marketplace/i });
      const svg = marketplaceTab.querySelector('svg');
      
      expect(svg).toBeInTheDocument();
    });

    it('should render document icon for My Strategies tab', () => {
      const { container } = render(<AppLayout />);
      
      const myStrategiesTab = screen.getByRole('tab', { name: /my strategies/i });
      const svg = myStrategiesTab.querySelector('svg');
      
      expect(svg).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle disconnect errors gracefully', async () => {
      const user = userEvent.setup();
      
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const disconnectMock = vi.fn().mockRejectedValue(new Error('Disconnect failed'));
      
      mockUseAccount.mockReturnValue({ isConnected: true });
      mockUseDisconnect.mockReturnValue({ disconnectAsync: disconnectMock });

      render(<AppLayout />);
      
      const disconnectButton = screen.getByRole('button', { name: /Disconnect/i });
      await user.click(disconnectButton);
      
      expect(consoleError).toHaveBeenCalledWith('Failed to logout:', expect.any(Error));
      
      consoleError.mockRestore();
    });

    it('should handle network switch errors gracefully', async () => {
      const user = userEvent.setup();
      
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const switchChainMock = vi.fn(() => {
        throw new Error('Switch failed');
      });
      
      mockUseAccount.mockReturnValue({ isConnected: true });
      mockUseSwitchChain.mockReturnValue({ switchChain: switchChainMock });

      render(<AppLayout />);
      
      const selector = screen.getByLabelText(/Chain:/i);
      await user.selectOptions(selector, '8453');
      
      // Wait a bit for the error to be logged
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(consoleError).toHaveBeenCalledWith('Failed to switch chain:', expect.any(Error));
      
      consoleError.mockRestore();
    });
  });
});
