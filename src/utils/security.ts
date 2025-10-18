/**
 * Security Utilities Module
 * 
 * Provides comprehensive security measures for the DeFi Strategy Platform:
 * - Input validation for all user inputs
 * - Error message sanitization (prevents sensitive data exposure)
 * - Transaction parameter validation before signing
 * - Address validation and sanitization
 * 
 * Security Principles:
 * - Fail-safe defaults (reject invalid inputs)
 * - No sensitive data in error messages
 * - Strict validation before blockchain operations
 * - Defense in depth (multiple validation layers)
 */

/**
 * Validation result interface
 */
export interface SecurityValidationResult {
  /** Whether validation passed */
  isValid: boolean;
  /** Sanitized error message (safe to display to users) */
  error?: string;
  /** Sanitized value (if applicable) */
  sanitizedValue?: any;
}

/**
 * Transaction parameters for validation
 */
export interface TransactionParams {
  to: string;
  value?: string | bigint;
  data?: string;
  gasLimit?: string | bigint;
  maxFeePerGas?: string | bigint;
  maxPriorityFeePerGas?: string | bigint;
}

// ============================================================================
// INPUT VALIDATION
// ============================================================================

/**
 * Validates Ethereum address format
 * 
 * Validation Rules:
 * - Must start with '0x'
 * - Must be exactly 42 characters (0x + 40 hex chars)
 * - Must contain only valid hex characters
 * 
 * @param address - Address to validate
 * @returns Validation result with sanitized address
 */
export function validateAddress(address: string): SecurityValidationResult {
  // Check if address is provided
  if (!address || typeof address !== 'string') {
    return {
      isValid: false,
      error: 'Address is required',
    };
  }

  // Trim whitespace
  const trimmed = address.trim();

  // Check format: 0x followed by 40 hex characters
  const addressRegex = /^0x[a-fA-F0-9]{40}$/;
  if (!addressRegex.test(trimmed)) {
    return {
      isValid: false,
      error: 'Invalid address format',
    };
  }

  // Return sanitized address (lowercase for consistency)
  return {
    isValid: true,
    sanitizedValue: trimmed.toLowerCase(),
  };
}

/**
 * Validates numeric input (percentages, amounts, etc.)
 * 
 * Validation Rules:
 * - Must be a valid number
 * - Must be within specified range
 * - Must not be NaN or Infinity
 * 
 * @param value - Value to validate
 * @param min - Minimum allowed value (inclusive)
 * @param max - Maximum allowed value (inclusive)
 * @param fieldName - Name of field for error messages
 * @returns Validation result with sanitized number
 */
export function validateNumericInput(
  value: any,
  min: number,
  max: number,
  fieldName: string
): SecurityValidationResult {
  // Check if value is provided
  if (value === undefined || value === null || value === '') {
    return {
      isValid: false,
      error: `${fieldName} is required`,
    };
  }

  // Convert to number
  const num = Number(value);

  // Check if valid number
  if (isNaN(num) || !isFinite(num)) {
    return {
      isValid: false,
      error: `${fieldName} must be a valid number`,
    };
  }

  // Check range
  if (num < min || num > max) {
    return {
      isValid: false,
      error: `${fieldName} must be between ${min} and ${max}`,
    };
  }

  return {
    isValid: true,
    sanitizedValue: num,
  };
}

/**
 * Validates strategy ID format
 * 
 * Strategy IDs can be:
 * - UUID format (for local strategies)
 * - Ethereum address format (for protected data addresses)
 * 
 * @param strategyId - Strategy ID to validate
 * @returns Validation result with sanitized ID
 */
export function validateStrategyId(strategyId: string): SecurityValidationResult {
  if (!strategyId || typeof strategyId !== 'string') {
    return {
      isValid: false,
      error: 'Strategy ID is required',
    };
  }

  const trimmed = strategyId.trim();

  // Check if it's an Ethereum address
  const addressRegex = /^0x[a-fA-F0-9]{40}$/;
  if (addressRegex.test(trimmed)) {
    return {
      isValid: true,
      sanitizedValue: trimmed.toLowerCase(),
    };
  }

  // Check if it's a UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(trimmed)) {
    return {
      isValid: true,
      sanitizedValue: trimmed.toLowerCase(),
    };
  }

  return {
    isValid: false,
    error: 'Invalid strategy ID format',
  };
}

/**
 * Validates task ID format (iExec task IDs)
 * 
 * Task IDs are 66-character hex strings (0x + 64 hex chars)
 * 
 * @param taskId - Task ID to validate
 * @returns Validation result with sanitized task ID
 */
export function validateTaskId(taskId: string): SecurityValidationResult {
  if (!taskId || typeof taskId !== 'string') {
    return {
      isValid: false,
      error: 'Task ID is required',
    };
  }

  const trimmed = taskId.trim();

  // Task IDs are 66 characters: 0x + 64 hex chars
  const taskIdRegex = /^0x[a-fA-F0-9]{64}$/;
  if (!taskIdRegex.test(trimmed)) {
    return {
      isValid: false,
      error: 'Invalid task ID format',
    };
  }

  return {
    isValid: true,
    sanitizedValue: trimmed.toLowerCase(),
  };
}

