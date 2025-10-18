/**
 * MarketplaceView Component
 * 
 * Displays the marketplace interface with available strategies in a card-based layout.
 * Handles loading states and integrates with wallet connection status.
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
 * Props for the MarketplaceView component
 */
interface MarketplaceViewProps {
  /** Callback when a strategy is purchased */
  onPurchase?: (strategyId: string) => void;
  /** Callback when a strategy is executed */
  onExecute?: (strategyId: string) => void;
  /** ID of strategy currently being purchased (for loading state) */
  purchasingStrategyId?: string | null;
}

/**
 * MarketplaceView displays all available strategies in a grid layout
 * 
 * Features:
 * - Card-based layout for strategies
 * - Loading state handling
 * - Wallet connection integration
 * - Mock strategy as primary option
 * - Responsive grid layout
 */
export default function MarketplaceView({
  onPurchase,
  onExecute,
  purchasingStrategyId
}: MarketplaceViewProps) {
  // State management for strategies and loading
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get wallet connection status and address
  const { isConnected, address } = useAccount();

  /**
   * Load available strategies on component mount
   * Loads all available strategies and checks ownership status
   */
  useEffect(() => {
    const loadStrategies = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Simulate API call delay for realistic loading state
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Get purchased strategies for connected wallet (if any)
        let purchasedIds: string[] = [];
        if (isConnected && address) {
          const storageKey = `purchased_strategies_${address.toLowerCase()}`;
          purchasedIds = JSON.parse(localStorage.getItem(storageKey) || '[]') as string[];
        }
        
        // Create strategy instances with ownership status
        // In production, this would fetch from an API or smart contract
        const mockStrategy = new MockStrategy(purchasedIds.includes('mock-strategy-001'));
        const btcStrategy = new BTCDeltaNeutralStrategy(purchasedIds.includes('btc-delta-neutral-001'));
        const ethStrategy = new ETHDeltaNeutralStrategy(purchasedIds.includes('eth-delta-neutral-001'));
        
        // Set strategies array with all available strategies
        setStrategies([mockStrategy, btcStrategy, ethStrategy]);
      } catch (err) {
        console.error('Failed to load strategies:', err);
        setError('Failed to load strategies. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadStrategies();
  }, [isConnected, address]);

  /**
   * Handles strategy purchase action
   */
  const handlePurchase = (strategyId: string) => {
    if (onPurchase) {
      onPurchase(strategyId);
    }
  };

  /**
   * Handles strategy execution action
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
          Please connect your wallet to view available strategies
        </p>
      </div>
    );
  }

  // Show error state if loading failed
  if (error) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
          <svg
            className="w-8 h-8 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">
          Error Loading Strategies
        </h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="primary"
        >
          Retry
        </button>
      </div>
    );
  }

  // Show loading state while fetching strategies
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Loading skeleton cards */}
        {[1, 2, 3].map((i) => (
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
    );
  }

  // Show empty state if no strategies available
  if (strategies.length === 0) {
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
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">
          No Strategies Available
        </h3>
        <p className="text-gray-600">
          Check back later for new trading strategies
        </p>
      </div>
    );
  }

  // Render strategies in a responsive grid layout
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Available Strategies
        </h2>
        <p className="text-gray-600">
          Browse and purchase encrypted trading strategies
        </p>
      </div>

      {/* Responsive grid: 1 column on mobile, 2 on tablet, 3 on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {strategies.map((strategy) => (
          <StrategyCard
            key={strategy.id}
            strategy={strategy}
            onPurchase={handlePurchase}
            onExecute={handleExecute}
            isLoading={purchasingStrategyId === strategy.id}
          />
        ))}
      </div>
    </div>
  );
}
