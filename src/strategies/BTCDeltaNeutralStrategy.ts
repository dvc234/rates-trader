/**
 * BTC Delta Neutral Funding Strategy
 * Combines delta neutral positioning with funding rate arbitrage on BTC
 * This strategy is protected in the TEE - users only see metadata
 */

import {
  Strategy,
  StrategyOperation,
  StrategyConfig,
  ValidationResult,
  RiskLevel
} from '../types/strategy';
import { StrategyBuilder } from '../types/strategyBuilder';

/**
 * BTC delta neutral funding strategy
 * Checks funding rate, opens short perpetual, and hedges with spot buy
 * Maintains market-neutral position while capturing funding payments
 */
export class BTCDeltaNeutralStrategy implements Strategy {
  id: string;
  name: string;
  description: string;
  risk: RiskLevel;
  apr: { min: number; max: number };
  price: string;
  isOwned: boolean;
  encryptedOperations?: string;

  private operations: StrategyOperation[];

  constructor(isOwned: boolean = false) {
    this.id = 'btc-delta-neutral-001';
    this.name = 'BTC Delta Neutral Funding';
    this.description = 'Captures BTC funding rate profits while maintaining delta neutral exposure. Low risk market-neutral strategy on Base.';
    this.risk = 'low';
    this.apr = { min: 15, max: 45 };
    this.price = '50'; // 50 RLC
    this.isOwned = isOwned;

    const builder = new StrategyBuilder();

    this.operations = builder
      // Check if BTC funding rate is favorable on Avantis
      .checkFundingRate('BTC/USDC', {
        minRate: 0.01, // Only execute if funding rate > 0.01%
        exchange: 'avantis',
        label: 'fundingCheck'
      })
      // Open short perpetual position on Avantis
      .openShort('BTC/USDC', '50', 1, {
        isPercentage: true,
        exchange: 'avantis',
        label: 'shortPosition'
      })
      // Buy spot BTC via 1inch Fusion to hedge
      .spotBuy('BTC/USDC', '50', {
        isPercentage: true,
        exchange: '1inch-fusion',
        label: 'spotHedge'
      })
      .build();
  }

  serialize(): string {
    return JSON.stringify({
      strategyId: this.id,
      strategyName: this.name,
      version: '1.0.0',
      operations: this.operations
    });
  }

  validate(config: StrategyConfig): ValidationResult {
    const errors: string[] = [];

    if (config.slippageTolerance < 0 || config.slippageTolerance > 100) {
      errors.push('Slippage tolerance must be between 0 and 100');
    }

    if (config.capitalAllocation) {
      const capital = parseFloat(config.capitalAllocation);
      if (isNaN(capital) || capital <= 0) {
        errors.push('Capital allocation must be a positive number');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  getOperations(): StrategyOperation[] {
    return [...this.operations];
  }
}
