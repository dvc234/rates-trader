import { OperationType, ValidationResult, OperationResult } from './OperationTypes';
import { ExecutionContext } from '../executor/ExecutionContext';

/**
 * Base interface for all operations that execute within the TEE.
 * 
 * This interface follows the Command pattern, where each operation is a self-contained
 * unit of work that can be validated, executed, and potentially rolled back.
 * 
 * Operations are serialized from the frontend, deserialized in the TEE, and executed
 * sequentially as part of a strategy. Each operation has access to a shared ExecutionContext
 * that maintains state and provides access to services.
 * 
 * @example
 * ```typescript
 * class MyOperation implements IOperation {
 *   readonly type = OperationType.MY_OPERATION;
 *   readonly order = 1;
 *   
 *   validate(): ValidationResult {
 *     return { isValid: true, errors: [] };
 *   }
 *   
 *   async execute(context: ExecutionContext): Promise<OperationResult> {
 *     // Perform operation logic
 *     return { success: true, operationType: this.type };
 *   }
 * }
 * ```
 */
export interface IOperation {
  /**
   * The type of operation being performed.
   * Used for deserialization and result tracking.
   */
  readonly type: OperationType;
  
  /**
   * Execution order of this operation within the strategy.
   * Operations are sorted by this value and executed sequentially.
   * Lower numbers execute first.
   */
  readonly order: number;
  
  /**
   * Validates the operation's parameters before execution.
   * 
   * This method should check that all required parameters are present and valid,
   * but should not perform any side effects or blockchain interactions.
   * 
   * @returns ValidationResult indicating whether the operation is valid
   */
  validate(): ValidationResult;
  
  /**
   * Executes the operation within the TEE environment.
   * 
   * This method performs the actual work of the operation, which may include:
   * - Reading from the execution context state
   * - Calling blockchain services (DEX, perpetual, etc.)
   * - Writing results to the execution context state
   * - Returning transaction hashes and other result data
   * 
   * If the operation fails, it should return an OperationResult with success=false
   * and a sanitized error message that doesn't expose strategy logic.
   * 
   * @param context - The execution context with shared state and services
   * @returns Promise resolving to the operation result
   */
  execute(context: ExecutionContext): Promise<OperationResult>;
  
  /**
   * Rolls back the operation if possible.
   * 
   * This optional method is called when a subsequent operation fails and the
   * strategy executor attempts to undo previously executed operations.
   * 
   * Not all operations can be rolled back (e.g., completed blockchain transactions),
   * but operations should make a best effort to reverse their effects.
   * 
   * @param context - The execution context with shared state and services
   * @returns Promise that resolves when rollback is complete
   */
  rollback?(context: ExecutionContext): Promise<void>;
}
