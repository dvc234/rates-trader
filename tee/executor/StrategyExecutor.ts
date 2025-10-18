import { IOperation } from '../operations/IOperation';
import { OperationResult, OperationError } from '../operations/OperationTypes';
import { ExecutionContext } from './ExecutionContext';
import { OperationFactory } from './OperationFactory';

/**
 * Result of a complete strategy execution.
 * Contains aggregated results from all operations and overall execution status.
 */
export interface StrategyExecutionResult {
  /** Whether the entire strategy executed successfully */
  success: boolean;
  
  /** Results from each individual operation */
  operationResults: OperationResult[];
  
  /** Total gas used across all operations (in wei) */
  totalGasUsed: string;
  
  /** Error information if the strategy failed */
  error?: OperationError;
  
  /** Timestamp when execution started */
  startTime: number;
  
  /** Timestamp when execution completed */
  endTime: number;
}

/**
 * StrategyExecutor orchestrates the execution of a complete strategy within the TEE.
 * 
 * This class is the main entry point for strategy execution in the TEE environment.
 * It handles the complete lifecycle of strategy execution:
 * 
 * 1. **Initialization**: Deserializes encrypted strategy data into operation objects
 * 2. **Validation**: Validates all operations before execution begins
 * 3. **Execution**: Runs operations sequentially in order
 * 4. **Error Handling**: Sanitizes errors and attempts rollback on failure
 * 5. **Result Aggregation**: Collects results from all operations
 * 
 * The executor ensures that:
 * - Operations execute in the correct order
 * - Each operation has access to shared state via ExecutionContext
 * - Errors are caught and sanitized to prevent strategy logic exposure
 * - Failed operations trigger rollback attempts for previously executed operations
 * - All results are aggregated into a comprehensive execution report
 * 
 * @example
 * ```typescript
 * const executor = new StrategyExecutor();
 * 
 * // Initialize with serialized strategy data
 * executor.initialize(encryptedStrategyData);
 * 
 * // Execute the strategy
 * const result = await executor.execute(executionContext);
 * 
 * if (result.success) {
 *   console.log('Strategy executed successfully');
 *   console.log('Total gas used:', result.totalGasUsed);
 * } else {
 *   console.error('Strategy failed:', result.error);
 * }
 * ```
 */
export class StrategyExecutor {
  /** Array of operations to execute, sorted by order */
  private operations: IOperation[] = [];
  
  /** Array of successfully executed operations for rollback purposes */
  private executedOperations: IOperation[] = [];
  
