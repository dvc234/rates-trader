import { IOperation } from './IOperation';
import { OperationType, ValidationResult, OperationResult } from './OperationTypes';
import { ExecutionContext } from '../executor/ExecutionContext';

/**
 * OpenPerpetualShortOperation opens a short position on a perpetual DEX
 * as part of a funding rate arbitrage strategy.
 * 
 * This operation is typically executed after checking that the funding rate
 * is profitable (via CheckFundingRateOperation). It:
 * 1. Checks if the profitability check passed (reads 'isProfitable' from context)
 * 2. Calculates the capital amount to allocate based on percentage
 * 3. Opens a short position on the perpetual DEX with optional leverage
 * 4. Stores position details in ExecutionContext for subsequent operations
 * 
 * The short position benefits from positive funding rates, where longs pay shorts.
 * This operation is balanced by a corresponding spot buy (SpotBuyOperation) to
 * create a delta-neutral position that profits from the funding rate differential.
 * 
 * Position details stored in context.state:
 * - 'shortPosition': Object containing entry price, amount, transaction hash
 * 
 * These details can be referenced by subsequent operations (e.g., SpotBuyOperation
 * can use the short entry price as a reference for limit orders).
 * 
 * @example
 * ```typescript
 * // Create operation to open 50% short position with 1x leverage
 * const openShortOp = new OpenPerpetualShortOperation(
 *   2,                    // Execute second (after funding rate check)
 *   'BTC/USD',           // Trading pair
 *   50,                  // Use 50% of capital
 *   1                    // 1x leverage (no leverage)
 * );
 * 
 * const result = await openShortOp.execute(context);
 * // Result stored in context.state:
 * // - shortPosition: { entryPrice, amount, transactionHash }
 * ```
 */
export class OpenPerpetualShortOperation implements IOperation {
  /** Operation type identifier for serialization/deserialization */
  readonly type = OperationType.OPEN_PERPETUAL_SHORT;
  
  /** Execution order within the strategy */
  readonly order: number;
  
  /** Trading pair for the short position (e.g., 'BTC/USD', 'ETH/USD') */
  private readonly pair: string;
  
  /** 
   * Percentage of total capital to allocate to this short position.
   * Range: 0-100
   * Example: 50 means use 50% of capitalAllocation for the short
   */
  private readonly capitalPercentage: number;
  
  /** 
   * Leverage multiplier for the position.
   * Range: 1-10 (1 = no leverage, 10 = 10x leverage)
   * Higher leverage increases both potential profit and risk.
   * Most strategies use 1x (no leverage) for safety.
   */
  private readonly leverage: number;
  
  /**
   * Creates a new OpenPerpetualShortOperation instance.
   * 
   * @param order - Execution order (typically 2, after funding rate check)
   * @param pair - Trading pair for the short (e.g., 'BTC/USD')
   * @param capitalPercentage - Percentage of capital to allocate (0-100)
   * @param leverage - Leverage multiplier (1-10, default: 1)
   */
  constructor(
    order: number,
    pair: string,
    capitalPercentage: number,
    leverage: number = 1
  ) {
    this.order = order;
    this.pair = pair;
    this.capitalPercentage = capitalPercentage;
    this.leverage = leverage;
  }
  
