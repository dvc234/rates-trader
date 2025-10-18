/**
 * Unit tests for security utilities
 * 
 * Tests input validation, error sanitization, and transaction parameter validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateAddress,
  validateNumericInput,
  validateStrategyId,
  validateTaskId,
  validateTransactionParams,
  sanitizeErrorMessage,
  sanitizeErrorForLogging,
  validateStrategyConfig,
  validateHexString,
  validateUrl,
  rateLimiter,
} from '../security';

describe('Security Utilities', () => {
  describe('validateAddress', () => {
    it('should validate correct Ethereum address', () => {
      const result = validateAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('0x742d35cc6634c0532925a3b844bc9e7595f0beb0');
    });

    it('should reject invalid address format', () => {
      const result = validateAddress('invalid');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid address format');
    });

    it('should reject address without 0x prefix', () => {
      const result = validateAddress('742d35Cc6634C0532925a3b844Bc9e7595f0bEb');
      expect(result.isValid).toBe(false);
    });

    it('should reject empty address', () => {
      const result = validateAddress('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('required');
    });
  });

  describe('validateNumericInput', () => {
    it('should validate number within range', () => {
      const result = validateNumericInput(50, 0, 100, 'Test field');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe(50);
    });

    it('should reject number below minimum', () => {
      const result = validateNumericInput(-5, 0, 100, 'Test field');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('between 0 and 100');
    });

    it('should reject number above maximum', () => {
      const result = validateNumericInput(150, 0, 100, 'Test field');
      expect(result.isValid).toBe(false);
    });

    it('should reject NaN', () => {
      const result = validateNumericInput('invalid', 0, 100, 'Test field');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('valid number');
    });

    it('should reject empty value', () => {
      const result = validateNumericInput('', 0, 100, 'Test field');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('required');
    });
  });

  describe('validateStrategyId', () => {
    it('should validate Ethereum address as strategy ID', () => {
      const result = validateStrategyId('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0');
      expect(result.isValid).toBe(true);
    });

    it('should validate UUID as strategy ID', () => {
      const result = validateStrategyId('550e8400-e29b-41d4-a716-446655440000');
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid format', () => {
      const result = validateStrategyId('invalid-id');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid strategy ID format');
    });
  });

  describe('validateTaskId', () => {
    it('should validate correct task ID format', () => {
      const taskId = '0x' + 'a'.repeat(64);
      const result = validateTaskId(taskId);
      expect(result.isValid).toBe(true);
    });

    it('should reject short task ID', () => {
      const result = validateTaskId('0x123');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid task ID format');
    });

    it('should reject task ID without 0x', () => {
      const taskId = 'a'.repeat(64);
      const result = validateTaskId(taskId);
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateTransactionParams', () => {
    it('should validate correct transaction parameters', () => {
      const params = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
        value: '1000000000000000000', // 1 ETH
        gasLimit: '21000',
      };
      const result = validateTransactionParams(params);
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid recipient address', () => {
      const params = {
        to: 'invalid',
        value: '1000000000000000000',
      };
      const result = validateTransactionParams(params);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid recipient address');
    });

    it('should reject gas limit below minimum', () => {
      const params = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
        gasLimit: '20000', // Below 21000 minimum
      };
      const result = validateTransactionParams(params);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Gas limit too low');
    });

    it('should reject excessive gas limit', () => {
      const params = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
        gasLimit: '40000000', // Above 30M limit
      };
      const result = validateTransactionParams(params);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('exceeds safety limit');
    });

    it('should reject excessive transaction value', () => {
      const params = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
        value: '2000000000000000000000000', // > 1M ETH
      };
      const result = validateTransactionParams(params);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('exceeds safety limit');
    });
  });

  describe('sanitizeErrorMessage', () => {
    it('should remove private keys from error messages', () => {
      const error = 'Error: Private key 0x' + 'a'.repeat(64) + ' is invalid';
      const sanitized = sanitizeErrorMessage(error);
      expect(sanitized).not.toContain('a'.repeat(64));
      expect(sanitized).toContain('[REDACTED_KEY]');
    });

    it('should remove file paths', () => {
      const error = 'Error in C:\\Users\\test\\file.ts';
      const sanitized = sanitizeErrorMessage(error);
      expect(sanitized).toContain('[PATH]');
      expect(sanitized).not.toContain('Users');
    });

    it('should remove API keys', () => {
      const error = 'API key: abc123xyz';
      const sanitized = sanitizeErrorMessage(error);
      expect(sanitized).toContain('[REDACTED]');
      expect(sanitized).not.toContain('abc123xyz');
    });

    it('should remove email addresses', () => {
      const error = 'User test@example.com not found';
      const sanitized = sanitizeErrorMessage(error);
      expect(sanitized).toContain('[EMAIL]');
      expect(sanitized).not.toContain('test@example.com');
    });

    it('should truncate very long messages', () => {
      const error = 'Error: ' + 'x'.repeat(600);
      const sanitized = sanitizeErrorMessage(error);
      expect(sanitized.length).toBeLessThan(510);
      expect(sanitized).toContain('...');
    });

    it('should handle null/undefined errors', () => {
      expect(sanitizeErrorMessage(null)).toBe('An unknown error occurred');
      expect(sanitizeErrorMessage(undefined)).toBe('An unknown error occurred');
    });
  });

  describe('sanitizeErrorForLogging', () => {
    it('should preserve error name and code', () => {
      const error = new Error('Test error');
      error.name = 'ValidationError';
      (error as any).code = 'ERR_VALIDATION';
      
      const sanitized = sanitizeErrorForLogging(error);
      expect(sanitized.name).toBe('ValidationError');
      expect(sanitized.code).toBe('ERR_VALIDATION');
    });

    it('should include sanitized stack trace', () => {
      const error = new Error('Test error');
      const sanitized = sanitizeErrorForLogging(error);
      expect(sanitized.stack).toBeDefined();
    });
  });

  describe('validateStrategyConfig', () => {
    it('should validate correct instant execution config', () => {
      const config = {
        executionMode: 'instant',
        slippageTolerance: 1.0,
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(true);
    });

    it('should validate correct optimized execution config', () => {
      const config = {
        executionMode: 'optimized',
        slippageTolerance: 1.0,
        spreadPercentage: 0.5,
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(true);
    });

    it('should reject missing execution mode', () => {
      const config = {
        slippageTolerance: 1.0,
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Execution mode is required');
    });

    it('should reject invalid execution mode', () => {
      const config = {
        executionMode: 'invalid',
        slippageTolerance: 1.0,
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid execution mode');
    });

    it('should reject missing spread percentage for optimized mode', () => {
      const config = {
        executionMode: 'optimized',
        slippageTolerance: 1.0,
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Spread percentage');
    });

    it('should reject invalid slippage tolerance', () => {
      const config = {
        executionMode: 'instant',
        slippageTolerance: 150, // Above 100
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateHexString', () => {
    it('should validate correct hex string', () => {
      const result = validateHexString('0xabcdef123456');
      expect(result.isValid).toBe(true);
    });

    it('should validate hex string with expected length', () => {
      const result = validateHexString('0xabcd', 6);
      expect(result.isValid).toBe(true);
    });

    it('should reject hex string without 0x prefix', () => {
      const result = validateHexString('abcdef');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must start with 0x');
    });

    it('should reject invalid hex characters', () => {
      const result = validateHexString('0xghij');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid hex string format');
    });

    it('should reject wrong length', () => {
      const result = validateHexString('0xabcd', 10);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must be 10 characters');
    });
  });

  describe('validateUrl', () => {
    it('should validate correct HTTPS URL', () => {
      const result = validateUrl('https://example.com');
      expect(result.isValid).toBe(true);
    });

    it('should validate correct HTTP URL', () => {
      const result = validateUrl('http://example.com');
      expect(result.isValid).toBe(true);
    });

    it('should reject non-HTTP protocols', () => {
      const result = validateUrl('ftp://example.com');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Protocol must be');
    });

    it('should reject invalid URL format', () => {
      const result = validateUrl('not-a-url');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });

    it('should allow custom protocols', () => {
      const result = validateUrl('ipfs://example', ['ipfs:']);
      expect(result.isValid).toBe(true);
    });
  });

  describe('rateLimiter', () => {
    beforeEach(() => {
      rateLimiter.clearAll();
    });

    it('should allow operations within limit', () => {
      const key = 'test-user';
      expect(rateLimiter.checkLimit(key, 3, 1000)).toBe(true);
      expect(rateLimiter.checkLimit(key, 3, 1000)).toBe(true);
      expect(rateLimiter.checkLimit(key, 3, 1000)).toBe(true);
    });

    it('should block operations exceeding limit', () => {
      const key = 'test-user';
      rateLimiter.checkLimit(key, 2, 1000);
      rateLimiter.checkLimit(key, 2, 1000);
      expect(rateLimiter.checkLimit(key, 2, 1000)).toBe(false);
    });

    it('should reset after time window', async () => {
      const key = 'test-user';
      rateLimiter.checkLimit(key, 1, 100); // 100ms window
      expect(rateLimiter.checkLimit(key, 1, 100)).toBe(false);
      
      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(rateLimiter.checkLimit(key, 1, 100)).toBe(true);
    });

    it('should track different keys separately', () => {
      expect(rateLimiter.checkLimit('user1', 1, 1000)).toBe(true);
      expect(rateLimiter.checkLimit('user2', 1, 1000)).toBe(true);
      expect(rateLimiter.checkLimit('user1', 1, 1000)).toBe(false);
      expect(rateLimiter.checkLimit('user2', 1, 1000)).toBe(false);
    });

    it('should reset specific key', () => {
      const key = 'test-user';
      rateLimiter.checkLimit(key, 1, 1000);
      expect(rateLimiter.checkLimit(key, 1, 1000)).toBe(false);
      
      rateLimiter.reset(key);
      expect(rateLimiter.checkLimit(key, 1, 1000)).toBe(true);
    });
  });
});
