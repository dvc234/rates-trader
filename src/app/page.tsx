"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import AppLayout from "@/components/AppLayout";
import MarketplaceView from "@/components/MarketplaceView";
import MyStrategiesView from "@/components/MyStrategiesView";
import { useDataProtector } from "@/hooks/useDataProtector";
import { MockStrategy, BTCDeltaNeutralStrategy, ETHDeltaNeutralStrategy } from "@/strategies";

export default function Home() {
  const { address } = useAccount();
  const [refreshKey, setRefreshKey] = useState(0);
  
  // State management for purchase flow
  // Tracks which strategy is currently being purchased to show loading state
  const [purchasingStrategyId, setPurchasingStrategyId] = useState<string | null>(null);
  
  // State for error messages during purchase
  // Displayed to user when purchase fails
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  
  // State for success messages after purchase
  // Displayed to user when purchase succeeds
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  
  // Initialize Data Protector hook for strategy purchases
  const { purchaseStrategy, isInitialized, error: dataProtectorError } = useDataProtector();

  /**
   * Handles strategy purchase using iExec Data Protector
   * 
   * Purchase Flow:
   * 1. Validate wallet connection and Data Protector initialization
   * 2. Find the strategy instance to get serialized operations
   * 3. Set loading state to show progress indicator
   * 4. Call Data Protector service to encrypt and grant access
   * 5. User signs transaction on Arbitrum Sepolia
   * 6. Access is granted to both user and TEE iApp
   * 7. Update UI to reflect successful purchase
   * 8. Clear loading state and show success message
   * 
   * Error Handling:
   * - Wallet not connected: Show error and prompt to connect
   * - Data Protector not initialized: Show error and suggest retry
   * - Strategy not found: Show error (should not happen)
   * - Purchase transaction fails: Show error with details
   * - User rejects transaction: Show cancellation message
   * 
   * UI State Management:
   * - purchasingStrategyId: Tracks which strategy is being purchased (for loading spinner)
   * - purchaseError: Stores error message to display to user
   * - purchaseSuccess: Stores success message to display to user
   * - refreshKey: Triggers re-render of marketplace and my strategies views
   * 
   * Fallback: Uses localStorage for testing if Data Protector fails
   */
  const handlePurchase = async (strategyId: string) => {
    // Clear any previous messages
    setPurchaseError(null);
    setPurchaseSuccess(null);
    
    // Validate wallet connection
    if (!address) {
      setPurchaseError('Please connect your wallet first');
      return;
    }

    // Check if Data Protector is initialized
    // If not, the service cannot encrypt or grant access to strategies
    if (!isInitialized) {
      setPurchaseError(
        dataProtectorError || 
        'Data Protector is not initialized. Please ensure your wallet is connected and try again.'
      );
      return;
    }

    try {
      // Set loading state for this specific strategy
      // This will show a loading spinner on the purchase button
      setPurchasingStrategyId(strategyId);
      
      console.log('[Purchase] Starting purchase for strategy:', strategyId);
      console.log('[Purchase] Buyer address:', address);
      
      // Find the strategy instance to get its serialized operations
      // We need the actual strategy object to call serialize() and purchaseStrategy()
      let strategy: (MockStrategy | BTCDeltaNeutralStrategy | ETHDeltaNeutralStrategy) | null = null;
      
      // Map strategy ID to strategy instance
      // In production, this would fetch from an API or registry
      switch (strategyId) {
        case 'mock-strategy-001':
          strategy = new MockStrategy(false);
          break;
        case 'btc-delta-neutral-001':
          strategy = new BTCDeltaNeutralStrategy(false);
          break;
        case 'eth-delta-neutral-001':
          strategy = new ETHDeltaNeutralStrategy(false);
          break;
        default:
          throw new Error(`Unknown strategy: ${strategyId}`);
      }
      
      if (!strategy) {
        throw new Error('Strategy not found');
      }
      
      console.log('[Purchase] Strategy found:', strategy.name);
      console.log('[Purchase] Calling Data Protector service...');
      
      // Call Data Protector service to purchase the strategy
      // This will:
      // 1. Encrypt the strategy operations
      // 2. Store encrypted data on IPFS
      // 3. Grant access to buyer and TEE iApp
      // 4. Record ownership on-chain (Arbitrum Sepolia)
      const result = await purchaseStrategy(strategy, address);
      
      console.log('[Purchase] Data Protector result:', result);
      
      // Check if purchase was successful
      if (!result.success) {
        // Purchase failed - show error message to user
        throw new Error(result.error || 'Purchase failed');
      }
      
      console.log('[Purchase] Purchase successful!');
      console.log('[Purchase] Protected data address:', result.protectedDataAddress);
      
      // Update localStorage as fallback/cache
      // This ensures UI updates even if Data Protector queries are slow
      const storageKey = `purchased_strategies_${address.toLowerCase()}`;
      const purchased = JSON.parse(localStorage.getItem(storageKey) || '[]') as string[];
      
      if (!purchased.includes(strategyId)) {
        purchased.push(strategyId);
        localStorage.setItem(storageKey, JSON.stringify(purchased));
        console.log('[Purchase] Updated localStorage cache');
      }
      
      // Show success message to user
      setPurchaseSuccess(
        `Successfully purchased ${strategy.name}! Check "My Strategies" tab to execute it.`
      );
      
      // Trigger refresh to update both marketplace and my strategies views
      // This will re-fetch ownership status and update the UI
      setRefreshKey(prev => prev + 1);
      
      console.log('[Purchase] UI refresh triggered');
      
      // Auto-clear success message after 5 seconds
      setTimeout(() => {
        setPurchaseSuccess(null);
      }, 5000);
      
    } catch (error: any) {
      console.error('[Purchase] Purchase failed:', error);
      
      // Extract user-friendly error message
      let errorMessage = 'Purchase failed. Please try again.';
      
      if (error.message) {
        // Check for specific error types
        if (error.message.includes('user rejected') || error.message.includes('User denied')) {
          errorMessage = 'Transaction was cancelled. Please try again when ready.';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient RLC balance. Please add funds to your wallet.';
        } else if (error.message.includes('network')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else {
          // Use the error message as-is if it's user-friendly
          errorMessage = error.message;
        }
      }
      
      // Display error message to user
      setPurchaseError(errorMessage);
      
      // Auto-clear error message after 8 seconds
      setTimeout(() => {
        setPurchaseError(null);
      }, 8000);
      
    } finally {
      // Clear loading state regardless of success or failure
      // This ensures the button returns to normal state
      setPurchasingStrategyId(null);
    }
  };

  /**
   * Handles strategy execution
   * 
   * TODO: Implement iExec execution in Phase 4
   * - Initialize iAppGenerator with strategy operations
   * - Execute in TEE on Base mainnet
   * - Monitor execution status
   * - Display results
   */
  const handleExecute = (strategyId: string) => {
    console.log('Execute strategy:', strategyId);
    alert('Strategy execution will be implemented in Phase 4 with iExec TEE integration.');
    // Will be implemented in Phase 4: iAppGenerator Integration
  };

  return (
    <div>
      {/* Global notification area for purchase feedback */}
      {/* Positioned at top of screen for visibility */}
      {purchaseError && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
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
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800 mb-1">
                  Purchase Failed
                </h3>
                <p className="text-sm text-red-700">{purchaseError}</p>
              </div>
              <button
                onClick={() => setPurchaseError(null)}
                className="text-red-400 hover:text-red-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      
      {purchaseSuccess && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 shadow-lg">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-green-800 mb-1">
                  Purchase Successful
                </h3>
                <p className="text-sm text-green-700">{purchaseSuccess}</p>
              </div>
              <button
                onClick={() => setPurchaseSuccess(null)}
                className="text-green-400 hover:text-green-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      
      <AppLayout
        marketplaceContent={
          <MarketplaceView
            key={`marketplace-${refreshKey}`}
            onPurchase={handlePurchase}
            onExecute={handleExecute}
            purchasingStrategyId={purchasingStrategyId}
          />
        }
        myStrategiesContent={
          <MyStrategiesView
            key={`mystrats-${refreshKey}`}
            onExecute={handleExecute}
          />
        }
      />
    </div>
  );
}
