/**
 * Strategy Builder - Composable API for creating complex strategies
 * This builder provides a fluent interface for composing multiple operations
 * while keeping the actual execution logic protected in the TEE
 * 
 * Protocol Integration:
 * - Spot operations (spotBuy, spotSell) should use exchange: '1inch-fusion'
 * - Perpetual operations (openLong, openShort, etc.) should use exchange: 'synthetix-v3'
 * - All pairs should use USDC as quote currency for Base network (e.g., 'BTC/USDC', 'ETH/USDC')
 */

import {
  StrategyOperation,
  OperationType,
  SpotBuyParams,
  SpotSellParams,
  OpenLongParams,
  OpenShortParams,
  CloseLongParams,
  CloseShortParams,
  CheckFundingRateParams,
  CheckPriceParams,
  WaitParams
} from './strategy';

/**
 * Composable strategy builder for creating multi-operation strategies
 * Operations are executed sequentially in the TEE in the order they are added
 * 
 * @example
 * ```typescript
 * const operations = new StrategyBuilder()
 *   .checkFundingRate('ETH/USDC', { 
 *     minRate: 0.01, 
 *     exchange: 'synthetix-v3' 
 *   })
 *   .openShort('ETH/USDC', '50', 1, { 
 *     isPercentage: true,
 *     exchange: 'synthetix-v3' 
 *   })
 *   .spotBuy('ETH/USDC', '50', { 
 *     isPercentage: true,
 *     exchange: '1inch-fusion' 
 *   })
 *   .build();
 * ```
 */
export class StrategyBuilder {
  private operations: StrategyOperation[] = [];
  private currentOrder = 1;
  
  /**
   * Add a spot buy operation (executes via 1inch Fusion)
   * @param ticker - Trading pair (e.g., 'ETH/USDC', 'BTC/USDC')
   * @param amount - Amount to buy
   * @param options - Additional options
   * @param options.exchange - Protocol to use (recommended: '1inch-fusion')
   */
  spotBuy(
    ticker: string,
    amount: string,
    options?: {
      isPercentage?: boolean;
      maxPrice?: string;
      exchange?: string;
      label?: string;
      optional?: boolean;
    }
  ): this {
    const params: SpotBuyParams = {
      ticker,
      amount,
      isPercentage: options?.isPercentage,
      maxPrice: options?.maxPrice,
      exchange: options?.exchange
    };
    
    this.operations.push({
      type: OperationType.SPOT_BUY,
      order: this.currentOrder++,
      params,
      label: options?.label,
      optional: options?.optional
    });
    
    return this;
  }
  
  /**
   * Add a spot sell operation (executes via 1inch Fusion)
   * @param ticker - Trading pair (e.g., 'ETH/USDC', 'BTC/USDC')
   * @param amount - Amount to sell
   * @param options - Additional options
   * @param options.exchange - Protocol to use (recommended: '1inch-fusion')
   */
  spotSell(
    ticker: string,
    amount: string,
    options?: {
      isPercentage?: boolean;
      minPrice?: string;
      exchange?: string;
      label?: string;
      optional?: boolean;
    }
  ): this {
    const params: SpotSellParams = {
      ticker,
      amount,
      isPercentage: options?.isPercentage,
      minPrice: options?.minPrice,
      exchange: options?.exchange
    };
    
    this.operations.push({
      type: OperationType.SPOT_SELL,
      order: this.currentOrder++,
      params,
      label: options?.label,
      optional: options?.optional
    });
    
    return this;
  }
  
  /**
   * Add an open long position operation (executes via Synthetix v3)
   * @param ticker - Trading pair (e.g., 'ETH/USDC', 'BTC/USDC')
   * @param size - Position size
   * @param leverage - Leverage multiplier
   * @param options - Additional options
   * @param options.exchange - Protocol to use (recommended: 'synthetix-v3')
   */
  openLong(
    ticker: string,
    size: string,
    leverage: number,
    options?: {
      isPercentage?: boolean;
      stopLoss?: string;
      takeProfit?: string;
      exchange?: string;
      label?: string;
      optional?: boolean;
    }
  ): this {
    const params: OpenLongParams = {
      ticker,
      size,
      leverage,
      isPercentage: options?.isPercentage,
      stopLoss: options?.stopLoss,
      takeProfit: options?.takeProfit,
      exchange: options?.exchange
    };
    
    this.operations.push({
      type: OperationType.OPEN_LONG,
      order: this.currentOrder++,
      params,
      label: options?.label,
      optional: options?.optional
    });
    
    return this;
  }
  
