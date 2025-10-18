"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import AppLayout from "@/components/AppLayout";
import MarketplaceView from "@/components/MarketplaceView";
import MyStrategiesView from "@/components/MyStrategiesView";

export default function Home() {
  const { address } = useAccount();
  const [refreshKey, setRefreshKey] = useState(0);

  /**
   * Handles strategy purchase using iExec Data Protector
   * 
   * Purchase Flow:
   * 1. Initialize Data Protector service with wallet provider
   * 2. Call purchaseStrategy() to encrypt and grant access
   * 3. User signs transaction on Arbitrum Sepolia
   * 4. Access is granted to both user and TEE iApp
   * 5. Protected data address is returned as ownership proof
   * 
   * Fallback: Uses localStorage for testing if Data Protector fails
   */
  const handlePurchase = async (strategyId: string) => {
    if (!address) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      // TODO: Integrate with StrategyDataProtectorService
      // For now, use localStorage as temporary implementation
      // 
      // Future implementation:
      // import { getStrategyDataProtectorService } from '@/services/StrategyDataProtectorService';
      // const service = getStrategyDataProtectorService();
      // await service.initialize(walletProvider);
      // const result = await service.purchaseStrategy(strategy, address);
      
      // Get current purchases for this wallet
      const storageKey = `purchased_strategies_${address.toLowerCase()}`;
      const purchased = JSON.parse(localStorage.getItem(storageKey) || '[]') as string[];
      
      // Check if already purchased
      if (purchased.includes(strategyId)) {
        alert('You already own this strategy!');
        return;
      }
      
      // Add to purchased list
      purchased.push(strategyId);
      localStorage.setItem(storageKey, JSON.stringify(purchased));
      
      // Show success message
      alert(`Successfully purchased strategy! Check "My Strategies" tab to execute it.`);
      
      // Trigger refresh to update both views
      setRefreshKey(prev => prev + 1);
      
      console.log('Purchase successful:', strategyId);
    } catch (error) {
      console.error('Purchase failed:', error);
      alert('Purchase failed. Please try again.');
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
    <AppLayout
      marketplaceContent={
        <MarketplaceView
          key={`marketplace-${refreshKey}`}
          onPurchase={handlePurchase}
          onExecute={handleExecute}
        />
      }
      myStrategiesContent={
        <MyStrategiesView
          key={`mystrats-${refreshKey}`}
          onExecute={handleExecute}
        />
      }
    />
  );
}