  /**
   * Validates the operation parameters.
   * 
   * Validation checks:
   * - Trading pair is provided and non-empty
   * - Capital percentage is within valid range (0-100)
   * - Leverage is within safe range (1-10)
   * 
   * @returns ValidationResult indicating whether parameters are valid
   */
  validate(): ValidationResult {
    const errors: string[] = [];
    
    // Validate trading pair
    if (!this.pair || this.pair.trim().length === 0) {
      errors.push('Trading pair is required and cannot be empty');
    }
    
    // Validate capital percentage
    // Must be positive and not exceed 100%
    if (this.capitalPercentage <= 0 || this.capitalPercentage > 100) {
      errors.push('Capital percentage must be between 0 and 100');
    }
    
    // Validate leverage
    // Range from 1x (no leverage) to 10x (maximum safe leverage)
    if (this.leverage < 1 || this.leverage > 10) {
      errors.push('Leverage must be between 1 and 10');
    }
    
    // Ensure leverage is a reasonable number (not fractional)
    if (!Number.isInteger(this.leverage)) {
      errors.push('Leverage must be a whole number');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Executes the perpetual short position opening within the TEE.
   * 
   * Execution flow:
   * 1. Check if profitability check passed (read 'isProfitable' from context)
   * 2. If not profitable, skip execution and return gracefully
   * 3. Calculate capital amount based on percentage and total allocation
   * 4. Call PerpetualService to open the short position
   * 5. Store position details in ExecutionContext for subsequent operations
   * 
   * The capital allocation calculation:
   * Capital Amount = (capitalPercentage / 100) × Total Capital Allocation
   * 
   * Example:
   * - Total capital: $10,000
   * - Capital percentage: 50%
   * - Capital amount: 0.5 × $10,000 = $5,000
   * 
   * Position details stored in context.state:
   * - 'shortPosition': {
   *     entryPrice: string (e.g., '50000' for $50k BTC),
   *     amount: string (capital allocated),
   *     transactionHash: string (blockchain tx hash),
   *     pair: string (trading pair),
   *     leverage: number (leverage used)
   *   }
   * 
   * These details are used by:
   * - SpotBuyOperation: References entry price for limit orders
   * - Rollback logic: Closes position if subsequent operations fail
   * - Result display: Shows user the position details
   * 
   * @param context - Execution context with config and services
   * @returns Promise resolving to operation result with position data
   */
  async execute(context: ExecutionContext): Promise<OperationResult> {
    try {
      // Step 1: Check if profitability check passed
      // The CheckFundingRateOperation should have set this flag
      const isProfitable = context.state.get('isProfitable');
      
      if (isProfitable === false) {
        // Funding rate not profitable, skip execution gracefully
        console.log('[TEE OpenPerpetualShort] Skipping execution: funding rate not profitable');
        
        return {
          success: false,
          operationType: this.type,
          error: {
            code: 'NOT_PROFITABLE',
            message: 'Funding rate not profitable, skipping execution',
            recoverable: true
          }
        };
      }
      
      // Step 2: Calculate capital amount to allocate to this short position
      const capitalAmount = this.calculateCapitalAmount(context);
      
      console.log(`[TEE OpenPerpetualShort] Opening short position on ${this.pair}`);
      console.log(`[TEE OpenPerpetualShort] Capital amount: ${capitalAmount}`);
      console.log(`[TEE OpenPerpetualShort] Leverage: ${this.leverage}x`);
      
      // Step 3: Open the short position via PerpetualService
      const perpService = context.getPerpetualService();
      const result = await perpService.openShort({
        pair: this.pair,
        amount: capitalAmount,
        leverage: this.leverage,
        wallet: context.wallet
      });
      
      console.log(`[TEE OpenPerpetualShort] Position opened successfully`);
      console.log(`[TEE OpenPerpetualShort] Entry price: ${result.entryPrice}`);
      console.log(`[TEE OpenPerpetualShort] Transaction: ${result.transactionHash}`);
      
      // Step 4: Store position details in context for subsequent operations
      // This allows SpotBuyOperation to reference the entry price
      // and enables rollback if needed
      const positionInfo = {
        entryPrice: result.entryPrice,
        amount: capitalAmount,
        transactionHash: result.transactionHash,
        pair: this.pair,
        leverage: this.leverage,
        timestamp: Date.now()
      };
      
      context.state.set('shortPosition', positionInfo);
      
      // Return success result with position data
      return {
        success: true,
        operationType: this.type,
        transactionHash: result.transactionHash,
        data: {
          pair: this.pair,
          amount: capitalAmount,
          entryPrice: result.entryPrice,
          leverage: this.leverage,
          capitalPercentage: this.capitalPercentage
        },
        gasUsed: result.gasUsed
      };
      
    } catch (error) {
      // Handle errors gracefully without exposing sensitive details
      console.error('[TEE OpenPerpetualShort] Error:', error);
      
      return {
        success: false,
        operationType: this.type,
        error: {
          code: 'OPEN_SHORT_FAILED',
          message: 'Failed to open short position. Please try again later.',
          recoverable: true
        }
      };
    }
  }
  
  /**
   * Rolls back the short position by closing it.
   * 
   * This method is called when a subsequent operation fails and the
   * StrategyExecutor attempts to undo previously executed operations.
   * 
   * Rollback process:
   * 1. Retrieve position details from ExecutionContext
   * 2. If position exists, call PerpetualService to close it
   * 3. Log the rollback for debugging
   * 
   * Note: Rollback is best-effort. If the position has already been
   * partially filled or if the market has moved significantly, the
   * rollback may not fully reverse the operation's effects.
   * 
   * @param context - Execution context with position details
   * @returns Promise that resolves when rollback is complete
   */
  async rollback(context: ExecutionContext): Promise<void> {
    try {
      // Retrieve the position details stored during execute()
      const position = context.state.get('shortPosition');
      
      if (!position) {
        console.log('[TEE OpenPerpetualShort] No position to rollback');
        return;
      }
      
      console.log('[TEE OpenPerpetualShort] Rolling back short position');
      console.log(`[TEE OpenPerpetualShort] Position: ${position.pair} at ${position.entryPrice}`);
      
      // Close the position via PerpetualService
      const perpService = context.getPerpetualService();
      const result = await perpService.closePosition(position);
      
      console.log('[TEE OpenPerpetualShort] Position closed successfully');
      console.log(`[TEE OpenPerpetualShort] Transaction: ${result.transactionHash}`);
      
      // Clear the position from context state
      context.state.delete('shortPosition');
      
    } catch (error) {
      // Log rollback failure but don't throw
      // Rollback is best-effort and shouldn't fail the entire strategy
      console.error('[TEE OpenPerpetualShort] Rollback failed:', error);
    }
  }
  
  /**
   * Calculates the capital amount to allocate to this short position.
   * 
   * The calculation uses the capitalPercentage parameter to determine
   * what portion of the total capital allocation should be used for
   * this specific operation.
   * 
   * Formula:
   * Capital Amount = (capitalPercentage / 100) × Total Capital Allocation
   * 
   * Example calculations:
   * - Total capital: $10,000, Percentage: 50% → Amount: $5,000
   * - Total capital: $10,000, Percentage: 30% → Amount: $3,000
   * - Total capital: $10,000, Percentage: 100% → Amount: $10,000
   * 
   * The result is returned as a string to maintain precision for
   * blockchain transactions (avoiding floating-point errors).
   * 
   * @param context - Execution context with capitalAllocation config
   * @returns Capital amount as a string (e.g., '5000')
   */
  private calculateCapitalAmount(context: ExecutionContext): string {
    // Parse total capital allocation from context config
    const totalCapital = parseFloat(context.config.capitalAllocation);
    
    // Calculate the amount for this operation based on percentage
    // Example: 50% of $10,000 = $5,000
    const amount = (this.capitalPercentage / 100) * totalCapital;
    
    // Return as string to maintain precision
    // Round to 2 decimal places for USD amounts
    return amount.toFixed(2);
  }
}