  /**
   * Add an open short position operation (executes via Synthetix v3)
   * @param ticker - Trading pair (e.g., 'ETH/USDC', 'BTC/USDC')
   * @param size - Position size
   * @param leverage - Leverage multiplier
   * @param options - Additional options
   * @param options.exchange - Protocol to use (recommended: 'synthetix-v3')
   */
  openShort(
    ticker: string,
    size: string,
    leverage: number,
    options?: {
      isPercentage?: boolean;
      stopLoss?: string;
      takeProfit?: string;
      exchange?: string;
      label?: string;
      optional?: boolean;
    }
  ): this {
    const params: OpenShortParams = {
      ticker,
      size,
      leverage,
      isPercentage: options?.isPercentage,
      stopLoss: options?.stopLoss,
      takeProfit: options?.takeProfit,
      exchange: options?.exchange
    };
    
    this.operations.push({
      type: OperationType.OPEN_SHORT,
      order: this.currentOrder++,
      params,
      label: options?.label,
      optional: options?.optional
    });
    
    return this;
  }
  
  /**
   * Add a close long position operation (executes via Synthetix v3)
   * @param ticker - Trading pair (e.g., 'ETH/USDC', 'BTC/USDC')
   * @param options - Additional options
   * @param options.exchange - Protocol to use (recommended: 'synthetix-v3')
   */
  closeLong(
    ticker: string,
    options?: {
      amount?: string;
      closeAll?: boolean;
      minPrice?: string;
      exchange?: string;
      label?: string;
      optional?: boolean;
    }
  ): this {
    const params: CloseLongParams = {
      ticker,
      amount: options?.amount,
      closeAll: options?.closeAll ?? true,
      minPrice: options?.minPrice,
      exchange: options?.exchange
    };
    
    this.operations.push({
      type: OperationType.CLOSE_LONG,
      order: this.currentOrder++,
      params,
      label: options?.label,
      optional: options?.optional
    });
    
    return this;
  }
  
  /**
   * Add a close short position operation (executes via Synthetix v3)
   * @param ticker - Trading pair (e.g., 'ETH/USDC', 'BTC/USDC')
   * @param options - Additional options
   * @param options.exchange - Protocol to use (recommended: 'synthetix-v3')
   */
  closeShort(
    ticker: string,
    options?: {
      amount?: string;
      closeAll?: boolean;
      maxPrice?: string;
      exchange?: string;
      label?: string;
      optional?: boolean;
    }
  ): this {
    const params: CloseShortParams = {
      ticker,
      amount: options?.amount,
      closeAll: options?.closeAll ?? true,
      maxPrice: options?.maxPrice,
      exchange: options?.exchange
    };
    
    this.operations.push({
      type: OperationType.CLOSE_SHORT,
      order: this.currentOrder++,
      params,
      label: options?.label,
      optional: options?.optional
    });
    
    return this;
  }
  
  /**
   * Add a funding rate check operation (queries Synthetix v3)
   * @param ticker - Trading pair (e.g., 'ETH/USDC', 'BTC/USDC')
   * @param options - Additional options
   * @param options.exchange - Protocol to use (recommended: 'synthetix-v3')
   */
  checkFundingRate(
    ticker: string,
    options?: {
      minRate?: number;
      maxRate?: number;
      exchange?: string;
      label?: string;
    }
  ): this {
    const params: CheckFundingRateParams = {
      ticker,
      minRate: options?.minRate,
      maxRate: options?.maxRate,
      exchange: options?.exchange
    };
    
    this.operations.push({
      type: OperationType.CHECK_FUNDING_RATE,
      order: this.currentOrder++,
      params,
      label: options?.label
    });
    
    return this;
  }
  
  /**
   * Add a price check operation
   * @param ticker - Trading pair (e.g., 'ETH/USDT')
   * @param operator - Comparison operator
   * @param targetPrice - Price to compare against
   * @param options - Additional options
   */
  checkPrice(
    ticker: string,
    operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq',
    targetPrice: string,
    options?: {
      exchange?: string;
      label?: string;
    }
  ): this {
    const params: CheckPriceParams = {
      ticker,
      operator,
      targetPrice,
      exchange: options?.exchange
    };
    
    this.operations.push({
      type: OperationType.CHECK_PRICE,
      order: this.currentOrder++,
      params,
      label: options?.label
    });
    
    return this;
  }
  
  /**
   * Add a wait operation
   * @param duration - Duration to wait in milliseconds
   * @param options - Additional options
   */
  wait(
    duration: number,
    options?: {
      condition?: string;
      label?: string;
    }
  ): this {
    const params: WaitParams = {
      duration,
      condition: options?.condition
    };
    
    this.operations.push({
      type: OperationType.WAIT,
      order: this.currentOrder++,
      params,
      label: options?.label
    });
    
    return this;
  }
  
  /**
   * Build and return the operations array
   * @returns Array of strategy operations
   */
  build(): StrategyOperation[] {
    return [...this.operations];
  }
  
  /**
   * Reset the builder to start fresh
   */
  reset(): this {
    this.operations = [];
    this.currentOrder = 1;
    return this;
  }
}
