/**
 * Operation types supported by the TEE execution environment.
 * Each type represents a distinct operation that can be executed as part of a strategy.
 */
export enum OperationType {
  /** Mock operation for testing TEE integration without real blockchain interactions */
  MOCK_OPERATION = 'mock_operation',
  
  /** Checks current funding rate and determines if execution should proceed */
  CHECK_FUNDING_RATE = 'check_funding_rate',
  
  /** Opens a short position on a perpetual DEX */
  OPEN_PERPETUAL_SHORT = 'open_perpetual_short',
  
  /** Executes a spot buy order using 1inch Fusion */
  SPOT_BUY = 'spot_buy',
  
  /** Closes an open position */
  CLOSE_POSITION = 'close_position'
}

/**
 * Result of a validation check on an operation.
 * Used to ensure operation parameters are valid before execution.
 */
export interface ValidationResult {
  /** Whether the validation passed */
  isValid: boolean;
  
  /** Array of error messages if validation failed */
  errors: string[];
}

/**
 * Result of an operation execution in the TEE.
 * Contains all relevant information about what happened during execution.
 */
export interface OperationResult {
  /** Whether the operation completed successfully */
  success: boolean;
  
  /** Type of operation that was executed */
  operationType: OperationType;
  
  /** Transaction hash if a blockchain transaction was executed */
  transactionHash?: string;
  
  /** Additional data returned by the operation */
  data?: Record<string, any>;
  
  /** Error information if the operation failed */
  error?: OperationError;
  
  /** Amount of gas used for the operation (in wei) */
  gasUsed?: string;
}

/**
 * Error information from a failed operation.
 * Messages are sanitized to prevent exposure of sensitive strategy logic.
 */
export interface OperationError {
  /** Error code for programmatic handling */
  code: string;
  
  /** User-friendly error message with no sensitive data */
  message: string;
  
  /** Whether the error is recoverable and execution can be retried */
  recoverable: boolean;
}
