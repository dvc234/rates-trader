/**
 * MyStrategiesView Component
 * 
 * Displays the user's purchased strategies with wallet information.
 * Shows only strategies that have been purchased by the connected wallet.
 * 
 * @component
 */

'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Strategy } from '@/types/strategy';
import { MockStrategy, BTCDeltaNeutralStrategy, ETHDeltaNeutralStrategy } from '@/strategies';
import StrategyCard from './StrategyCard';

/**
 * Props for the MyStrategiesView component
 */
interface MyStrategiesViewProps {
  /** Callback when a strategy is executed */
  onExecute?: (strategyId: string) => void;
}

/**
 * MyStrategiesView displays purchased strategies for the connected wallet
 * 
 * Features:
 * - Shows connected wallet address
 * - Displays only owned strategies
 * - Card-based layout matching marketplace
 * - Empty state when no strategies owned
 * 
 * Note: Currently uses localStorage for tracking purchases (temporary).
 * Will be replaced with iExec Data Protector in Phase 2 for on-chain verification.
 */
export default function MyStrategiesView({
  onExecute
}: MyStrategiesViewProps) {
  // State management
  const [ownedStrategies, setOwnedStrategies] = useState<Strategy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Get wallet connection info
  const { address, isConnected } = useAccount();

  /**
   * Load owned strategies for the connected wallet
   * 
   * Current Implementation (Temporary):
   * - Uses localStorage to track purchases per wallet address
   * - Key format: `purchased_strategies_${address}`
   * 
   * Future Implementation (Phase 2):
   * - Query iExec Data Protector for owned protected data
   * - Use DataProtector.fetchGrantedAccess(userAddress) to get owned strategies
   * - Verify on-chain ownership through smart contract events
   */
  useEffect(() => {
    const loadOwnedStrategies = async () => {
      if (!address || !isConnected) {
        setOwnedStrategies([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Get purchased strategy IDs from localStorage (temporary solution)
        const storageKey = `purchased_strategies_${address.toLowerCase()}`;
        const purchasedIds = JSON.parse(localStorage.getItem(storageKey) || '[]') as string[];
        
        // Create all strategy instances
        const allStrategies = [
          new MockStrategy(false),
          new BTCDeltaNeutralStrategy(false),
          new ETHDeltaNeutralStrategy(false)
        ];
        
        // Filter to only owned strategies and mark as owned
        const owned = allStrategies
          .filter(strategy => purchasedIds.includes(strategy.id))
          .map(strategy => ({ ...strategy, isOwned: true }));
        
        setOwnedStrategies(owned);
      } catch (err) {
        console.error('Failed to load owned strategies:', err);
        setOwnedStrategies([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadOwnedStrategies();
  }, [address, isConnected]);

  /**
   * Handles strategy execution
   */
  const handleExecute = (strategyId: string) => {
    if (onExecute) {
      onExecute(strategyId);
    }
  };

  // Show wallet connection prompt if not connected
  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">
          Connect Your Wallet
        </h3>
        <p className="text-gray-600">
          Please connect your wallet to view your strategies
        </p>
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div>
        {/* Wallet Info Skeleton */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 animate-pulse">
          <div className="h-4 bg-blue-200 rounded w-32 mb-2"></div>
          <div className="h-6 bg-blue-200 rounded w-64"></div>
        </div>

        {/* Strategy Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse"
            >
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6 mb-6"></div>
              <div className="space-y-3 mb-6">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
              </div>
              <div className="h-11 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Connected Wallet Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-600 font-medium">Connected Wallet</p>
            <p className="text-sm font-mono text-gray-800 font-semibold">
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Owned Strategies Section */}
      {ownedStrategies.length === 0 ? (
        // Empty state - no strategies owned
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            No Strategies Yet
          </h3>
          <p className="text-gray-600 mb-4">
            You haven&apos;t purchased any strategies yet. Visit the Marketplace to get started.
          </p>
        </div>
      ) : (
        // Display owned strategies
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              My Strategies
            </h2>
            <p className="text-gray-600">
              {ownedStrategies.length} {ownedStrategies.length === 1 ? 'strategy' : 'strategies'} ready to execute
            </p>
          </div>

          {/* Responsive grid matching marketplace layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ownedStrategies.map((strategy) => (
              <StrategyCard
                key={strategy.id}
                strategy={strategy}
                onExecute={handleExecute}
              />
            ))}
          </div>
        </div>
      )}

      {/* Info Box about Data Protector Integration */}
      <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg
              className="w-5 h-5 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm text-yellow-800">
              <strong>Development Note:</strong> Strategy ownership is currently tracked using localStorage. 
              In Phase 2, this will be replaced with iExec Data Protector for on-chain verification of purchased strategies.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
