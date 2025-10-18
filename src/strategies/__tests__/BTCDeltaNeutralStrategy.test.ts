/**
 * Unit tests for BTCDeltaNeutralStrategy
 * Tests serialization, deserialization, and validation logic
 */

import { describe, it, expect } from 'vitest';
import { BTCDeltaNeutralStrategy } from '../BTCDeltaNeutralStrategy';
import { OperationType } from '../../types/strategy';

describe('BTCDeltaNeutralStrategy', () => {
    describe('Constructor', () => {
        it('should create a BTCDeltaNeutralStrategy with default ownership false', () => {
            const strategy = new BTCDeltaNeutralStrategy();

            expect(strategy.id).toBe('btc-delta-neutral-001');
            expect(strategy.name).toBe('BTC Delta Neutral Funding');
            expect(strategy.risk).toBe('low');
            expect(strategy.apr.min).toBe(15);
            expect(strategy.apr.max).toBe(45);
            expect(strategy.price).toBe('50');
            expect(strategy.isOwned).toBe(false);
        });

        it('should create a BTCDeltaNeutralStrategy with ownership true', () => {
            const strategy = new BTCDeltaNeutralStrategy(true);

            expect(strategy.isOwned).toBe(true);
        });

        it('should have a valid description', () => {
            const strategy = new BTCDeltaNeutralStrategy();

            expect(strategy.description).toBeTruthy();
            expect(strategy.description.length).toBeGreaterThan(0);
            expect(strategy.description).toContain('delta neutral');
        });
    });

    describe('Serialization', () => {
        it('should serialize strategy operations to JSON string', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const serialized = strategy.serialize();

            expect(typeof serialized).toBe('string');
            expect(() => JSON.parse(serialized)).not.toThrow();
        });

        it('should include strategy metadata in serialization', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const serialized = strategy.serialize();
            const parsed = JSON.parse(serialized);

            expect(parsed.strategyId).toBe('btc-delta-neutral-001');
            expect(parsed.strategyName).toBe('BTC Delta Neutral Funding');
            expect(parsed.version).toBe('1.0.0');
        });

        it('should include all operations in serialization', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const serialized = strategy.serialize();
            const parsed = JSON.parse(serialized);

            expect(parsed.operations).toBeDefined();
            expect(Array.isArray(parsed.operations)).toBe(true);
            expect(parsed.operations.length).toBe(3);
        });

        it('should serialize operations with correct structure', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const serialized = strategy.serialize();
            const parsed = JSON.parse(serialized);

            parsed.operations.forEach((op: { type: string; order: number; params: unknown }) => {
                expect(op).toHaveProperty('type');
                expect(op).toHaveProperty('order');
                expect(op).toHaveProperty('params');
            });
        });

        it('should serialize operations with correct types', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const serialized = strategy.serialize();
            const parsed = JSON.parse(serialized);

            expect(parsed.operations[0].type).toBe(OperationType.CHECK_FUNDING_RATE);
            expect(parsed.operations[1].type).toBe(OperationType.OPEN_SHORT);
            expect(parsed.operations[2].type).toBe(OperationType.SPOT_BUY);
        });

        it('should serialize operations in correct order', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const serialized = strategy.serialize();
            const parsed = JSON.parse(serialized);

            expect(parsed.operations[0].order).toBe(1);
            expect(parsed.operations[1].order).toBe(2);
            expect(parsed.operations[2].order).toBe(3);
        });

        it('should serialize CHECK_FUNDING_RATE operation with correct params', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const serialized = strategy.serialize();
            const parsed = JSON.parse(serialized);

            const fundingOp = parsed.operations[0];
            expect(fundingOp.type).toBe(OperationType.CHECK_FUNDING_RATE);
            expect(fundingOp.params.ticker).toBe('BTC/USDC');
            expect(fundingOp.params.minRate).toBe(0.01);
            expect(fundingOp.params.exchange).toBe('avantis');
            expect(fundingOp.label).toBe('fundingCheck');
        });

        it('should serialize OPEN_SHORT operation with correct params', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const serialized = strategy.serialize();
            const parsed = JSON.parse(serialized);

            const shortOp = parsed.operations[1];
            expect(shortOp.type).toBe(OperationType.OPEN_SHORT);
            expect(shortOp.params.ticker).toBe('BTC/USDC');
            expect(shortOp.params.size).toBe('50');
            expect(shortOp.params.leverage).toBe(1);
            expect(shortOp.params.isPercentage).toBe(true);
            expect(shortOp.params.exchange).toBe('avantis');
            expect(shortOp.label).toBe('shortPosition');
        });

        it('should serialize SPOT_BUY operation with correct params', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const serialized = strategy.serialize();
            const parsed = JSON.parse(serialized);

            const spotOp = parsed.operations[2];
            expect(spotOp.type).toBe(OperationType.SPOT_BUY);
            expect(spotOp.params.ticker).toBe('BTC/USDC');
            expect(spotOp.params.amount).toBe('50');
            expect(spotOp.params.isPercentage).toBe(true);
            expect(spotOp.params.exchange).toBe('1inch-fusion');
            expect(spotOp.label).toBe('spotHedge');
        });

        it('should serialize with labels for operation referencing', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const serialized = strategy.serialize();
            const parsed = JSON.parse(serialized);

            expect(parsed.operations[0].label).toBe('fundingCheck');
            expect(parsed.operations[1].label).toBe('shortPosition');
            expect(parsed.operations[2].label).toBe('spotHedge');
        });
    });

    describe('Deserialization', () => {
        it('should be deserializable back to operations', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const serialized = strategy.serialize();
            const parsed = JSON.parse(serialized);

            expect(parsed.operations).toBeDefined();
            expect(parsed.operations.length).toBe(3);

            parsed.operations.forEach((op: { type: string; order: number; params: unknown }) => {
                expect(op.type).toBeDefined();
                expect(op.order).toBeDefined();
                expect(op.params).toBeDefined();
            });
        });

        it('should maintain operation order after serialization', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const operations = strategy.getOperations();
            const serialized = strategy.serialize();
            const parsed = JSON.parse(serialized);

            operations.forEach((op, index) => {
                expect(parsed.operations[index].order).toBe(op.order);
                expect(parsed.operations[index].type).toBe(op.type);
            });
        });

        it('should preserve all operation parameters', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const operations = strategy.getOperations();
            const serialized = strategy.serialize();
            const parsed = JSON.parse(serialized);

            operations.forEach((op, index) => {
                expect(parsed.operations[index].params).toEqual(op.params);
            });
        });
    });

    describe('Validation', () => {
        it('should validate valid instant execution config', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const config = {
                slippageTolerance: 1,
                executionMode: 'instant' as const
            };

            const result = strategy.validate(config);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should validate valid optimized execution config', () => {
            const strategy = new BTCDeltaNeutralStrategy();
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
            const strategy = new BTCDeltaNeutralStrategy();
            const config = {
                slippageTolerance: -1,
                executionMode: 'instant' as const
            };

            const result = strategy.validate(config);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Slippage tolerance must be between 0 and 100');
        });

        it('should reject slippage tolerance over 100', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const config = {
                slippageTolerance: 150,
                executionMode: 'instant' as const
            };

            const result = strategy.validate(config);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Slippage tolerance must be between 0 and 100');
        });

        it('should validate valid capital allocation', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const config = {
                slippageTolerance: 1,
                executionMode: 'instant' as const,
                capitalAllocation: '5000'
            };

            const result = strategy.validate(config);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject negative capital allocation', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const config = {
                slippageTolerance: 1,
                executionMode: 'instant' as const,
                capitalAllocation: '-1000'
            };

            const result = strategy.validate(config);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Capital allocation must be a positive number');
        });

        it('should reject zero capital allocation', () => {
            const strategy = new BTCDeltaNeutralStrategy();
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
            const strategy = new BTCDeltaNeutralStrategy();
            const config = {
                slippageTolerance: 1,
                executionMode: 'instant' as const,
                capitalAllocation: 'not-a-number'
            };

            const result = strategy.validate(config);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Capital allocation must be a positive number');
        });

        it('should accumulate multiple validation errors', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const config = {
                slippageTolerance: -5,
                executionMode: 'instant' as const,
                capitalAllocation: 'invalid'
            };

            const result = strategy.validate(config);

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBe(2);
        });

        it('should accept boundary values for slippage', () => {
            const strategy = new BTCDeltaNeutralStrategy();

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

        it('should validate config with all optional fields', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const config = {
                slippageTolerance: 2,
                executionMode: 'optimized' as const,
                spreadPercentage: 1,
                capitalAllocation: '10000'
            };

            const result = strategy.validate(config);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });

    describe('getOperations', () => {
        it('should return array of operations', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const operations = strategy.getOperations();

            expect(Array.isArray(operations)).toBe(true);
            expect(operations.length).toBe(3);
        });

        it('should return operations with correct types in sequence', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const operations = strategy.getOperations();

            expect(operations[0].type).toBe(OperationType.CHECK_FUNDING_RATE);
            expect(operations[1].type).toBe(OperationType.OPEN_SHORT);
            expect(operations[2].type).toBe(OperationType.SPOT_BUY);
        });

        it('should return a copy of operations array', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const operations1 = strategy.getOperations();
            const operations2 = strategy.getOperations();

            expect(operations1).toEqual(operations2);
            expect(operations1).not.toBe(operations2);
        });

        it('should not allow mutation of internal operations', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const operations = strategy.getOperations();

            operations.push({
                type: OperationType.SPOT_SELL,
                order: 999,
                params: { ticker: 'ETH/USDC', amount: '100' }
            });

            const freshOperations = strategy.getOperations();
            expect(freshOperations.length).toBe(3);
        });

        it('should return operations with all required fields', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const operations = strategy.getOperations();

            operations.forEach(op => {
                expect(op).toHaveProperty('type');
                expect(op).toHaveProperty('order');
                expect(op).toHaveProperty('params');
            });
        });

        it('should return operations with labels', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const operations = strategy.getOperations();

            expect(operations[0].label).toBe('fundingCheck');
            expect(operations[1].label).toBe('shortPosition');
            expect(operations[2].label).toBe('spotHedge');
        });
    });

    describe('Strategy Logic', () => {
        it('should use 50% capital for short position', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const operations = strategy.getOperations();
            const shortOp = operations.find(op => op.type === OperationType.OPEN_SHORT);

            expect(shortOp).toBeDefined();
            expect(shortOp?.params).toHaveProperty('size', '50');
            expect(shortOp?.params).toHaveProperty('isPercentage', true);
        });

        it('should use 50% capital for spot hedge', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const operations = strategy.getOperations();
            const spotOp = operations.find(op => op.type === OperationType.SPOT_BUY);

            expect(spotOp).toBeDefined();
            expect(spotOp?.params).toHaveProperty('amount', '50');
            expect(spotOp?.params).toHaveProperty('isPercentage', true);
        });

        it('should use 1x leverage for low risk', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const operations = strategy.getOperations();
            const shortOp = operations.find(op => op.type === OperationType.OPEN_SHORT);

            expect(shortOp?.params).toHaveProperty('leverage', 1);
        });

        it('should check funding rate before execution', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const operations = strategy.getOperations();

            expect(operations[0].type).toBe(OperationType.CHECK_FUNDING_RATE);
            expect(operations[0].order).toBe(1);
        });

        it('should use Avantis for perpetuals', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const operations = strategy.getOperations();
            const fundingOp = operations.find(op => op.type === OperationType.CHECK_FUNDING_RATE);
            const shortOp = operations.find(op => op.type === OperationType.OPEN_SHORT);

            expect(fundingOp?.params).toHaveProperty('exchange', 'avantis');
            expect(shortOp?.params).toHaveProperty('exchange', 'avantis');
        });

        it('should use 1inch Fusion for spot trading', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const operations = strategy.getOperations();
            const spotOp = operations.find(op => op.type === OperationType.SPOT_BUY);

            expect(spotOp?.params).toHaveProperty('exchange', '1inch-fusion');
        });

        it('should trade BTC/USDC pair', () => {
            const strategy = new BTCDeltaNeutralStrategy();
            const operations = strategy.getOperations();

            operations.forEach(op => {
                expect(op.params).toHaveProperty('ticker', 'BTC/USDC');
            });
        });
    });
});
