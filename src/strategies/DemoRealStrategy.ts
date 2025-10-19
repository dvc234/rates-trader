/**
 * Demo Real Strategy
 * 
 * A demo strategy that executes REAL operations on Avantis and 1inch
 * with small amounts to let users test the platform safely.
 * 
 * WARNING: This strategy uses REAL funds on Base mainnet!
 * - Uses small amounts ($10-20 USDC)
 * - Executes real trades on 1inch Fusion
 * - Opens real perpetual positions on Avantis
 * - Incurs real gas fees
 * 
 * Use this to:
 * - Test the full execution pipeline
 * - Verify protocol integrations work
 * - Experience the platform with minimal risk
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
 * DemoRealStrategy - Test strategy with real protocol execution
 * 
 * This strategy demonstrates the full execution flow:
 * 1. Check funding rate on Avantis (BTC/USDC)
 * 2. If funding rate is positive, open a small short position
 * 3. Buy equivalent BTC spot on 1inch to hedge
 * 
 * Capital: $20 USDC (split 50/50)
 * - $10 for Avantis short position
 * - $10 for 1inch spot buy
 * 
 * Expected outcome:
 * - Delta neutral position (no price risk)
 * - Earning funding rate payments
 * - Real transactions on Base mainnet
 */
export class DemoRealStrategy implements Strategy {
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
   * Creates a new DemoRealStrategy instance
   * @param isOwned - Whether the current user owns this strategy
   */
  constructor(isOwned: boolean = false) {
    this.id = 'demo-real-strategy-001';
    this.name = '🧪 Demo: Real Execution Test';
    this.description = 
      '⚠️ REAL EXECUTION DEMO - Uses just $1 USDC to test real trades on Avantis and 1inch. ' +
      'This is a live test with real funds and gas fees. Perfect for verifying the platform works end-to-end. ' +
      'Opens a tiny BTC delta neutral position: short on Avantis + spot buy on 1inch.';
    this.risk = 'low';
    this.apr = { min: 5, max: 15 }; // Lower APR due to small size
    this.price = '0.001'; // Very cheap for testing (0.001 RLC)
    this.isOwned = isOwned;
    
    // Define real operations that will execute on Base mainnet
    this.operations = [
      {
        type: OperationType.CHECK_FUNDING_RATE,
        order: 1,
        params: {
          ticker: 'BTC/USDC',
          exchange: 'avantis',
          minRate: 0.0001, // 0.01% - very low threshold for demo
          description: 'Check if BTC funding rate is positive on Avantis'
        }
      },
      {
        type: OperationType.OPEN_SHORT,
        order: 2,
        params: {
          ticker: 'BTC/USDC',
          exchange: 'avantis',
          size: 50, // 50% of capital ($0.50)
          leverage: 1, // 1x leverage (no leverage for safety)
          description: 'Open tiny BTC short position on Avantis with $0.50'
        }
      },
      {
        type: OperationType.SPOT_BUY,
        order: 3,
        params: {
          ticker: 'BTC/USDC',
          exchange: '1inch-fusion',
          amount: 50, // 50% of capital ($0.50)
          description: 'Buy equivalent BTC spot on 1inch to hedge position'
        }
      }
    ];
  }
  
  /**
   * Serializes the strategy operations for TEE transmission
   * 
   * @returns JSON string containing all operations with their parameters
   */
  serialize(): string {
    const serializable = {
      strategyId: this.id,
      strategyName: this.name,
      version: '1.0.0',
      isDemo: true, // Flag to indicate this is a demo strategy
      operations: this.operations.map(op => ({
        type: op.type,
        order: op.order,
        params: op.params
      }))
    };
    
    return JSON.stringify(serializable);
  }
  
  /**
   * Validates the strategy configuration before execution
   * 
   * For demo strategy, we enforce strict limits:
   * - Capital must be exactly $20 (or not specified)
   * - Slippage must be reasonable (0.5% - 5%)
   * - Only instant execution mode allowed
   * 
   * @param config - User-provided strategy configuration
   * @returns ValidationResult indicating if configuration is valid
   */
  validate(config: StrategyConfig): ValidationResult {
    const errors: string[] = [];
    
    // Validate capital allocation
    if (config.capitalAllocation !== undefined) {
      const capital = parseFloat(config.capitalAllocation);
      
      if (isNaN(capital)) {
        errors.push('Capital allocation must be a valid number');
      } else if (capital < 1) {
        errors.push('Demo strategy requires minimum $1 USDC');
      } else if (capital > 10) {
        errors.push('Demo strategy limited to maximum $10 USDC for safety');
      }
    }
    
    // Validate slippage tolerance
    if (config.slippageTolerance < 0.5 || config.slippageTolerance > 5) {
      errors.push('Slippage tolerance must be between 0.5% and 5% for demo');
    }
    
    // Only allow instant execution for demo
    if (config.executionMode !== 'instant') {
      errors.push('Demo strategy only supports instant execution mode');
    }
    
    // Add warning about real execution
    if (errors.length === 0) {
      console.warn(
        '⚠️ DEMO STRATEGY WARNING: This will execute REAL trades on Base mainnet. ' +
        'You will spend real USDC and pay real gas fees. ' +
        'Make sure you understand the risks before proceeding.'
      );
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Gets the operations array for this strategy
   * @returns Array of strategy operations
   */
  getOperations(): StrategyOperation[] {
    return [...this.operations];
  }
}