// ============================================================================
// TRANSACTION PARAMETER VALIDATION
// ============================================================================

/**
 * Validates transaction parameters before signing
 * 
 * This is a critical security function that ensures:
 * - Recipient address is valid
 * - Transaction value is reasonable
 * - Gas parameters are within safe limits
 * - No malicious data injection
 * 
 * @param params - Transaction parameters to validate
 * @returns Validation result with sanitized parameters
 */
export function validateTransactionParams(
  params: TransactionParams
): SecurityValidationResult {
  const errors: string[] = [];

  // Validate recipient address
  const addressValidation = validateAddress(params.to);
  if (!addressValidation.isValid) {
    errors.push('Invalid recipient address');
  }

  // Validate transaction value if provided
  if (params.value !== undefined) {
    try {
      const value = BigInt(params.value);
      // Check for negative values (should never happen with BigInt, but defensive)
      if (value < 0n) {
        errors.push('Transaction value cannot be negative');
      }
      // Check for unreasonably large values (> 1 million ETH)
      const maxValue = BigInt('1000000000000000000000000'); // 1M ETH in wei
      if (value > maxValue) {
        errors.push('Transaction value exceeds safety limit');
      }
    } catch (error) {
      errors.push('Invalid transaction value format');
    }
  }

  // Validate gas limit if provided
  if (params.gasLimit !== undefined) {
    try {
      const gasLimit = BigInt(params.gasLimit);
      if (gasLimit < 21000n) {
        errors.push('Gas limit too low (minimum 21000)');
      }
      // Maximum gas limit for safety (30M gas)
      if (gasLimit > 30000000n) {
        errors.push('Gas limit exceeds safety limit');
      }
    } catch (error) {
      errors.push('Invalid gas limit format');
    }
  }

  // Validate data field if provided
  if (params.data !== undefined && params.data !== '0x') {
    if (typeof params.data !== 'string' || !params.data.startsWith('0x')) {
      errors.push('Invalid transaction data format');
    }
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      error: errors.join('; '),
    };
  }

  return {
    isValid: true,
    sanitizedValue: {
      ...params,
      to: addressValidation.sanitizedValue,
    },
  };
}

// ============================================================================
// ERROR MESSAGE SANITIZATION
// ============================================================================

/**
 * Sanitizes error messages to prevent sensitive data exposure
 * 
 * Security Considerations:
 * - Removes private keys, mnemonics, and secrets
 * - Removes full file paths
 * - Removes internal stack traces
 * - Removes API keys and tokens
 * - Provides user-friendly error messages
 * 
 * @param error - Error object or message to sanitize
 * @returns Sanitized error message safe for display
 */
export function sanitizeErrorMessage(error: any): string {
  // Handle null/undefined
  if (!error) {
    return 'An unknown error occurred';
  }

  // Extract error message
  let message: string;
  if (typeof error === 'string') {
    message = error;
  } else if (error.message) {
    message = error.message;
  } else if (error.reason) {
    message = error.reason;
  } else {
    message = String(error);
  }

  // Remove private keys (0x followed by 64 hex chars)
  message = message.replace(/0x[a-fA-F0-9]{64}/g, '[REDACTED_KEY]');

  // Remove potential mnemonics (12+ words)
  const wordPattern = /\b([a-z]+\s+){11,}[a-z]+\b/gi;
  message = message.replace(wordPattern, '[REDACTED_MNEMONIC]');

  // Remove file paths
  message = message.replace(/[A-Za-z]:\\[\w\\\-. ]+/g, '[PATH]');
  message = message.replace(/\/[\w\/\-. ]+/g, '[PATH]');

  // Remove API keys and tokens
  message = message.replace(/api[_-]?\s*key[:\s=]+[\w-]+/gi, 'api_key=[REDACTED]');
  message = message.replace(/token[:\s=]+[\w-]+/gi, 'token=[REDACTED]');
  message = message.replace(/bearer\s+[\w-]+/gi, 'bearer [REDACTED]');

  // Remove email addresses
  message = message.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]');

  // Truncate very long messages
  if (message.length > 500) {
    message = message.substring(0, 500) + '...';
  }

  return message;
}

/**
 * Sanitizes error for logging purposes
 * 
 * Similar to sanitizeErrorMessage but preserves more detail for debugging
 * while still removing critical secrets.
 * 
 * @param error - Error to sanitize
 * @returns Sanitized error object safe for logging
 */
export function sanitizeErrorForLogging(error: any): any {
  if (!error) {
    return { message: 'Unknown error' };
  }

  const sanitized: any = {
    message: sanitizeErrorMessage(error),
  };

  // Include error name if available
  if (error.name) {
    sanitized.name = error.name;
  }

  // Include error code if available
  if (error.code) {
    sanitized.code = error.code;
  }

  // Include sanitized stack trace (first 5 lines only)
  if (error.stack) {
    const stackLines = error.stack.split('\n').slice(0, 5);
    sanitized.stack = stackLines
      .map((line: string) => line.replace(/[A-Za-z]:\\[\w\\\-. ]+/g, '[PATH]'))
      .join('\n');
  }

  return sanitized;
}