  /**
   * Initializes the executor with serialized strategy data.
   * 
   * This method:
   * 1. Deserializes the JSON strategy data into operation objects
   * 2. Sorts operations by their order property
   * 3. Prepares the executor for execution
   * 
   * The serialized data is typically received from the iExec framework after
   * being encrypted and transmitted from the frontend. The data contains all
   * the operations that make up the strategy, along with their parameters.
   * 
   * @param serializedStrategy - JSON string containing strategy operations
   * @throws Error if deserialization fails or operations are invalid
   * 
   * @example
   * ```typescript
   * const strategyData = JSON.stringify({
   *   operations: [
   *     { type: 'check_funding_rate', order: 1, params: { ... } },
   *     { type: 'open_perpetual_short', order: 2, params: { ... } }
   *   ]
   * });
   * 
   * executor.initialize(strategyData);
   * ```
   */
  initialize(serializedStrategy: string): void {
    try {
      // Deserialize the strategy data into operation objects
      // OperationFactory handles parsing and instantiation
      this.operations = OperationFactory.deserialize(serializedStrategy);
      
      // Sort operations by their order property to ensure correct execution sequence
      // This is critical because operations may depend on state set by previous operations
      this.operations.sort((a, b) => a.order - b.order);
      
      // Reset executed operations array for fresh execution
      this.executedOperations = [];
      
    } catch (error) {
      // Wrap any initialization errors with context
      throw new Error(
        `Failed to initialize StrategyExecutor: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Executes all operations in the strategy sequentially.
   * 
   * This is the main execution method that orchestrates the complete strategy execution:
   * 
   * 1. **Validation Phase**: Validates all operations before execution begins
   * 2. **Execution Phase**: Executes each operation in order
   * 3. **State Management**: Tracks executed operations for potential rollback
   * 4. **Error Handling**: Catches errors, sanitizes them, and triggers rollback
   * 5. **Result Aggregation**: Collects all operation results and execution metrics
   * 
   * The execution flow:
   * - Operations execute sequentially in order
   * - Each operation can read/write to the shared ExecutionContext state
   * - If any operation fails, execution stops and rollback is attempted
   * - All errors are sanitized to prevent exposure of strategy logic
   * - Gas usage is tracked and aggregated across all operations
   * 
   * @param context - Execution context with wallet, config, and services
   * @returns Promise resolving to the complete strategy execution result
   * 
   * @example
   * ```typescript
   * const context: ExecutionContext = {
   *   config: { slippageTolerance: 1, executionMode: 'instant', capitalAllocation: '1000' },
   *   wallet: secureWallet,
   *   network: networkConfig,
   *   state: new Map(),
   *   getDexService: () => dexService,
   *   getPerpetualService: () => perpService,
   *   getOneInchService: () => oneInchService
   * };
   * 
   * const result = await executor.execute(context);
   * ```
   */
  async execute(context: ExecutionContext): Promise<StrategyExecutionResult> {
    const startTime = Date.now();
    const operationResults: OperationResult[] = [];
    let totalGasUsed = BigInt(0);
    
    try {
      // Validate all operations before starting execution
      // This ensures we catch parameter errors early before any blockchain interactions
      this.validateAllOperations();
      
      // Execute each operation sequentially
      // Operations are already sorted by order during initialization
      for (const operation of this.operations) {
        try {
          // Execute the operation and capture its result
          const result = await operation.execute(context);
          
          // Track the result for aggregation
          operationResults.push(result);
          
          // If the operation failed, stop execution and trigger rollback
          if (!result.success) {
            // Attempt to rollback previously executed operations
            await this.rollback(context);
            
            // Return failure result with sanitized error
            return {
              success: false,
              operationResults,
              totalGasUsed: totalGasUsed.toString(),
              error: result.error || this.createSanitizedError('OPERATION_FAILED', 'Operation failed'),
              startTime,
              endTime: Date.now()
            };
          }
          
          // Track gas usage if available
          if (result.gasUsed) {
            totalGasUsed += BigInt(result.gasUsed);
          }
          
          // Add to executed operations for potential rollback
          this.executedOperations.push(operation);
          
        } catch (error) {
          // Catch any unexpected errors during operation execution
          // Sanitize the error to prevent exposure of strategy logic
          const sanitizedError = this.sanitizeError(error);
          
          // Add error result to operation results
          operationResults.push({
            success: false,
            operationType: operation.type,
            error: sanitizedError
          });
          
          // Attempt rollback of previously executed operations
          await this.rollback(context);
          
          // Return failure result
          return {
            success: false,
            operationResults,
            totalGasUsed: totalGasUsed.toString(),
            error: sanitizedError,
            startTime,
            endTime: Date.now()
          };
        }
      }
      
      // All operations executed successfully
      return {
        success: true,
        operationResults,
        totalGasUsed: totalGasUsed.toString(),
        startTime,
        endTime: Date.now()
      };
      
    } catch (error) {
      // Catch any errors during validation or execution setup
      const sanitizedError = this.sanitizeError(error);
      
      return {
        success: false,
        operationResults,
        totalGasUsed: totalGasUsed.toString(),
        error: sanitizedError,
        startTime,
        endTime: Date.now()
      };
    }
  }

  /**
   * Attempts to rollback previously executed operations in reverse order.
   * 
   * When an operation fails, this method attempts to undo the effects of
   * previously executed operations by calling their rollback() methods.
   * 
   * Rollback behavior:
   * - Operations are rolled back in reverse order (last executed first)
   * - Not all operations can be fully rolled back (e.g., completed blockchain txs)
   * - Rollback errors are logged but don't stop the rollback process
   * - Best effort approach - some state changes may be irreversible
   * 
   * This is a critical safety mechanism to prevent partial strategy execution
   * from leaving the user's positions in an inconsistent state.
   * 
   * @param context - Execution context with wallet and services
   * @returns Promise that resolves when rollback attempts are complete
   * 
   * @example
   * ```typescript
   * // If operation 3 fails after operations 1 and 2 succeeded:
   * // 1. Operation 2 rollback is attempted
   * // 2. Operation 1 rollback is attempted
   * // 3. Rollback completes (best effort)
   * ```
   */
  async rollback(context: ExecutionContext): Promise<void> {
    // Rollback in reverse order (last executed first)
    // This ensures dependencies are handled correctly
    const operationsToRollback = [...this.executedOperations].reverse();
    
    for (const operation of operationsToRollback) {
      // Only attempt rollback if the operation implements the rollback method
      if (operation.rollback) {
        try {
          await operation.rollback(context);
        } catch (error) {
          // Log rollback errors but continue with other rollbacks
          // We use console.error since this is in the TEE environment
          console.error(
            `Failed to rollback operation ${operation.type}:`,
            error instanceof Error ? error.message : 'Unknown error'
          );
          // Continue with remaining rollbacks despite this failure
        }
      }
    }
    
    // Clear the executed operations array after rollback attempt
    this.executedOperations = [];
  }

  /**
   * Validates all operations before execution begins.
   * 
   * This method calls the validate() method on each operation to ensure
   * all parameters are valid before any blockchain interactions occur.
   * 
   * Early validation prevents:
   * - Wasting gas on transactions that will fail
   * - Partial strategy execution due to invalid parameters
   * - Exposing the wallet to unnecessary risk
   * 
   * @throws Error if any operation fails validation
   * 
   * @private
   */
  private validateAllOperations(): void {
    for (const operation of this.operations) {
      const validationResult = operation.validate();
      
      if (!validationResult.isValid) {
        // Combine all validation errors into a single message
        const errorMessage = validationResult.errors.join('; ');
        throw new Error(
          `Validation failed for operation ${operation.type} (order ${operation.order}): ${errorMessage}`
        );
      }
    }
  }
  
  /**
   * Sanitizes an error to prevent exposure of sensitive strategy logic.
   * 
   * This is a critical security method that ensures error messages returned
   * from the TEE don't reveal details about the strategy implementation.
   * 
   * Sanitization rules:
   * - Remove specific parameter values
   * - Remove operation details
   * - Remove stack traces
   * - Provide generic, user-friendly error messages
   * - Preserve error codes for programmatic handling
   * 
   * The goal is to provide enough information for debugging without exposing
   * the strategy's logic, which is the creator's intellectual property.
   * 
   * @param error - The error to sanitize
   * @returns Sanitized OperationError safe for external consumption
   * 
   * @private
   */
  private sanitizeError(error: unknown): OperationError {
    // Extract error message if available
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    
    // Determine error code based on message content
    // This allows for programmatic error handling without exposing details
    let code = 'EXECUTION_ERROR';
    let sanitizedMessage = 'Strategy execution failed';
    let recoverable = false;
    
    // Check for specific error patterns and map to generic codes
    if (message.includes('insufficient funds') || message.includes('balance')) {
      code = 'INSUFFICIENT_FUNDS';
      sanitizedMessage = 'Insufficient funds to complete operation';
      recoverable = true;
    } else if (message.includes('slippage') || message.includes('price')) {
      code = 'SLIPPAGE_EXCEEDED';
      sanitizedMessage = 'Price moved beyond acceptable slippage tolerance';
      recoverable = true;
    } else if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
      code = 'NETWORK_ERROR';
      sanitizedMessage = 'Network error occurred during execution';
      recoverable = true;
    } else if (message.includes('validation') || message.includes('invalid')) {
      code = 'VALIDATION_ERROR';
      sanitizedMessage = 'Invalid operation parameters';
      recoverable = false;
    } else if (message.includes('gas')) {
      code = 'GAS_ERROR';
      sanitizedMessage = 'Gas estimation or execution failed';
      recoverable = true;
    }
    
    return {
      code,
      message: sanitizedMessage,
      recoverable
    };
  }
  
  /**
   * Creates a sanitized error with specific code and message.
   * 
   * Helper method for creating OperationError objects with predefined
   * error codes and messages.
   * 
   * @param code - Error code for programmatic handling
   * @param message - User-friendly error message
   * @returns Sanitized OperationError
   * 
   * @private
   */
  private createSanitizedError(code: string, message: string): OperationError {
    return {
      code,
      message,
      recoverable: false
    };
  }
}
