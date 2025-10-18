/**
 * Mock Strategy Implementation
 * A simple test strategy used to validate TEE integration and execution flow
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
 * MockStrategy class implementing a simple test strategy
 * This strategy executes mock operations in the TEE to validate the execution pipeline
 * without performing actual blockchain transactions
 */
export class MockStrategy implements Strategy {
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
   * Creates a new MockStrategy instance
   * @param isOwned - Whether the current user owns this strategy
   */
  constructor(isOwned: boolean = false) {
    this.id = 'mock-strategy-001';
    this.name = 'Mock Test Strategy';
    this.description = 'A simple test strategy that executes mock operations in the TEE to validate the execution pipeline. No real trades are executed.';
    this.risk = 'low';
    this.apr = { min: 0, max: 0 };
    this.price = '0.01'; // 0.01 RLC for testing
    this.isOwned = isOwned;
    
    // Define mock operations that will execute in TEE
    this.operations = [
      {
        type: OperationType.MOCK_OPERATION,
        order: 1,
        params: {
          message: 'Mock operation 1: Initializing strategy',
          delay: 1000
        }
      },
      {
        type: OperationType.MOCK_OPERATION,
        order: 2,
        params: {
          message: 'Mock operation 2: Validating parameters',
          delay: 500
        }
      },
      {
        type: OperationType.MOCK_OPERATION,
        order: 3,
        params: {
          message: 'Mock operation 3: Completing execution',
          delay: 1000
        }
      }
    ];
  }
  
  /**
   * Serializes the strategy operations for TEE transmission
   * The serialized format can be deserialized by the TEE OperationFactory
   * 
   * @returns JSON string containing all operations with their parameters
   */
  serialize(): string {
    // Create a serializable object containing all operations
    const serializable = {
      strategyId: this.id,
      strategyName: this.name,
      version: '1.0.0',
      operations: this.operations.map(op => ({
        type: op.type,
        order: op.order,
        params: op.params
      }))
    };
    
    // Convert to JSON string for transmission to TEE
    // The TEE OperationFactory will deserialize this back into operation instances
    return JSON.stringify(serializable);
  }
  
  /**
   * Validates the strategy configuration before execution
   * Ensures all required parameters are present and within acceptable ranges
   * 
   * @param config - User-provided strategy configuration
   * @returns ValidationResult indicating if configuration is valid
   */
  validate(config: StrategyConfig): ValidationResult {
    const errors: string[] = [];
    
    // Validate slippage tolerance
    if (config.slippageTolerance < 0 || config.slippageTolerance > 100) {
      errors.push('Slippage tolerance must be between 0 and 100');
    }
    
    // Validate spread percentage for optimized mode
    if (config.executionMode === 'optimized') {
      if (config.spreadPercentage === undefined) {
        errors.push('Spread percentage is required for optimized execution mode');
      } else if (config.spreadPercentage < 0 || config.spreadPercentage > 100) {
        errors.push('Spread percentage must be between 0 and 100');
      }
    }
    
    // Validate capital allocation if provided
    if (config.capitalAllocation !== undefined) {
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
  
  /**
   * Gets the operations array for this strategy
   * @returns Array of strategy operations
   */
  getOperations(): StrategyOperation[] {
    return [...this.operations];
  }
}
