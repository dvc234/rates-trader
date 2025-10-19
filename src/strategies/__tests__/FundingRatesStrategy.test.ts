/**
 * Tests for FundingRatesStrategy
 * Validates strategy configuration, serialization, and validation logic
 */

import { describe, it, expect } from 'vitest';
import { FundingRatesStrategy } from '../FundingRatesStrategy';
import { OperationType, StrategyConfig } from '../../types/strategy';

describe('FundingRatesStrategy', () => {
  describe('constructor', () => {
    it('should create strategy with correct metadata', () => {
      const strategy = new FundingRatesStrategy(false);
      
      expect(strategy.id).toBe('funding-rates-strategy-001');
      expect(strategy.name).toBe('BTC Funding Rate Arbitrage');
      expect(strategy.risk).toBe('medium');
      expect(strategy.apr).toEqual({ min: 15, max: 45 });
      expect(strategy.price).toBe('0.05');
      expect(strategy.isOwned).toBe(false);
    });
    
    it('should create strategy with isOwned true', () => {
      const strategy = new FundingRatesStrategy(true);
      
      expect(strategy.isOwned).toBe(true);
    });
    
    it('should define three operations in correct order', () => {
      const strategy = new FundingRatesStrategy();
      const operations = strategy.getOperations();
      
      expect(operations).toHaveLength(3);
      expect(operations[0].order).toBe(1);
      expect(operations[1].order).toBe(2);
      expect(operations[2].order).toBe(3);
    });
    
    it('should define CheckFundingRateOperation as first operation', () => {
      const strategy = new FundingRatesStrategy();
      const operations = strategy.getOperations();
      
      const checkOp = operations[0];
      expect(checkOp.type).toBe(OperationType.CHECK_FUNDING_RATE);
      expect(checkOp.order).toBe(1);
      expect(checkOp.params).toMatchObject({
        ticker: 'BTC/USDC',
        minRate: 0.01,
        exchange: 'avantis'
      });
    });
    
    it('should define OpenPerpetualShortOperation as second operation', () => {
      const strategy = new FundingRatesStrategy();
      const operations = strategy.getOperations();
      
      const shortOp = operations[1];
      expect(shortOp.type).toBe(OperationType.OPEN_SHORT);
      expect(shortOp.order).toBe(2);
      expect(shortOp.params).toMatchObject({
        ticker: 'BTC/USDC',
        size: '50',
        isPercentage: true,
        leverage: 1,
        exchange: 'avantis'
      });
    });
    
    it('should define SpotBuyOperation as third operation', () => {
      const strategy = new FundingRatesStrategy();
      const operations = strategy.getOperations();
      
      const spotOp = operations[2];
      expect(spotOp.type).toBe(OperationType.SPOT_BUY);
      expect(spotOp.order).toBe(3);
      expect(spotOp.params).toMatchObject({
        ticker: 'BTC/USDC',
        amount: '50',
        isPercentage: true,
        exchange: '1inch-fusion'
      });
    });
  });
  
  describe('serialize', () => {
    it('should serialize strategy to JSON string', () => {
      const strategy = new FundingRatesStrategy();
      const serialized = strategy.serialize();
      
      expect(typeof serialized).toBe('string');
      expect(() => JSON.parse(serialized)).not.toThrow();
    });
    
    it('should include strategy metadata in serialization', () => {
      const strategy = new FundingRatesStrategy();
      const serialized = strategy.serialize();
      const parsed = JSON.parse(serialized);
      
      expect(parsed.strategyId).toBe('funding-rates-strategy-001');
      expect(parsed.strategyName).toBe('BTC Funding Rate Arbitrage');
      expect(parsed.version).toBe('1.0.0');
    });
    
    it('should include all operations in serialization', () => {
      const strategy = new FundingRatesStrategy();
      const serialized = strategy.serialize();
      const parsed = JSON.parse(serialized);
      
      expect(parsed.operations).toHaveLength(3);
      expect(parsed.operations[0].type).toBe(OperationType.CHECK_FUNDING_RATE);
      expect(parsed.operations[1].type).toBe(OperationType.OPEN_SHORT);
      expect(parsed.operations[2].type).toBe(OperationType.SPOT_BUY);
    });
    
    it('should include operation parameters in serialization', () => {
      const strategy = new FundingRatesStrategy();
      const serialized = strategy.serialize();
      const parsed = JSON.parse(serialized);
      
      // Check funding rate operation params
      expect(parsed.operations[0].params.ticker).toBe('BTC/USDC');
      expect(parsed.operations[0].params.minRate).toBe(0.01);
      expect(parsed.operations[0].params.exchange).toBe('avantis');
      
      // Check short operation params
      expect(parsed.operations[1].params.ticker).toBe('BTC/USDC');
      expect(parsed.operations[1].params.size).toBe('50');
      expect(parsed.operations[1].params.isPercentage).toBe(true);
      expect(parsed.operations[1].params.leverage).toBe(1);
      
      // Check spot buy operation params
      expect(parsed.operations[2].params.ticker).toBe('BTC/USDC');
      expect(parsed.operations[2].params.amount).toBe('50');
      expect(parsed.operations[2].params.isPercentage).toBe(true);
      expect(parsed.operations[2].params.exchange).toBe('1inch-fusion');
    });
    
    it('should maintain operation order in serialization', () => {
      const strategy = new FundingRatesStrategy();
      const serialized = strategy.serialize();
      const parsed = JSON.parse(serialized);
      
      expect(parsed.operations[0].order).toBe(1);
      expect(parsed.operations[1].order).toBe(2);
      expect(parsed.operations[2].order).toBe(3);
    });
  });
  
  describe('validate', () => {
    it('should validate correct configuration', () => {
      const strategy = new FundingRatesStrategy();
      const config: StrategyConfig = {
        slippageTolerance: 1,
        executionMode: 'instant',
        capitalAllocation: '1000'
      };
      
      const result = strategy.validate(config);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should validate optimized mode with spread percentage', () => {
      const strategy = new FundingRatesStrategy();
      const config: StrategyConfig = {
        slippageTolerance: 1,
        executionMode: 'optimized',
        spreadPercentage: 0.5,
        capitalAllocation: '1000'
      };
      
      const result = strategy.validate(config);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject negative slippage tolerance', () => {
      const strategy = new FundingRatesStrategy();
      const config: StrategyConfig = {
        slippageTolerance: -1,
        executionMode: 'instant',
        capitalAllocation: '1000'
      };
      
      const result = strategy.validate(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Slippage tolerance must be between 0 and 100');
    });
    
    it('should reject slippage tolerance over 100', () => {
      const strategy = new FundingRatesStrategy();
      const config: StrategyConfig = {
        slippageTolerance: 101,
        executionMode: 'instant',
        capitalAllocation: '1000'
      };
      
      const result = strategy.validate(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Slippage tolerance must be between 0 and 100');
    });
    
    it('should reject negative spread percentage', () => {
      const strategy = new FundingRatesStrategy();
      const config: StrategyConfig = {
        slippageTolerance: 1,
        executionMode: 'optimized',
        spreadPercentage: -1,
        capitalAllocation: '1000'
      };
      
      const result = strategy.validate(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Spread percentage must be between 0 and 100');
    });
    
    it('should reject spread percentage over 100', () => {
      const strategy = new FundingRatesStrategy();
      const config: StrategyConfig = {
        slippageTolerance: 1,
        executionMode: 'optimized',
        spreadPercentage: 101,
        capitalAllocation: '1000'
      };
      
      const result = strategy.validate(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Spread percentage must be between 0 and 100');
    });
    
    it('should reject negative capital allocation', () => {
      const strategy = new FundingRatesStrategy();
      const config: StrategyConfig = {
        slippageTolerance: 1,
        executionMode: 'instant',
        capitalAllocation: '-100'
      };
      
      const result = strategy.validate(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Capital allocation must be a positive number');
    });
    
    it('should reject zero capital allocation', () => {
      const strategy = new FundingRatesStrategy();
      const config: StrategyConfig = {
        slippageTolerance: 1,
        executionMode: 'instant',
        capitalAllocation: '0'
      };
      
      const result = strategy.validate(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Capital allocation must be a positive number');
    });
    
    it('should reject invalid capital allocation', () => {
      const strategy = new FundingRatesStrategy();
      const config: StrategyConfig = {
        slippageTolerance: 1,
        executionMode: 'instant',
        capitalAllocation: 'invalid'
      };
      
      const result = strategy.validate(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Capital allocation must be a positive number');
    });
    
    it('should warn about low capital allocation', () => {
      const strategy = new FundingRatesStrategy();
      const config: StrategyConfig = {
        slippageTolerance: 1,
        executionMode: 'instant',
        capitalAllocation: '50'
      };
      
      const result = strategy.validate(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Capital allocation should be at least $100 to cover gas costs and fees');
    });
    
    it('should require capital allocation', () => {
      const strategy = new FundingRatesStrategy();
      const config: StrategyConfig = {
        slippageTolerance: 1,
        executionMode: 'instant'
      };
      
      const result = strategy.validate(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Capital allocation is required for funding rate arbitrage strategy');
    });
    
    it('should reject invalid execution mode', () => {
      const strategy = new FundingRatesStrategy();
      const config: StrategyConfig = {
        slippageTolerance: 1,
        executionMode: 'invalid' as any,
        capitalAllocation: '1000'
      };
      
      const result = strategy.validate(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Execution mode must be either "instant" or "optimized"');
    });
    
    it('should accumulate multiple validation errors', () => {
      const strategy = new FundingRatesStrategy();
      const config: StrategyConfig = {
        slippageTolerance: -1,
        executionMode: 'invalid' as any,
        capitalAllocation: '-100'
      };
      
      const result = strategy.validate(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
  
  describe('getOperations', () => {
    it('should return copy of operations array', () => {
      const strategy = new FundingRatesStrategy();
      const operations1 = strategy.getOperations();
      const operations2 = strategy.getOperations();
      
      expect(operations1).not.toBe(operations2);
      expect(operations1).toEqual(operations2);
    });
    
    it('should not allow external modification of operations', () => {
      const strategy = new FundingRatesStrategy();
      const operations = strategy.getOperations();
      
      operations.push({
        type: OperationType.MOCK_OPERATION,
        order: 4,
        params: {}
      });
      
      const freshOperations = strategy.getOperations();
      expect(freshOperations).toHaveLength(3);
    });
  });
});
