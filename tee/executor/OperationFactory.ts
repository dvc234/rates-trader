import { IOperation } from '../operations/IOperation';
import { OperationType } from '../operations/OperationTypes';
import { MockOperation } from '../operations/MockOperation';
import { CheckFundingRateOperation } from '../operations/CheckFundingRateOperation';
import { OpenPerpetualShortOperation } from '../operations/OpenPerpetualShortOperation';
import { SpotBuyOperation } from '../operations/SpotBuyOperation';

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
      
      case OperationType.CHECK_FUNDING_RATE:
        // CheckFundingRateOperation parameters:
        // - pair: string (required) - trading pair to check (e.g., 'BTC/USD')
        // - minProfitableRate: number (required) - minimum funding rate threshold
        // - estimatedGasCostUSD: string (optional, default '50') - estimated gas cost
        return this.createCheckFundingRateOperation(op);
      
      case OperationType.OPEN_PERPETUAL_SHORT:
        // OpenPerpetualShortOperation parameters:
        // - pair: string (required) - trading pair for the short (e.g., 'BTC/USD')
        // - capitalPercentage: number (required) - percentage of capital to allocate (0-100)
        // - leverage: number (optional, default 1) - leverage multiplier (1-10)
        return this.createOpenPerpetualShortOperation(op);
      
      case OperationType.SPOT_BUY:
        // SpotBuyOperation parameters:
        // - asset: string (required) - asset to buy (e.g., 'BTC', 'ETH')
        // - capitalPercentage: number (required) - percentage of capital to allocate (0-100)
        // - orderType: string (required) - order type ('market' or 'limit')
        // - priceReference: string (optional) - price reference for limit orders ('short_entry_price')
        return this.createSpotBuyOperation(op);
      
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
  
  /**
   * Creates a CheckFundingRateOperation instance from serialized data.
   * 
   * This helper method extracts and validates the parameters specific to
   * CheckFundingRateOperation. It ensures that:
   * - Required parameters (pair, minProfitableRate) are present and valid
   * - Optional parameters (estimatedGasCostUSD) have sensible defaults
   * - Parameter types are correct
   * 
   * The CheckFundingRateOperation is used to determine if the current funding
   * rate on a perpetual DEX is profitable enough to execute the strategy.
   * 
   * @param op - Serialized operation data
   * @returns CheckFundingRateOperation instance
   * @throws Error if required parameters are missing or invalid
   */
  private static createCheckFundingRateOperation(op: SerializedOperation): CheckFundingRateOperation {
    // Extract and validate the pair parameter (required)
    // This should be a trading pair like 'BTC/USD' or 'ETH/USD'
    const pair = op.params.pair;
    if (typeof pair !== 'string' || pair.trim().length === 0) {
      throw new Error('CheckFundingRateOperation requires "pair" parameter of type string');
    }
    
    // Extract and validate the minProfitableRate parameter (required)
    // This should be a decimal number representing the minimum funding rate threshold
    // Example: 0.01 = 1% = 100 basis points
    const minProfitableRate = op.params.minProfitableRate;
    if (typeof minProfitableRate !== 'number') {
      throw new Error('CheckFundingRateOperation requires "minProfitableRate" parameter of type number');
    }
    
    // Validate that minProfitableRate is in a reasonable range
    if (minProfitableRate < 0 || minProfitableRate > 1.0) {
      throw new Error('CheckFundingRateOperation "minProfitableRate" must be between 0 and 1.0');
    }
    
    // Extract the estimatedGasCostUSD parameter with a default value (optional)
    // This should be a string representing the estimated gas cost in USD
    // Default to '50' if not provided (reasonable estimate for Base mainnet)
    let estimatedGasCostUSD = '50';
    if (op.params.estimatedGasCostUSD !== undefined) {
      if (typeof op.params.estimatedGasCostUSD === 'string') {
        estimatedGasCostUSD = op.params.estimatedGasCostUSD;
      } else if (typeof op.params.estimatedGasCostUSD === 'number') {
        // Convert number to string if provided as number
        estimatedGasCostUSD = op.params.estimatedGasCostUSD.toString();
      } else {
        throw new Error('CheckFundingRateOperation "estimatedGasCostUSD" must be a string or number');
      }
    }
    
    // Instantiate and return the CheckFundingRateOperation
    return new CheckFundingRateOperation(op.order, pair, minProfitableRate, estimatedGasCostUSD);
  }
  
  /**
   * Creates an OpenPerpetualShortOperation instance from serialized data.
   * 
   * This helper method extracts and validates the parameters specific to
   * OpenPerpetualShortOperation. It ensures that:
   * - Required parameters (pair, capitalPercentage) are present and valid
   * - Optional parameters (leverage) have sensible defaults
   * - Parameter types are correct
   * 
   * The OpenPerpetualShortOperation opens a short position on a perpetual DEX
   * as part of a funding rate arbitrage strategy. The short benefits from
   * positive funding rates where longs pay shorts.
   * 
   * @param op - Serialized operation data
   * @returns OpenPerpetualShortOperation instance
   * @throws Error if required parameters are missing or invalid
   */
  private static createOpenPerpetualShortOperation(op: SerializedOperation): OpenPerpetualShortOperation {
    // Extract and validate the pair parameter (required)
    // This should be a trading pair like 'BTC/USD' or 'ETH/USD'
    const pair = op.params.pair;
    if (typeof pair !== 'string' || pair.trim().length === 0) {
      throw new Error('OpenPerpetualShortOperation requires "pair" parameter of type string');
    }
    
    // Extract and validate the capitalPercentage parameter (required)
    // This should be a number between 0 and 100 representing the percentage
    // of total capital to allocate to this short position
    const capitalPercentage = op.params.capitalPercentage;
    if (typeof capitalPercentage !== 'number') {
      throw new Error('OpenPerpetualShortOperation requires "capitalPercentage" parameter of type number');
    }
    
    // Validate that capitalPercentage is in a reasonable range
    if (capitalPercentage <= 0 || capitalPercentage > 100) {
      throw new Error('OpenPerpetualShortOperation "capitalPercentage" must be between 0 and 100');
    }
    
    // Extract the leverage parameter with a default value (optional)
    // Default to 1 (no leverage) if not provided
    // Leverage should be between 1 and 10 for safety
    let leverage = 1;
    if (op.params.leverage !== undefined) {
      if (typeof op.params.leverage === 'number') {
        leverage = op.params.leverage;
      } else {
        throw new Error('OpenPerpetualShortOperation "leverage" must be a number');
      }
      
      // Validate leverage range
      if (leverage < 1 || leverage > 10) {
        throw new Error('OpenPerpetualShortOperation "leverage" must be between 1 and 10');
      }
    }
    
    // Instantiate and return the OpenPerpetualShortOperation
    return new OpenPerpetualShortOperation(op.order, pair, capitalPercentage, leverage);
  }
  
  /**
   * Creates a SpotBuyOperation instance from serialized data.
   * 
   * This helper method extracts and validates the parameters specific to
   * SpotBuyOperation. It ensures that:
   * - Required parameters (asset, capitalPercentage, orderType) are present and valid
   * - Optional parameters (priceReference) are validated if provided
   * - Parameter types are correct
   * 
   * The SpotBuyOperation executes a spot buy using 1inch Fusion to balance
   * the short position and create a delta-neutral arbitrage position.
   * 
   * @param op - Serialized operation data
   * @returns SpotBuyOperation instance
   * @throws Error if required parameters are missing or invalid
   */
  private static createSpotBuyOperation(op: SerializedOperation): SpotBuyOperation {
    // Extract and validate the asset parameter (required)
    // This should be an asset symbol like 'BTC', 'ETH', etc.
    const asset = op.params.asset;
    if (typeof asset !== 'string' || asset.trim().length === 0) {
      throw new Error('SpotBuyOperation requires "asset" parameter of type string');
    }
    
    // Extract and validate the capitalPercentage parameter (required)
    // This should be a number between 0 and 100 representing the percentage
    // of total capital to allocate to this spot buy
    const capitalPercentage = op.params.capitalPercentage;
    if (typeof capitalPercentage !== 'number') {
      throw new Error('SpotBuyOperation requires "capitalPercentage" parameter of type number');
    }
    
    // Validate that capitalPercentage is in a reasonable range
    if (capitalPercentage <= 0 || capitalPercentage > 100) {
      throw new Error('SpotBuyOperation "capitalPercentage" must be between 0 and 100');
    }
    
    // Extract and validate the orderType parameter (required)
    // This should be either 'market' or 'limit'
    const orderType = op.params.orderType;
    if (typeof orderType !== 'string') {
      throw new Error('SpotBuyOperation requires "orderType" parameter of type string');
    }
    
    // Validate that orderType is one of the allowed values
    if (orderType !== 'market' && orderType !== 'limit') {
      throw new Error('SpotBuyOperation "orderType" must be either "market" or "limit"');
    }
    
    // Extract the priceReference parameter (optional)
    // This is only used for limit orders to reference the short entry price
    let priceReference: 'short_entry_price' | undefined;
    if (op.params.priceReference !== undefined) {
      if (typeof op.params.priceReference !== 'string') {
        throw new Error('SpotBuyOperation "priceReference" must be a string');
      }
      
      // Validate that priceReference is a valid value
      if (op.params.priceReference !== 'short_entry_price') {
        throw new Error('SpotBuyOperation "priceReference" must be "short_entry_price" if provided');
      }
      
      priceReference = op.params.priceReference as 'short_entry_price';
    }
    
    // Instantiate and return the SpotBuyOperation
    return new SpotBuyOperation(op.order, asset, capitalPercentage, orderType as 'market' | 'limit', priceReference);
  }
}
