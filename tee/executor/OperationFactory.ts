import { IOperation } from '../operations/IOperation';
import { OperationType } from '../operations/OperationTypes';
import { MockOperation } from '../operations/MockOperation';

/**
 * Serialized operation data structure.
 * This represents how operations are transmitted from the frontend to the TEE.
 */
interface SerializedOperation {
  /** Type of operation to create */
  type: OperationType;
  
  /** Execution order within the strategy */
  order: number;
  
  /** Operation-specific parameters */
  params: Record<string, any>;
}

/**
 * Container for serialized strategy data.
 * This is the top-level structure passed to the TEE for execution.
 */
interface SerializedStrategy {
  /** Array of operations to execute */
  operations: SerializedOperation[];
  
  /** Strategy metadata (optional) */
  metadata?: {
    strategyId: string;
    version: string;
  };
}

/**
 * OperationFactory is responsible for deserializing JSON operation data
 * into concrete IOperation instances that can be executed in the TEE.
 * 
 * This factory implements the Factory pattern to encapsulate the creation logic
 * for different operation types. It handles:
 * - Parsing serialized JSON data
 * - Validating operation structure
 * - Creating appropriate operation instances based on type
 * - Handling unknown operation types gracefully
 * 
 * The factory is a critical component in the TEE execution pipeline, as it
 * transforms the encrypted strategy data received from the frontend into
 * executable operation objects.
 * 
 * @example
 * ```typescript
 * const serialized = JSON.stringify({
 *   operations: [
 *     { type: 'mock_operation', order: 1, params: { message: 'Test', delay: 1000 } }
 *   ]
 * });
 * 
 * const operations = OperationFactory.deserialize(serialized);
 * // Returns: [MockOperation instance]
 * ```
 */
export class OperationFactory {
  /**
   * Deserializes a JSON string containing strategy operations into an array
   * of executable IOperation instances.
   * 
   * This method is the main entry point for converting serialized strategy data
   * (received from the frontend via iExec) into operation objects that can be
   * validated and executed by the StrategyExecutor.
   * 
   * Deserialization process:
   * 1. Parse the JSON string into a structured object
   * 2. Extract the operations array
   * 3. For each operation, call createOperation() to instantiate the correct type
   * 4. Return the array of operation instances
   * 
   * @param serialized - JSON string containing serialized strategy data
   * @returns Array of IOperation instances ready for execution
   * @throws Error if JSON parsing fails or operation structure is invalid
   * 
   * @example
   * ```typescript
   * const json = '{"operations":[{"type":"mock_operation","order":1,"params":{"message":"Hello","delay":500}}]}';
   * const ops = OperationFactory.deserialize(json);
   * ```
   */
  static deserialize(serialized: string): IOperation[] {
    // Parse the JSON string into a structured object
    // This may throw if the JSON is malformed
    let data: SerializedStrategy;
    try {
      data = JSON.parse(serialized);
    } catch (error) {
      throw new Error(`Failed to parse serialized strategy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Validate that we have an operations array
    if (!data.operations || !Array.isArray(data.operations)) {
      throw new Error('Invalid strategy structure: missing or invalid operations array');
    }
    
    // Map each serialized operation to a concrete IOperation instance
    // The createOperation method handles the type-specific instantiation
    return data.operations.map((op: SerializedOperation, index: number) => {
      try {
        return this.createOperation(op);
      } catch (error) {
        // Provide context about which operation failed
        throw new Error(
          `Failed to deserialize operation at index ${index}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });
  }
  
  /**
   * Creates a concrete IOperation instance from serialized operation data.
   * 
   * This is the core factory method that implements the type-based instantiation
   * logic. It uses a switch statement on the operation type to determine which
   * concrete class to instantiate.
   * 
   * Each case in the switch:
   * 1. Validates that required parameters are present
   * 2. Extracts parameters with appropriate defaults
   * 3. Instantiates the concrete operation class
   * 4. Returns the operation instance
   * 
   * When adding new operation types:
   * 1. Add the type to the OperationType enum
   * 2. Create the operation class implementing IOperation
   * 3. Add a new case to this switch statement
   * 4. Extract and validate the operation's specific parameters
   * 
   * @param op - Serialized operation data with type, order, and params
   * @returns Concrete IOperation instance
   * @throws Error if operation type is unknown or required parameters are missing
   * 
   * @example
   * ```typescript
   * const serializedOp = {
   *   type: OperationType.MOCK_OPERATION,
   *   order: 1,
   *   params: { message: 'Test', delay: 2000 }
   * };
   * const operation = OperationFactory.createOperation(serializedOp);
   * // Returns: MockOperation instance
   * ```
   */
  private static createOperation(op: SerializedOperation): IOperation {
    // Validate basic operation structure
    if (!op.type) {
      throw new Error('Operation missing required "type" field');
    }
    
    if (typeof op.order !== 'number') {
      throw new Error('Operation missing required "order" field or order is not a number');
    }
    
    if (!op.params || typeof op.params !== 'object') {
      throw new Error('Operation missing required "params" field or params is not an object');
    }
    
    // Switch on operation type to create the appropriate concrete instance
    // Each case extracts the type-specific parameters and instantiates the class
    switch (op.type) {
      case OperationType.MOCK_OPERATION:
        // MockOperation parameters:
        // - message: string (required) - message to log
        // - delay: number (optional, default 1000) - delay in milliseconds
        return this.createMockOperation(op);
      
      // Future operation types will be added here as they are implemented:
      // case OperationType.CHECK_FUNDING_RATE:
      //   return this.createCheckFundingRateOperation(op);
      // 
      // case OperationType.OPEN_PERPETUAL_SHORT:
      //   return this.createOpenPerpetualShortOperation(op);
      // 
      // case OperationType.SPOT_BUY:
      //   return this.createSpotBuyOperation(op);
      
      default:
        // Unknown operation type - this helps catch typos or version mismatches
        throw new Error(`Unknown operation type: ${op.type}`);
    }
  }
  
  /**
   * Creates a MockOperation instance from serialized data.
   * 
   * This helper method encapsulates the parameter extraction and validation
   * logic specific to MockOperation. It ensures that:
   * - Required parameters (message) are present
   * - Optional parameters (delay) have sensible defaults
   * - Parameter types are correct
   * 
   * @param op - Serialized operation data
   * @returns MockOperation instance
   * @throws Error if required parameters are missing or invalid
   */
  private static createMockOperation(op: SerializedOperation): MockOperation {
    // Extract and validate the message parameter (required)
    const message = op.params.message;
    if (typeof message !== 'string') {
      throw new Error('MockOperation requires "message" parameter of type string');
    }
    
    // Extract the delay parameter with a default value (optional)
    // Default to 1000ms if not provided
    const delay = typeof op.params.delay === 'number' ? op.params.delay : 1000;
    
    // Instantiate and return the MockOperation
    return new MockOperation(op.order, message, delay);
  }
}
