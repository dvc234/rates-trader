"use client";

import AppLayout from "@/components/AppLayout";
import MarketplaceView from "@/components/MarketplaceView";

export default function Home() {
  /**
   * Handles strategy purchase
   * TODO: Implement Data Protector integration in Phase 2
   */
  const handlePurchase = (strategyId: string) => {
    console.log('Purchase strategy:', strategyId);
    // Will be implemented in Phase 2: Strategy Purchase with Data Protector
  };

  /**
   * Handles strategy execution
   * TODO: Implement iExec execution in Phase 4
   */
  const handleExecute = (strategyId: string) => {
    console.log('Execute strategy:', strategyId);
    // Will be implemented in Phase 4: iAppGenerator Integration
  };

  return (
    <AppLayout>
      <MarketplaceView
        onPurchase={handlePurchase}
        onExecute={handleExecute}
      />
    </AppLayout>
  );
}
