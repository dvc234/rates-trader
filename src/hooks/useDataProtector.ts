/**
 * React hook for managing iExec Data Protector integration
 * Provides methods for strategy purchase and ownership verification
 */

import { useState, useEffect, useCallback } from 'react';
import { useWalletClient } from 'wagmi';
import { getStrategyDataProtectorService } from '@/services/StrategyDataProtectorService';
import type { PurchaseResult, OwnershipResult } from '@/services/StrategyDataProtectorService';
import type { Strategy } from '@/types/strategy';

/**
 * Hook state interface
 */
interface UseDataProtectorState {
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
}

/**
 * Hook return interface
 */
interface UseDataProtectorReturn extends UseDataProtectorState {
  /**
   * Purchase a strategy using Data Protector
   * @param strategy - Strategy to purchase
   * @param buyerAddress - Address of the buyer
   * @returns Purchase result
   */
  purchaseStrategy: (
    strategy: Strategy & { serialize(): string },
    buyerAddress: string
  ) => Promise<PurchaseResult>;

  /**
   * Check if a user owns a specific strategy
   * @param strategyId - ID of the strategy
   * @param userAddress - Address of the user
   * @returns Ownership verification result
   */
  checkOwnership: (
    strategyId: string,
    userAddress: string
  ) => Promise<OwnershipResult>;

  /**
   * Get all strategies owned by a user
   * @param userAddress - Address of the user
   * @returns Array of owned strategy IDs
   */
  getOwnedStrategies: (userAddress: string) => Promise<string[]>;

  /**
   * Manually initialize the service
   * Usually called automatically when wallet connects
   */
  initialize: () => Promise<void>;
}

/**
 * React hook for iExec Data Protector integration
 * 
 * Usage:
 * ```typescript
 * const { purchaseStrategy, checkOwnership, isInitialized } = useDataProtector();
 * 
 * // Purchase a strategy
 * const result = await purchaseStrategy(strategy, userAddress);
 * 
 * // Check ownership
 * const ownership = await checkOwnership(strategyId, userAddress);
 * ```
 */
export function useDataProtector(): UseDataProtectorReturn {
  const { data: walletClient } = useWalletClient();
  const [state, setState] = useState<UseDataProtectorState>({
    isInitialized: false,
    isInitializing: false,
    error: null,
  });

  // Get the singleton service instance
  const service = getStrategyDataProtectorService();

  /**
   * Initialize Data Protector when wallet connects
   */
  const initialize = useCallback(async () => {
    if (!walletClient) {
      setState(prev => ({
        ...prev,
        isInitialized: false,
        error: 'Wallet not connected',
      }));
      return;
    }

    // Skip if already initialized
    if (service.isReady()) {
      setState(prev => ({ ...prev, isInitialized: true, error: null }));
      return;
    }

    setState(prev => ({ ...prev, isInitializing: true, error: null }));

    try {
      // Initialize with wallet provider
      await service.initialize(walletClient);
      
      setState({
        isInitialized: true,
        isInitializing: false,
        error: null,
      });
      
      console.log('[useDataProtector] Initialized successfully');
    } catch (error: any) {
      console.error('[useDataProtector] Initialization failed:', error);
      
      setState({
        isInitialized: false,
        isInitializing: false,
        error: error.message || 'Failed to initialize Data Protector',
      });
    }
  }, [walletClient, service]);

  /**
   * Auto-initialize when wallet connects
   */
  useEffect(() => {
    if (walletClient && !state.isInitialized && !state.isInitializing) {
      initialize();
    }
  }, [walletClient, state.isInitialized, state.isInitializing, initialize]);

  /**
   * Purchase a strategy
   */
  const purchaseStrategy = useCallback(
    async (
      strategy: Strategy & { serialize(): string },
      buyerAddress: string
    ): Promise<PurchaseResult> => {
      if (!state.isInitialized) {
        return {
          success: false,
          error: 'Data Protector not initialized. Please connect your wallet.',
        };
      }

      try {
        return await service.purchaseStrategy(strategy, buyerAddress);
      } catch (error: any) {
        console.error('[useDataProtector] Purchase failed:', error);
        return {
          success: false,
          error: error.message || 'Purchase failed',
        };
      }
    },
    [state.isInitialized, service]
  );

  /**
   * Check strategy ownership
   */
  const checkOwnership = useCallback(
    async (strategyId: string, userAddress: string): Promise<OwnershipResult> => {
      if (!state.isInitialized) {
        return { isOwner: false };
      }

      try {
        return await service.checkStrategyOwnership(strategyId, userAddress);
      } catch (error: any) {
        console.error('[useDataProtector] Ownership check failed:', error);
        return { isOwner: false };
      }
    },
    [state.isInitialized, service]
  );

  /**
   * Get owned strategies
   */
  const getOwnedStrategies = useCallback(
    async (userAddress: string): Promise<string[]> => {
      if (!state.isInitialized) {
        return [];
      }

      try {
        return await service.getUserOwnedStrategies(userAddress);
      } catch (error: any) {
        console.error('[useDataProtector] Failed to get owned strategies:', error);
        return [];
      }
    },
    [state.isInitialized, service]
  );

  return {
    ...state,
    purchaseStrategy,
    checkOwnership,
    getOwnedStrategies,
    initialize,
  };
}
