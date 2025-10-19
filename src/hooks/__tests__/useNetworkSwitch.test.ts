/**
 * Tests for useNetworkSwitch hook
 * 
 * Tests network switching functionality including:
 * - Network detection
 * - Base mainnet switching
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useNetworkSwitch } from '../useNetworkSwitch';
import { base } from '@reown/appkit/networks';

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useAccount: vi.fn(() => ({ isConnected: true })),
  useChainId: vi.fn(() => 421614), // Default to Arbitrum Sepolia
  useSwitchChain: vi.fn(() => ({
    switchChain: vi.fn(),
    isPending: false,
  })),
}));

describe('useNetworkSwitch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Network Detection', () => {
    it('should detect when on Base mainnet', async () => {
      const { useChainId } = await import('wagmi');
      vi.mocked(useChainId).mockReturnValue(base.id);

      const { result } = renderHook(() => useNetworkSwitch());

      expect(result.current.isOnBase()).toBe(true);
      expect(result.current.getCurrentNetworkName()).toBe('Base');
    });

    it('should detect when not on Base mainnet', async () => {
      const { useChainId } = await import('wagmi');
      vi.mocked(useChainId).mockReturnValue(421614); // Arbitrum Sepolia

      const { result } = renderHook(() => useNetworkSwitch());

      expect(result.current.isOnBase()).toBe(false);
      expect(result.current.getCurrentNetworkName()).toBe('Arbitrum Sepolia');
    });

    it('should detect Bellecour network', async () => {
      const { useChainId } = await import('wagmi');
      vi.mocked(useChainId).mockReturnValue(134); // Bellecour

      const { result } = renderHook(() => useNetworkSwitch());

      expect(result.current.getCurrentNetworkName()).toBe('Bellecour');
    });

    it('should handle unknown networks', async () => {
      const { useChainId } = await import('wagmi');
      vi.mocked(useChainId).mockReturnValue(999999);

      const { result } = renderHook(() => useNetworkSwitch());

      expect(result.current.getCurrentNetworkName()).toBe('Unknown Network');
    });
  });

  describe('Network Switching', () => {
    it('should successfully switch to Base mainnet', async () => {
      const mockSwitchChain = vi.fn().mockResolvedValue(undefined);
      const { useSwitchChain, useChainId } = await import('wagmi');
      
      vi.mocked(useChainId).mockReturnValue(421614); // Start on Arbitrum Sepolia
      vi.mocked(useSwitchChain).mockReturnValue({
        switchChain: mockSwitchChain,
        isPending: false,
      } as any);

      const { result } = renderHook(() => useNetworkSwitch());

      const switchResult = await result.current.switchToBase();

      expect(switchResult.success).toBe(true);
      expect(mockSwitchChain).toHaveBeenCalledWith({ chainId: base.id });
    });

    it('should skip switching if already on Base', async () => {
      const mockSwitchChain = vi.fn();
      const { useSwitchChain, useChainId } = await import('wagmi');
      
      vi.mocked(useChainId).mockReturnValue(base.id); // Already on Base
      vi.mocked(useSwitchChain).mockReturnValue({
        switchChain: mockSwitchChain,
        isPending: false,
      } as any);

      const { result } = renderHook(() => useNetworkSwitch());

      const switchResult = await result.current.switchToBase();

      expect(switchResult.success).toBe(true);
      expect(mockSwitchChain).not.toHaveBeenCalled();
    });

    it('should handle user rejection', async () => {
      const mockSwitchChain = vi.fn().mockRejectedValue({
        code: 4001,
        message: 'User rejected',
      });
      const { useSwitchChain, useChainId } = await import('wagmi');
      
      vi.mocked(useChainId).mockReturnValue(421614);
      vi.mocked(useSwitchChain).mockReturnValue({
        switchChain: mockSwitchChain,
        isPending: false,
      } as any);

      const { result } = renderHook(() => useNetworkSwitch());

      const switchResult = await result.current.switchToBase();

      expect(switchResult.success).toBe(false);
      expect(switchResult.error).toContain('cancelled');
    });

    it('should handle unrecognized chain error', async () => {
      const mockSwitchChain = vi.fn().mockRejectedValue({
        code: 4902,
        message: 'Unrecognized chain',
      });
      const { useSwitchChain, useChainId } = await import('wagmi');
      
      vi.mocked(useChainId).mockReturnValue(421614);
      vi.mocked(useSwitchChain).mockReturnValue({
        switchChain: mockSwitchChain,
        isPending: false,
      } as any);

      const { result } = renderHook(() => useNetworkSwitch());

      const switchResult = await result.current.switchToBase();

      expect(switchResult.success).toBe(false);
      expect(switchResult.error).toContain('not configured');
    });

    it('should require wallet connection', async () => {
      const { useAccount } = await import('wagmi');
      vi.mocked(useAccount).mockReturnValue({ isConnected: false } as any);

      const { result } = renderHook(() => useNetworkSwitch());

      const switchResult = await result.current.switchToBase();

      expect(switchResult.success).toBe(false);
      expect(switchResult.error).toContain('connect your wallet');
    });
  });

  describe('Generic Network Switching', () => {
    it('should switch to any network by chain ID', async () => {
      const mockSwitchChain = vi.fn(async () => {
        // Simulate successful switch
        return Promise.resolve();
      });
      const { useSwitchChain, useChainId, useAccount } = await import('wagmi');
      
      vi.mocked(useAccount).mockReturnValue({ isConnected: true } as any);
      vi.mocked(useChainId).mockReturnValue(421614);
      vi.mocked(useSwitchChain).mockReturnValue({
        switchChain: mockSwitchChain,
        isPending: false,
      } as any);

      const { result } = renderHook(() => useNetworkSwitch());

      const switchResult = await result.current.switchToNetwork(134, 'Bellecour');

      expect(switchResult.success).toBe(true);
      expect(mockSwitchChain).toHaveBeenCalledWith({ chainId: 134 });
    });

    it('should check if on specific network', async () => {
      const { useChainId } = await import('wagmi');
      vi.mocked(useChainId).mockReturnValue(134);

      const { result } = renderHook(() => useNetworkSwitch());

      expect(result.current.isOnNetwork(134)).toBe(true);
      expect(result.current.isOnNetwork(8453)).toBe(false);
    });
  });
});
