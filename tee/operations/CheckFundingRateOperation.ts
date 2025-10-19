import { IOperation } from './IOperation';
import { OperationType, ValidationResult, OperationResult } from './OperationTypes';
import { ExecutionContext } from '../executor/ExecutionContext';

/**
 * CheckFundingRateOperation fetches the current funding rate from a perpetual DEX
 * and determines whether the arbitrage opportunity is profitable enough to proceed
 * with strategy execution.
 * 
 * This operation is typically the first in a funding rate arbitrage strategy. It:
 * 1. Fetches the current funding rate for a trading pair (e.g., BTC/USD)
 * 2. Calculates expected profitability considering gas costs and fees
 * 3. Compares the funding rate against a minimum profitable threshold
 * 4. Stores the result in ExecutionContext for subsequent operations to check
 * 
 * If the funding rate is below the minimum profitable threshold, subsequent operations
 * can check the 'isProfitable' flag in the context and skip execution gracefully.
 * 
 * The profitability calculation considers:
 * - Current funding rate (positive rates favor shorts)
 * - Estimated gas costs for all operations in the strategy
 * - DEX trading fees (both perpetual and spot)
 * - Capital allocation amount
 * 
 * @example
 * ```typescript
 * // Create operation to check BTC/USD funding rate
 * const checkOp = new CheckFundingRateOperation(
 *   1,                    // Execute first
 *   'BTC/USD',           // Trading pair
 *   0.01,                // Minimum 0.01% funding rate (1 basis point)
 *   '100'                // Estimated gas cost in USD
 * );
 * 
 * const result = await checkOp.execute(context);
 * // Result stored in context.state:
 * // - fundingRate: current rate as decimal (e.g., 0.0015 = 0.15%)
 * // - isProfitable: boolean indicating if execution should proceed
 * ```
 */
export class CheckFundingRateOperation implements IOperation {
  /** Operation type identifier for serialization/deserialization */
  readonly type = OperationType.CHECK_FUNDING_RATE;
  
  /** Execution order within the strategy */
  readonly order: number;
  
  /** Trading pair to check (e.g., 'BTC/USD', 'ETH/USD') */
  private readonly pair: string;
  
  /** 
   * Minimum funding rate required for profitable execution.
   * Expressed as a decimal (e.g., 0.01 = 1% = 100 basis points).
   * This threshold should account for:
   * - Gas costs for all operations
   * - Trading fees on both perpetual and spot DEXs
   * - Desired profit margin
   */
  private readonly minProfitableRate: number;
  
  /**
   * Estimated total gas cost for the entire strategy execution in USD.
   * Used to calculate the minimum funding rate needed to cover costs.
   * This should include gas for:
   * - Opening perpetual short position
   * - Executing spot buy order
   * - Any other blockchain interactions
   */
  private readonly estimatedGasCostUSD: string;
  
  /**
   * Creates a new CheckFundingRateOperation instance.
   * 
   * @param order - Execution order (typically 1, as this runs first)
   * @param pair - Trading pair to check (e.g., 'BTC/USD')
   * @param minProfitableRate - Minimum funding rate for profitability (as decimal)
   * @param estimatedGasCostUSD - Estimated gas cost in USD (default: '50')
   */
  constructor(
    order: number,
    pair: string,
    minProfitableRate: number,
    estimatedGasCostUSD: string = '50'
  ) {
    this.order = order;
    this.pair = pair;
    this.minProfitableRate = minProfitableRate;
    this.estimatedGasCostUSD = estimatedGasCostUSD;
  }
  
