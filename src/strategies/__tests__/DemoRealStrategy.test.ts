/**
 * Tests for DemoRealStrategy
 */

import { describe, it, expect } from 'vitest';
import { DemoRealStrategy } from '../DemoRealStrategy';
import { OperationType } from '../../types/strategy';

describe('DemoRealStrategy', () => {
  describe('Constructor', () => {
    it('should create a demo strategy with correct properties', () => {
      const strategy = new DemoRealStrategy(false);

      expect(strategy.id).toBe('demo-real-strategy-001');
      expect(strategy.name).toContain('Demo');
      expect(strategy.description).toContain('REAL EXECUTION');
      expect(strategy.risk).toBe('low');
      expect(strategy.price).toBe('0.001'); // Very cheap for testing
      expect(strategy.isOwned).toBe(false);
    });

    it('should set ownership status correctly', () => {
      const ownedStrategy = new DemoRealStrategy(true);
      const unownedStrategy = new DemoRealStrategy(false);

      expect(ownedStrategy.isOwned).toBe(true);
      expect(unownedStrategy.isOwned).toBe(false);
    });
  });

  describe('Operations', () => {
    it('should have correct operation sequence', () => {
      const strategy = new DemoRealStrategy();
      const operations = strategy.getOperations();

      expect(operations).toHaveLength(3);
      expect(operations[0].type).toBe(OperationType.CHECK_FUNDING_RATE);
      expect(operations[1].type).toBe(OperationType.OPEN_SHORT);
      expect(operations[2].type).toBe(OperationType.SPOT_BUY);
    });

    it('should use Avantis for funding rate check', () => {
      const strategy = new DemoRealStrategy();
      const operations = strategy.getOperations();
      const checkOp = operations[0];

      expect(checkOp.params.exchange).toBe('avantis');
      expect(checkOp.params.ticker).toBe('BTC/USDC');
      expect(checkOp.params.minRate).toBe(0.0001); // Very low threshold
    });

    it('should use Avantis for short position', () => {
      const strategy = new DemoRealStrategy();
      const operations = strategy.getOperations();
      const shortOp = operations[1];

      expect(shortOp.params.exchange).toBe('avantis');
      expect(shortOp.params.ticker).toBe('BTC/USDC');
      expect(shortOp.params.size).toBe(50); // 50% of capital
      expect(shortOp.params.leverage).toBe(1); // No leverage for safety
    });

    it('should use 1inch for spot buy', () => {
      const strategy = new DemoRealStrategy();
      const operations = strategy.getOperations();
      const spotOp = operations[2];

      expect(spotOp.params.exchange).toBe('1inch-fusion');
      expect(spotOp.params.ticker).toBe('BTC/USDC');
      expect(spotOp.params.amount).toBe(50); // 50% of capital
    });
  });

  describe('Serialization', () => {
    it('should serialize to valid JSON', () => {
      const strategy = new DemoRealStrategy();
      const serialized = strategy.serialize();

      expect(() => JSON.parse(serialized)).not.toThrow();
    });

    it('should include demo flag in serialization', () => {
      const strategy = new DemoRealStrategy();
      const serialized = strategy.serialize();
      const parsed = JSON.parse(serialized);

      expect(parsed.isDemo).toBe(true);
    });

    it('should include all operations in serialization', () => {
      const strategy = new DemoRealStrategy();
      const serialized = strategy.serialize();
      const parsed = JSON.parse(serialized);

      expect(parsed.operations).toHaveLength(3);
      expect(parsed.operations[0].type).toBe(OperationType.CHECK_FUNDING_RATE);
      expect(parsed.operations[1].type).toBe(OperationType.OPEN_SHORT);
      expect(parsed.operations[2].type).toBe(OperationType.SPOT_BUY);
    });

    it('should include strategy metadata', () => {
      const strategy = new DemoRealStrategy();
      const serialized = strategy.serialize();
      const parsed = JSON.parse(serialized);

      expect(parsed.strategyId).toBe('demo-real-strategy-001');
      expect(parsed.strategyName).toContain('Demo');
      expect(parsed.version).toBe('1.0.0');
    });
  });

  describe('Validation', () => {
    it('should accept valid configuration', () => {
      const strategy = new DemoRealStrategy();
      const config = {
        executionMode: 'instant' as const,
        slippageTolerance: 1.0,
        capitalAllocation: '1'
      };

      const result = strategy.validate(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject capital below minimum', () => {
      const strategy = new DemoRealStrategy();
      const config = {
        executionMode: 'instant' as const,
        slippageTolerance: 1.0,
        capitalAllocation: '0.5' // Too low
      };

      const result = strategy.validate(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Demo strategy requires minimum $1 USDC');
    });

    it('should reject capital above maximum', () => {
      const strategy = new DemoRealStrategy();
      const config = {
        executionMode: 'instant' as const,
        slippageTolerance: 1.0,
        capitalAllocation: '15' // Too high
      };

      const result = strategy.validate(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Demo strategy limited to maximum $10 USDC for safety');
    });

    it('should reject slippage outside range', () => {
      const strategy = new DemoRealStrategy();
      const config1 = {
        executionMode: 'instant' as const,
        slippageTolerance: 0.1, // Too low
        capitalAllocation: '20'
      };
      const config2 = {
        executionMode: 'instant' as const,
        slippageTolerance: 10, // Too high
        capitalAllocation: '20'
      };

      const result1 = strategy.validate(config1);
      const result2 = strategy.validate(config2);

      expect(result1.isValid).toBe(false);
      expect(result1.errors).toContain('Slippage tolerance must be between 0.5% and 5% for demo');
      expect(result2.isValid).toBe(false);
      expect(result2.errors).toContain('Slippage tolerance must be between 0.5% and 5% for demo');
    });

    it('should reject non-instant execution mode', () => {
      const strategy = new DemoRealStrategy();
      const config = {
        executionMode: 'optimized' as const,
        slippageTolerance: 1.0,
        capitalAllocation: '20',
        spreadPercentage: 0.5
      };

      const result = strategy.validate(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Demo strategy only supports instant execution mode');
    });

    it('should reject invalid capital format', () => {
      const strategy = new DemoRealStrategy();
      const config = {
        executionMode: 'instant' as const,
        slippageTolerance: 1.0,
        capitalAllocation: 'invalid'
      };

      const result = strategy.validate(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Capital allocation must be a valid number');
    });

    it('should accept configuration without capital allocation', () => {
      const strategy = new DemoRealStrategy();
      const config = {
        executionMode: 'instant' as const,
        slippageTolerance: 1.0
      };

      const result = strategy.validate(config);

      expect(result.isValid).toBe(true);
    });
  });

  describe('Risk and APR', () => {
    it('should have low risk rating', () => {
      const strategy = new DemoRealStrategy();

      expect(strategy.risk).toBe('low');
    });

    it('should have reasonable APR range for demo', () => {
      const strategy = new DemoRealStrategy();

      expect(strategy.apr.min).toBe(5);
      expect(strategy.apr.max).toBe(15);
      expect(strategy.apr.min).toBeLessThan(strategy.apr.max);
    });
  });
});
