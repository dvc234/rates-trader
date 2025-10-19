/**
 * Funding Rates Arbitrage Strategy
 * 
 * This strategy captures funding rate profits by creating a delta-neutral position
 * that combines a perpetual short with a spot long. The strategy profits from
 * positive funding rates where longs pay shorts, while maintaining market-neutral
 * exposure through the spot hedge.
 * 
 * Strategy Flow:
 * 1. Check if the current funding rate is profitable (CheckFundingRateOperation)
 * 2. Open a short position on perpetual DEX (OpenPerpetualShortOperation)
 * 3. Buy spot asset to hedge the short (SpotBuyOperation)
 * 
 * The strategy is designed for Base mainnet execution using:
 * - Avantis for perpetual positions
 * - 1inch Fusion for spot trading
 * 
 * Risk Profile: Medium
 * - Market-neutral position reduces directional risk
 * - Funding rate volatility can affect profitability
 * - Execution timing and slippage are key factors
 * 
 * Expected APR: 15-45%
 * - Depends on funding rate levels
 * - Higher during volatile market conditions
 * - Lower during stable/ranging markets
 */

import {
  Strategy,
  StrategyOperation,
  StrategyConfig,
  ValidationResult,
  OperationType,
  RiskLevel
} from '../types/strategy';

/**
 * FundingRatesStrategy implements a funding rate arbitrage strategy
 * that profits from the funding rate differential between perpetual
 * and spot markets while maintaining delta-neutral exposure.
 * 
 * The strategy executes three operations in sequence:
 * 1. Check funding rate profitability
 * 2. Open perpetual short position (50% of capital)
 * 3. Buy spot asset to hedge (50% of capital)
 * 
 * All operations execute within the TEE to protect the strategy logic.
 * Users can only see the strategy metadata and execution results.
 */
export class FundingRatesStrategy implements Strategy {
  id: string;
  name: string;
  description: string;
  risk: RiskLevel;
  apr: { min: number; max: number };
  price: string;
  isOwned: boolean;
  encryptedOperations?: string;
  
  private operations: StrategyOperation[];
  
  /**
   * Creates a new FundingRatesStrategy instance.
   * 
   * The strategy is configured with three operations that execute sequentially:
   * 1. CheckFundingRateOperation: Validates profitability before execution
   * 2. OpenPerpetualShortOperation: Opens short position with 50% capital
   * 3. SpotBuyOperation: Buys spot asset with 50% capital to hedge
   * 
   * Operation Sequencing:
   * - Operations execute in order (1, 2, 3)
   * - Each operation can access results from previous operations via ExecutionContext
   * - If operation 1 determines unprofitable, operations 2 and 3 skip gracefully
   * - Operation 3 references operation 2's entry price for balanced execution
   * 
   * @param isOwned - Whether the current user owns this strategy
   */
  constructor(isOwned: boolean = false) {
    this.id = 'funding-rates-strategy-001';
    this.name = 'BTC Funding Rate Arbitrage';
    this.description = 'Captures funding rate profits on BTC/USDC by maintaining a delta-neutral position. Opens a perpetual short and hedges with spot buy to profit from positive funding rates while minimizing directional risk.';
    this.risk = 'medium';
    this.apr = { min: 15, max: 45 };
    this.price = '0.05'; // 0.05 RLC
    this.isOwned = isOwned;
    
    // Define the three operations that execute in the TEE
    // These operations are serialized and encrypted when purchased
    this.operations = [
      // Operation 1: Check if funding rate is profitable
      // This operation fetches the current BTC/USDC funding rate from Avantis
      // and determines if the arbitrage opportunity is worth executing.
      // It considers gas costs, trading fees, and the minimum profitable threshold.
      {
        type: OperationType.CHECK_FUNDING_RATE,
        order: 1,
        params: {
          ticker: 'BTC/USDC',           // Trading pair on Avantis
          minRate: 0.01,                 // Minimum 0.01% funding rate (1 basis point)
          exchange: 'avantis'            // Use Avantis perpetual DEX
        }
      },
      
      // Operation 2: Open perpetual short position
      // This operation opens a short position on Avantis using 50% of allocated capital.
      // The short position benefits from positive funding rates (longs pay shorts).
      // Uses 1x leverage for safety (no leverage multiplier).
      {
        type: OperationType.OPEN_SHORT,
        order: 2,
        params: {
          ticker: 'BTC/USDC',           // Trading pair on Avantis
          size: '50',                    // Use 50% of capital allocation
          isPercentage: true,            // Size is a percentage, not absolute amount
          leverage: 1,                   // 1x leverage (no leverage)
          exchange: 'avantis'            // Use Avantis perpetual DEX
        }
      },
      
      // Operation 3: Buy spot BTC to hedge the short
      // This operation buys BTC on the spot market via 1inch Fusion to create
      // a delta-neutral position. The spot buy hedges the short, eliminating
      // directional risk while allowing the strategy to capture funding payments.
      // 
      // For instant execution: Uses market order for immediate fill
      // For optimized execution: Uses limit order at short entry price for better execution
      {
        type: OperationType.SPOT_BUY,
        order: 3,
        params: {
          ticker: 'BTC/USDC',           // Trading pair
          amount: '50',                  // Use 50% of capital allocation
          isPercentage: true,            // Amount is a percentage, not absolute
          exchange: '1inch-fusion'       // Use 1inch Fusion for spot trading
        }
      }
    ];
  }
  
