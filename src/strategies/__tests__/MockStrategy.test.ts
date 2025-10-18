/**
 * Unit tests for MockStrategy
 * Tests serialization, deserialization, and validation logic
 */

import { describe, it, expect } from 'vitest';
import { MockStrategy } from '../MockStrategy';
import { OperationType } from '../../types/strategy';

describe('MockStrategy', () => {
  describe('Constructor', () => {
    it('should create a MockStrategy with default ownership false', () => {
      const strategy = new MockStrategy();
      
      expect(strategy.id).toBe('mock-strategy-001');
      expect(strategy.name).toBe('Mock Test Strategy');
      expect(strategy.risk).toBe('low');
      expect(strategy.apr.min).toBe(0);
      expect(strategy.apr.max).toBe(0);
      expect(strategy.price).toBe('1');
      expect(strategy.isOwned).toBe(false);
    });

    it('should create a MockStrategy with ownership true', () => {
      const strategy = new MockStrategy(true);
      
      expect(strategy.isOwned).toBe(true);
    });

    it('should have a valid description', () => {
      const strategy = new MockStrategy();
      
      expect(strategy.description).toBeTruthy();
      expect(strategy.description.length).toBeGreaterThan(0);
    });
  });

  describe('Serialization', () => {
    it('should serialize strategy operations to JSON string', () => {
      const strategy = new MockStrategy();
      const serialized = strategy.serialize();
      
      expect(typeof serialized).toBe('string');
      expect(() => JSON.parse(serialized)).not.toThrow();
    });

    it('should include strategy metadata in serialization', () => {
      const strategy = new MockStrategy();
      const serialized = strategy.serialize();
      const parsed = JSON.parse(serialized);
      
      expect(parsed.strategyId).toBe('mock-strategy-001');
      expect(parsed.strategyName).toBe('Mock Test Strategy');
      expect(parsed.version).toBe('1.0.0');
    });

    it('should include all operations in serialization', () => {
      const strategy = new MockStrategy();
      const serialized = strategy.serialize();
      const parsed = JSON.parse(serialized);
      
      expect(parsed.operations).toBeDefined();
      expect(Array.isArray(parsed.operations)).toBe(true);
      expect(parsed.operations.length).toBe(3);
    });

    it('should serialize operations with correct structure', () => {
      const strategy = new MockStrategy();
      const serialized = strategy.serialize();
      const parsed = JSON.parse(serialized);
      
      parsed.operations.forEach((op: any) => {
        expect(op).toHaveProperty('type');
        expect(op).toHaveProperty('order');
        expect(op).toHaveProperty('params');
      });
    });

    it('should serialize operations with correct types', () => {
      const strategy = new MockStrategy();
      const serialized = strategy.serialize();
      const parsed = JSON.parse(serialized);
      
      parsed.operations.forEach((op: any) => {
        expect(op.type).toBe(OperationType.MOCK_OPERATION);
      });
    });

    it('should serialize operations in correct order', () => {
      const strategy = new MockStrategy();
      const serialized = strategy.serialize();
      const parsed = JSON.parse(serialized);
      
      expect(parsed.operations[0].order).toBe(1);
      expect(parsed.operations[1].order).toBe(2);
      expect(parsed.operations[2].order).toBe(3);
    });

    it('should serialize operation parameters correctly', () => {
      const strategy = new MockStrategy();
      const serialized = strategy.serialize();
      const parsed = JSON.parse(serialized);
      
      expect(parsed.operations[0].params.message).toBe('Mock operation 1: Initializing strategy');
      expect(parsed.operations[0].params.delay).toBe(1000);
      expect(parsed.operations[1].params.delay).toBe(500);
      expect(parsed.operations[2].params.delay).toBe(1000);
    });
  });

  describe('Deserialization', () => {
    it('should be deserializable back to operations', () => {
      const strategy = new MockStrategy();
      const serialized = strategy.serialize();
      const parsed = JSON.parse(serialized);
      
      // Verify the parsed structure can be used to reconstruct operations
      expect(parsed.operations).toBeDefined();
      expect(parsed.operations.length).toBeGreaterThan(0);
      
      // Verify each operation has the required fields for deserialization
      parsed.operations.forEach((op: any) => {
        expect(op.type).toBeDefined();
        expect(op.order).toBeDefined();
        expect(op.params).toBeDefined();
      });
    });

    it('should maintain operation order after serialization', () => {
      const strategy = new MockStrategy();
      const operations = strategy.getOperations();
      const serialized = strategy.serialize();
      const parsed = JSON.parse(serialized);
      
      operations.forEach((op, index) => {
        expect(parsed.operations[index].order).toBe(op.order);
      });
    });
  });

  describe('Validation', () => {
    it('should validate valid instant execution config', () => {
      const strategy = new MockStrategy();
      const config = {
        slippageTolerance: 1,
        executionMode: 'instant' as const
      };
      
      const result = strategy.validate(config);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate valid optimized execution config', () => {
      const strategy = new MockStrategy();
      const config = {
        slippageTolerance: 1,
        executionMode: 'optimized' as const,
        spreadPercentage: 0.5
      };
      
      const result = strategy.validate(config);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject negative slippage tolerance', () => {
      const strategy = new MockStrategy();
      const config = {
        slippageTolerance: -1,
        executionMode: 'instant' as const
      };
      
      const result = strategy.validate(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Slippage tolerance must be between 0 and 100');
    });

    it('should reject slippage tolerance over 100', () => {
      const strategy = new MockStrategy();
      const config = {
        slippageTolerance: 101,
        executionMode: 'instant' as const
      };
      
      const result = strategy.validate(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Slippage tolerance must be between 0 and 100');
    });

    it('should require spread percentage for optimized mode', () => {
      const strategy = new MockStrategy();
      const config = {
        slippageTolerance: 1,
        executionMode: 'optimized' as const
      };
      
      const result = strategy.validate(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Spread percentage is required for optimized execution mode');
    });

    it('should reject negative spread percentage', () => {
      const strategy = new MockStrategy();
      const config = {
        slippageTolerance: 1,
        executionMode: 'optimized' as const,
        spreadPercentage: -1
      };
      
      const result = strategy.validate(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Spread percentage must be between 0 and 100');
    });

    it('should reject spread percentage over 100', () => {
      const strategy = new MockStrategy();
      const config = {
        slippageTolerance: 1,
        executionMode: 'optimized' as const,
        spreadPercentage: 101
      };
      
      const result = strategy.validate(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Spread percentage must be between 0 and 100');
    });

    it('should validate valid capital allocation', () => {
      const strategy = new MockStrategy();
      const config = {
        slippageTolerance: 1,
        executionMode: 'instant' as const,
        capitalAllocation: '1000'
      };
      
      const result = strategy.validate(config);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject negative capital allocation', () => {
      const strategy = new MockStrategy();
      const config = {
        slippageTolerance: 1,
        executionMode: 'instant' as const,
        capitalAllocation: '-100'
      };
      
      const result = strategy.validate(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Capital allocation must be a positive number');
    });

    it('should reject zero capital allocation', () => {
      const strategy = new MockStrategy();
      const config = {
        slippageTolerance: 1,
        executionMode: 'instant' as const,
        capitalAllocation: '0'
      };
      
      const result = strategy.validate(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Capital allocation must be a positive number');
    });

    it('should reject invalid capital allocation string', () => {
      const strategy = new MockStrategy();
      const config = {
        slippageTolerance: 1,
        executionMode: 'instant' as const,
        capitalAllocation: 'invalid'
      };
      
      const result = strategy.validate(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Capital allocation must be a positive number');
    });

    it('should accumulate multiple validation errors', () => {
      const strategy = new MockStrategy();
      const config = {
        slippageTolerance: -1,
        executionMode: 'optimized' as const,
        spreadPercentage: 101,
        capitalAllocation: '-100'
      };
      
      const result = strategy.validate(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it('should accept boundary values for slippage', () => {
      const strategy = new MockStrategy();
      
      const config1 = {
        slippageTolerance: 0,
        executionMode: 'instant' as const
      };
      expect(strategy.validate(config1).isValid).toBe(true);
      
      const config2 = {
        slippageTolerance: 100,
        executionMode: 'instant' as const
      };
      expect(strategy.validate(config2).isValid).toBe(true);
    });

    it('should accept boundary values for spread percentage', () => {
      const strategy = new MockStrategy();
      
      const config1 = {
        slippageTolerance: 1,
        executionMode: 'optimized' as const,
        spreadPercentage: 0
      };
      expect(strategy.validate(config1).isValid).toBe(true);
      
      const config2 = {
        slippageTolerance: 1,
        executionMode: 'optimized' as const,
        spreadPercentage: 100
      };
      expect(strategy.validate(config2).isValid).toBe(true);
    });
  });

  describe('getOperations', () => {
    it('should return array of operations', () => {
      const strategy = new MockStrategy();
      const operations = strategy.getOperations();
      
      expect(Array.isArray(operations)).toBe(true);
      expect(operations.length).toBe(3);
    });

    it('should return operations with correct types', () => {
      const strategy = new MockStrategy();
      const operations = strategy.getOperations();
      
      operations.forEach(op => {
        expect(op.type).toBe(OperationType.MOCK_OPERATION);
      });
    });

    it('should return a copy of operations array', () => {
      const strategy = new MockStrategy();
      const operations1 = strategy.getOperations();
      const operations2 = strategy.getOperations();
      
      // Should be equal in content but not the same reference
      expect(operations1).toEqual(operations2);
      expect(operations1).not.toBe(operations2);
    });

    it('should not allow mutation of internal operations', () => {
      const strategy = new MockStrategy();
      const operations = strategy.getOperations();
      
      // Mutate the returned array
      operations.push({
        type: OperationType.MOCK_OPERATION,
        order: 999,
        params: { message: 'hacked', delay: 0 }
      });
      
      // Original should be unchanged
      const freshOperations = strategy.getOperations();
      expect(freshOperations.length).toBe(3);
    });
  });
});
