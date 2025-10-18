import { IOperation } from './IOperation';
import { OperationType, ValidationResult, OperationResult } from './OperationTypes';
import { ExecutionContext } from '../executor/ExecutionContext';

/**
 * MockOperation is a simple test operation used to verify TEE integration
 * without requiring real blockchain interactions.
 * 
 * This operation simulates work by logging a message and introducing a configurable
 * delay. It's useful for:
 * - Testing the TEE execution pipeline
 * - Verifying operation serialization/deserialization
 * - Validating the StrategyExecutor orchestration
 * - Demonstrating the operation lifecycle (validate -> execute)
 * 
 * @example
 * ```typescript
 * const mockOp = new MockOperation(1, 'Testing TEE execution', 2000);
 * const validation = mockOp.validate();
 * if (validation.isValid) {
 *   const result = await mockOp.execute(context);
 *   console.log(result.data?.message); // 'Testing TEE execution'
 * }
 * ```
 */
export class MockOperation implements IOperation {
  /** Operation type identifier for serialization/deserialization */
  readonly type = OperationType.MOCK_OPERATION;
  
  /** Execution order within the strategy */
  readonly order: number;
  
  /** Message to log during execution */
  private readonly message: string;
  
  /** Delay in milliseconds to simulate work */
  private readonly delay: number;
  
  /**
   * Creates a new MockOperation instance.
   * 
   * @param order - Execution order (lower numbers execute first)
   * @param message - Message to log during execution
   * @param delay - Delay in milliseconds to simulate work (default: 1000ms)
   */
  constructor(order: number, message: string, delay: number = 1000) {
    this.order = order;
    this.message = message;
    this.delay = delay;
  }
  
  /**
   * Validates the operation parameters.
   * 
   * For MockOperation, we validate that:
   * - The delay is non-negative (can't go back in time!)
   * - The delay is reasonable (max 10 seconds to prevent hanging)
   * 
   * @returns ValidationResult indicating whether parameters are valid
   */
  validate(): ValidationResult {
    const errors: string[] = [];
    
    // Validate delay is within acceptable range
    if (this.delay < 0) {
      errors.push('Delay must be non-negative');
    }
    
    if (this.delay > 10000) {
      errors.push('Delay must not exceed 10000ms (10 seconds)');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Executes the mock operation within the TEE.
   * 
   * Execution flow:
   * 1. Log the message to console (visible in TEE logs)
   * 2. Simulate work by waiting for the configured delay
   * 3. Return success result with execution metadata
   * 
   * This operation doesn't interact with the blockchain or modify shared state,
   * making it safe for testing the execution pipeline.
   * 
   * @param _context - Execution context (not used by MockOperation)
   * @returns Promise resolving to operation result with execution metadata
   */
  async execute(_context: ExecutionContext): Promise<OperationResult> {
    // Log message to TEE console for debugging/verification
    console.log(`[TEE MockOperation] ${this.message}`);
    
    // Simulate work by introducing a delay
    // This helps test async operation handling in the executor
    await new Promise(resolve => setTimeout(resolve, this.delay));
    
    // Return success result with metadata about the execution
    return {
      success: true,
      operationType: this.type,
      data: {
        message: this.message,
        executedAt: Date.now(),
        delayMs: this.delay
      }
    };
  }
}