// ============================================================================
// STRATEGY CONFIGURATION VALIDATION
// ============================================================================

/**
 * Validates strategy configuration parameters
 * 
 * Ensures all user-provided configuration values are within safe ranges
 * before execution.
 * 
 * @param config - Strategy configuration to validate
 * @returns Validation result with detailed errors
 */
export function validateStrategyConfig(config: any): SecurityValidationResult {
  const errors: string[] = [];

  // Validate execution mode
  if (!config.executionMode) {
    errors.push('Execution mode is required');
  } else if (config.executionMode !== 'instant' && config.executionMode !== 'optimized') {
    errors.push('Invalid execution mode');
  }

  // Validate slippage tolerance
  const slippageValidation = validateNumericInput(
    config.slippageTolerance,
    0,
    100,
    'Slippage tolerance'
  );
  if (!slippageValidation.isValid) {
    errors.push(slippageValidation.error!);
  }

  // Validate spread percentage for optimized mode
  if (config.executionMode === 'optimized') {
    const spreadValidation = validateNumericInput(
      config.spreadPercentage,
      0,
      100,
      'Spread percentage'
    );
    if (!spreadValidation.isValid) {
      errors.push(spreadValidation.error!);
    }
  }

  // Validate capital allocation if provided
  if (config.capitalAllocation !== undefined && config.capitalAllocation !== '') {
    const capitalValidation = validateNumericInput(
      config.capitalAllocation,
      0,
      Number.MAX_SAFE_INTEGER,
      'Capital allocation'
    );
    if (!capitalValidation.isValid) {
      errors.push(capitalValidation.error!);
    }
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      error: errors.join('; '),
    };
  }

  return {
    isValid: true,
    sanitizedValue: config,
  };
}

// ============================================================================
// RATE LIMITING & ABUSE PREVENTION
// ============================================================================

/**
 * Simple rate limiter for preventing abuse
 * 
 * Tracks operation counts per user/key and enforces limits.
 * Uses in-memory storage (resets on app restart).
 */
class RateLimiter {
  private operations: Map<string, { count: number; resetTime: number }> = new Map();

  /**
   * Check if operation is allowed for the given key
   * 
   * @param key - Unique identifier (e.g., wallet address)
   * @param maxOperations - Maximum operations allowed per window
   * @param windowMs - Time window in milliseconds
   * @returns Whether operation is allowed
   */
  checkLimit(key: string, maxOperations: number, windowMs: number): boolean {
    const now = Date.now();
    const record = this.operations.get(key);

    // No record or window expired - allow and create new record
    if (!record || now > record.resetTime) {
      this.operations.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      return true;
    }

    // Within window - check count
    if (record.count >= maxOperations) {
      return false;
    }

    // Increment count
    record.count++;
    return true;
  }

  /**
   * Reset rate limit for a specific key
   */
  reset(key: string): void {
    this.operations.delete(key);
  }

  /**
   * Clear all rate limit records
   */
  clearAll(): void {
    this.operations.clear();
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Validates that a value is a valid hex string
 * 
 * @param value - Value to validate
 * @param expectedLength - Expected length (including 0x prefix), optional
 * @returns Validation result
 */
export function validateHexString(
  value: string,
  expectedLength?: number
): SecurityValidationResult {
  if (!value || typeof value !== 'string') {
    return {
      isValid: false,
      error: 'Hex string is required',
    };
  }

  if (!value.startsWith('0x')) {
    return {
      isValid: false,
      error: 'Hex string must start with 0x',
    };
  }

  const hexRegex = /^0x[a-fA-F0-9]*$/;
  if (!hexRegex.test(value)) {
    return {
      isValid: false,
      error: 'Invalid hex string format',
    };
  }

  if (expectedLength !== undefined && value.length !== expectedLength) {
    return {
      isValid: false,
      error: `Hex string must be ${expectedLength} characters`,
    };
  }

  return {
    isValid: true,
    sanitizedValue: value.toLowerCase(),
  };
}

/**
 * Validates URL format
 * 
 * @param url - URL to validate
 * @param allowedProtocols - Allowed protocols (default: ['http:', 'https:'])
 * @returns Validation result
 */
export function validateUrl(
  url: string,
  allowedProtocols: string[] = ['http:', 'https:']
): SecurityValidationResult {
  if (!url || typeof url !== 'string') {
    return {
      isValid: false,
      error: 'URL is required',
    };
  }

  try {
    const parsed = new URL(url);
    
    if (!allowedProtocols.includes(parsed.protocol)) {
      return {
        isValid: false,
        error: `Protocol must be one of: ${allowedProtocols.join(', ')}`,
      };
    }

    return {
      isValid: true,
      sanitizedValue: url,
    };
  } catch (error) {
    return {
      isValid: false,
      error: 'Invalid URL format',
    };
  }
}