  /**
   * Serializes the strategy operations for TEE transmission.
   * 
   * The serialized format is a JSON string containing:
   * - Strategy metadata (id, name, version)
   * - Array of operations with their types, order, and parameters
   * 
   * This format can be deserialized by the TEE OperationFactory, which
   * creates concrete operation instances (CheckFundingRateOperation,
   * OpenPerpetualShortOperation, SpotBuyOperation) that execute within
   * the trusted environment.
   * 
   * Serialization Process:
   * 1. Create a serializable object with strategy metadata
   * 2. Map each operation to include type, order, and params
   * 3. Convert to JSON string for transmission
   * 4. The TEE OperationFactory deserializes this back into operation instances
   * 
   * Security Note:
   * The serialized operations are encrypted when stored via Data Protector.
   * Only users who have purchased the strategy can access the encrypted data.
   * The TEE decrypts and executes the operations securely.
   * 
   * @returns JSON string containing all operations with their parameters
   */
  serialize(): string {
    // Create a serializable object containing strategy metadata and operations
    const serializable = {
      strategyId: this.id,
      strategyName: this.name,
      version: '1.0.0',
      // Map operations to a clean format for TEE deserialization
      operations: this.operations.map(op => ({
        type: op.type,
        order: op.order,
        params: op.params
      }))
    };
    
    // Convert to JSON string for transmission to TEE
    // The TEE OperationFactory will deserialize this back into operation instances:
    // - CheckFundingRateOperation for CHECK_FUNDING_RATE
    // - OpenPerpetualShortOperation for OPEN_SHORT
    // - SpotBuyOperation for SPOT_BUY
    return JSON.stringify(serializable);
  }
  
  /**
   * Validates the strategy configuration before execution.
   * 
   * This method ensures all required parameters are present and within
   * acceptable ranges before the strategy is sent to the TEE for execution.
   * 
   * Validation Rules:
   * 1. Slippage tolerance must be between 0 and 100 (percentage)
   * 2. For optimized execution mode, spread percentage is optional
   * 3. Capital allocation must be a positive number if provided
   * 4. Execution mode must be either 'instant' or 'optimized'
   * 
   * Execution Modes:
   * - Instant: Uses market orders for immediate execution
   *   - Faster execution
   *   - May have higher slippage
   *   - Spread percentage is ignored
   * 
   * - Optimized: Uses limit orders for better price control
   *   - Slower execution (waits for price match)
   *   - Better price control
   *   - Spread percentage can be configured
   * 
   * @param config - User-provided strategy configuration
   * @returns ValidationResult indicating if configuration is valid
   */
  validate(config: StrategyConfig): ValidationResult {
    const errors: string[] = [];
    
    // Validate slippage tolerance
    // Slippage is the maximum acceptable price movement during execution
    // Range: 0-100 (percentage)
    // Example: 1 = 1% slippage tolerance
    if (config.slippageTolerance < 0 || config.slippageTolerance > 100) {
      errors.push('Slippage tolerance must be between 0 and 100');
    }
    
    // Validate spread percentage for optimized mode
    // Spread is the price difference between short and spot entry
    // Only applicable when using limit orders (optimized mode)
    if (config.executionMode === 'optimized') {
      if (config.spreadPercentage !== undefined) {
        if (config.spreadPercentage < 0 || config.spreadPercentage > 100) {
          errors.push('Spread percentage must be between 0 and 100');
        }
      }
    }
    
    // Validate capital allocation if provided
    // Capital allocation is the total amount to use for this strategy execution
    // Must be a positive number in USD or base currency
    if (config.capitalAllocation !== undefined) {
      const capital = parseFloat(config.capitalAllocation);
      if (isNaN(capital) || capital <= 0) {
        errors.push('Capital allocation must be a positive number');
      }
      
      // Warn if capital allocation is very small (may not cover gas costs)
      if (capital < 100) {
        errors.push('Capital allocation should be at least $100 to cover gas costs and fees');
      }
    } else {
      // Capital allocation is required for this strategy
      errors.push('Capital allocation is required for funding rate arbitrage strategy');
    }
    
    // Validate execution mode
    if (config.executionMode !== 'instant' && config.executionMode !== 'optimized') {
      errors.push('Execution mode must be either "instant" or "optimized"');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Gets the operations array for this strategy.
   * 
   * This method returns a copy of the operations array to prevent
   * external modification of the strategy's internal state.
   * 
   * The operations are:
   * 1. CheckFundingRateOperation (order: 1)
   * 2. OpenPerpetualShortOperation (order: 2)
   * 3. SpotBuyOperation (order: 3)
   * 
   * @returns Array of strategy operations
   */
  getOperations(): StrategyOperation[] {
    return [...this.operations];
  }
}
