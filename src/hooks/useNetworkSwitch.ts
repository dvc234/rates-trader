/**
 * useNetworkSwitch Hook
 * 
 * Custom hook for handling network switching in the application.
 * Provides utilities to check current network and prompt users to switch networks.
 * 
 * Network Architecture:
 * - Arbitrum Sepolia: For RLC payments and strategy purchases
 * - Base Mainnet: For strategy execution (DEX interactions, perpetual shorts)
 * - Bellecour: For iExec Data Protector operations
 * 
 * @hook
 */

import { useAccount, useSwitchChain, useChainId } from 'wagmi';
import { base } from '@reown/appkit/networks';

/**
 * Network switching result
 */
export interface NetworkSwitchResult {
  success: boolean;
  error?: string;
}

/**
 * Hook for network switching functionality
 * 
 * Features:
 * - Check if user is on correct network
 * - Prompt user to switch networks
 * - Handle network switch errors
 * - Support for multiple target networks
 * 
 * @returns Network switching utilities
 */
export function useNetworkSwitch() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  /**
   * Check if user is currently on Base mainnet
   * 
   * Base mainnet is required for strategy execution because:
   * - DEX interactions (1inch Fusion) happen on Base
   * - Perpetual shorts are opened on Base
   * - All strategy operations execute on Base
   * 
   * @returns true if on Base mainnet, false otherwise
   */
  const isOnBase = (): boolean => {
    return chainId === base.id; // Base mainnet chain ID: 8453
  };

  /**
   * Check if user is on a specific network
   * 
   * @param targetChainId - Chain ID to check
   * @returns true if on target network, false otherwise
   */
  const isOnNetwork = (targetChainId: number): boolean => {
    return chainId === targetChainId;
  };

  /**
   * Get current network name
   * 
   * @returns Human-readable network name
   */
  const getCurrentNetworkName = (): string => {
    switch (chainId) {
      case 8453:
        return 'Base';
      case 421614:
        return 'Arbitrum Sepolia';
      case 42161:
        return 'Arbitrum One';
      case 134:
        return 'Bellecour';
      default:
        return 'Unknown Network';
    }
  };

  /**
   * Switch to Base mainnet
   * 
   * This method prompts the user to switch their wallet to Base mainnet.
   * Required before executing strategies since all DEX interactions happen on Base.
   * 
   * Network Switch Flow:
   * 1. Check if wallet is connected
   * 2. Check if already on Base (skip if yes)
   * 3. Request network switch via wagmi
   * 4. Wait for user approval in wallet
   * 5. Return success/error result
   * 
   * Error Handling:
   * - User rejects switch: Returns error with user-friendly message
   * - Network not configured: Returns error prompting to add Base to wallet
   * - Other errors: Returns generic error message
   * 
   * @returns Promise resolving to switch result
   * 
   * @example
   * ```typescript
   * const { switchToBase } = useNetworkSwitch();
   * 
   * const handleExecute = async () => {
   *   const result = await switchToBase();
   *   if (!result.success) {
   *     alert(result.error);
   *     return;
   *   }
   *   // Proceed with execution on Base
   * };
   * ```
   */
  const switchToBase = async (): Promise<NetworkSwitchResult> => {
    // Check if wallet is connected
    if (!isConnected) {
      return {
        success: false,
        error: 'Please connect your wallet first',
      };
    }

    // Check if already on Base
    if (isOnBase()) {
      return {
        success: true,
      };
    }

    try {
      console.log('[NetworkSwitch] Requesting switch to Base mainnet...');
      console.log('[NetworkSwitch] Current network:', getCurrentNetworkName(), `(${chainId})`);

      // Request network switch via wagmi
      // This will prompt the user's wallet to switch networks
      await switchChain({ chainId: base.id });

      console.log('[NetworkSwitch] Successfully switched to Base mainnet');

      return {
        success: true,
      };
    } catch (error: any) {
      console.error('[NetworkSwitch] Failed to switch network:', error);

      // Handle specific error cases with user-friendly messages
      if (error.code === 4001 || error.message?.includes('User rejected')) {
        return {
          success: false,
          error: 'Network switch was cancelled. Please switch to Base mainnet to execute strategies.',
        };
      }

      if (error.code === 4902 || error.message?.includes('Unrecognized chain')) {
        return {
          success: false,
          error: 'Base mainnet is not configured in your wallet. Please add it manually.',
        };
      }

      // Generic error message
      return {
        success: false,
        error: `Failed to switch network: ${error.message || 'Unknown error'}`,
      };
    }
  };

  /**
   * Switch to a specific network by chain ID
   * 
   * Generic network switching method for any supported network.
   * 
   * @param targetChainId - Chain ID to switch to
   * @param networkName - Human-readable network name for error messages
   * @returns Promise resolving to switch result
   */
  const switchToNetwork = async (
    targetChainId: number,
    networkName: string
  ): Promise<NetworkSwitchResult> => {
    // Check if wallet is connected
    if (!isConnected) {
      return {
        success: false,
        error: 'Please connect your wallet first',
      };
    }

    // Check if already on target network
    if (isOnNetwork(targetChainId)) {
      return {
        success: true,
      };
    }

    try {
      console.log(`[NetworkSwitch] Requesting switch to ${networkName}...`);
      console.log('[NetworkSwitch] Current network:', getCurrentNetworkName(), `(${chainId})`);

      // Request network switch via wagmi
      await switchChain({ chainId: targetChainId });

      console.log(`[NetworkSwitch] Successfully switched to ${networkName}`);

      return {
        success: true,
      };
    } catch (error: any) {
      console.error('[NetworkSwitch] Failed to switch network:', error);

      // Handle specific error cases
      if (error.code === 4001 || error.message?.includes('User rejected')) {
        return {
          success: false,
          error: `Network switch was cancelled. Please switch to ${networkName} to continue.`,
        };
      }

      if (error.code === 4902 || error.message?.includes('Unrecognized chain')) {
        return {
          success: false,
          error: `${networkName} is not configured in your wallet. Please add it manually.`,
        };
      }

      // Generic error message
      return {
        success: false,
        error: `Failed to switch network: ${error.message || 'Unknown error'}`,
      };
    }
  };

  return {
    // Network status
    isOnBase,
    isOnNetwork,
    getCurrentNetworkName,
    currentChainId: chainId,
    
    // Network switching
    switchToBase,
    switchToNetwork,
    isSwitching,
  };
}