  /**
   * Validates the operation parameters.
   * 
   * Validation checks:
   * - Trading pair is provided and non-empty
   * - Minimum profitable rate is positive (negative rates favor longs, not shorts)
   * - Estimated gas cost is a valid positive number
   * 
   * @returns ValidationResult indicating whether parameters are valid
   */
  validate(): ValidationResult {
    const errors: string[] = [];
    
    // Validate trading pair
    if (!this.pair || this.pair.trim().length === 0) {
      errors.push('Trading pair is required and cannot be empty');
    }
    
    // Validate minimum profitable rate
    // For funding rate arbitrage with shorts, we need positive rates
    if (this.minProfitableRate < 0) {
      errors.push('Minimum profitable rate must be non-negative');
    }
    
    // Validate that minProfitableRate is reasonable (not absurdly high)
    // Funding rates typically range from -0.05% to +0.05% per 8 hours
    if (this.minProfitableRate > 1.0) {
      errors.push('Minimum profitable rate seems unreasonably high (>100%)');
    }
    
    // Validate estimated gas cost
    const gasCost = parseFloat(this.estimatedGasCostUSD);
    if (isNaN(gasCost) || gasCost < 0) {
      errors.push('Estimated gas cost must be a valid non-negative number');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Executes the funding rate check within the TEE.
   * 
   * Execution flow:
   * 1. Fetch current funding rate from perpetual DEX via DexService
   * 2. Calculate profitability considering gas costs and capital allocation
   * 3. Determine if the rate exceeds the minimum profitable threshold
   * 4. Store results in ExecutionContext for subsequent operations
   * 
   * The profitability calculation uses this formula:
   * 
   * Expected Profit = (Funding Rate × Capital Allocation) - Gas Costs - Trading Fees
   * 
   * Where:
   * - Funding Rate: Current rate from perpetual DEX (e.g., 0.01 = 1%)
   * - Capital Allocation: Total capital from context.config.capitalAllocation
   * - Gas Costs: Estimated gas for all operations (this.estimatedGasCostUSD)
   * - Trading Fees: Estimated as 0.1% of capital (typical DEX fees)
   * 
   * The operation is considered profitable if:
   * Expected Profit > 0 AND Funding Rate >= minProfitableRate
   * 
   * Results stored in context.state:
   * - 'fundingRate': Current funding rate as decimal
   * - 'isProfitable': Boolean indicating if execution should proceed
   * - 'profitabilityDetails': Object with calculation breakdown
   * 
   * @param context - Execution context with config and services
   * @returns Promise resolving to operation result with funding rate data
   */
  async execute(context: ExecutionContext): Promise<OperationResult> {
    try {
      // Step 1: Fetch current funding rate from perpetual DEX
      const dexService = context.getDexService();
      const currentRate = await dexService.getFundingRate(this.pair);
      
      console.log(`[TEE CheckFundingRate] Fetched funding rate for ${this.pair}: ${currentRate}`);
      
      // Step 2: Calculate profitability
      const profitability = this.calculateProfitability(currentRate, context);
      
      // Step 3: Determine if execution should proceed
      // Both conditions must be met:
      // 1. Funding rate >= minimum threshold
      // 2. Expected profit > 0 (covers all costs)
      const isProfitable = currentRate >= this.minProfitableRate && profitability.expectedProfit > 0;
      
      console.log(`[TEE CheckFundingRate] Profitability check: ${isProfitable ? 'PASS' : 'FAIL'}`);
      console.log(`[TEE CheckFundingRate] Expected profit: $${profitability.expectedProfit.toFixed(2)}`);
      
      // Step 4: Store results in context for subsequent operations
      context.state.set('fundingRate', currentRate);
      context.state.set('isProfitable', isProfitable);
      context.state.set('profitabilityDetails', profitability);
      
      // Return success result with funding rate data
      return {
        success: true,
        operationType: this.type,
        data: {
          pair: this.pair,
          fundingRate: currentRate,
          isProfitable,
          minProfitableRate: this.minProfitableRate,
          expectedProfit: profitability.expectedProfit,
          breakdown: {
            fundingIncome: profitability.fundingIncome,
            gasCosts: profitability.gasCosts,
            tradingFees: profitability.tradingFees
          }
        }
      };
      
    } catch (error) {
      // Handle errors gracefully without exposing sensitive details
      console.error('[TEE CheckFundingRate] Error:', error);
      
      return {
        success: false,
        operationType: this.type,
        error: {
          code: 'FUNDING_RATE_CHECK_FAILED',
          message: 'Failed to check funding rate. Please try again later.',
          recoverable: true
        }
      };
    }
  }
  
  /**
   * Calculates the profitability of executing the strategy given the current funding rate.
   * 
   * This is the core profitability logic that determines whether the arbitrage
   * opportunity is worth executing. The calculation considers:
   * 
   * 1. Funding Income: The amount earned from the positive funding rate
   *    Formula: Funding Rate × Capital Allocation
   *    Example: 0.01 (1%) × $10,000 = $100
   * 
   * 2. Gas Costs: Estimated gas fees for all blockchain operations
   *    Provided as estimatedGasCostUSD parameter
   *    Example: $50 for opening short + spot buy
   * 
   * 3. Trading Fees: DEX fees for perpetual and spot trades
   *    Estimated as 0.1% of capital allocation (typical for most DEXs)
   *    Formula: 0.001 × Capital Allocation
   *    Example: 0.001 × $10,000 = $10
   * 
   * Expected Profit = Funding Income - Gas Costs - Trading Fees
   * Example: $100 - $50 - $10 = $40 profit
   * 
   * The strategy is profitable if Expected Profit > 0
   * 
   * @param fundingRate - Current funding rate as decimal (e.g., 0.01 = 1%)
   * @param context - Execution context with capital allocation config
   * @returns Profitability breakdown with expected profit and cost components
   */
  private calculateProfitability(
    fundingRate: number,
    context: ExecutionContext
  ): {
    expectedProfit: number;
    fundingIncome: number;
    gasCosts: number;
    tradingFees: number;
  } {
    // Parse capital allocation from context config
    const capitalAllocation = parseFloat(context.config.capitalAllocation);
    
    // Calculate funding income: what we earn from the positive funding rate
    // This is the revenue side of the equation
    const fundingIncome = fundingRate * capitalAllocation;
    
    // Parse gas costs from the estimated amount
    const gasCosts = parseFloat(this.estimatedGasCostUSD);
    
    // Estimate trading fees as 0.1% of capital (typical DEX fee)
    // This covers both the perpetual short and spot buy fees
    const tradingFees = 0.001 * capitalAllocation;
    
    // Calculate net expected profit after all costs
    const expectedProfit = fundingIncome - gasCosts - tradingFees;
    
    return {
      expectedProfit,
      fundingIncome,
      gasCosts,
      tradingFees
    };
  }
}
