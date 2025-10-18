import { describe, it, expect } from 'vitest';
import { OperationFactory } from '../OperationFactory';
import { OperationType } from '../../operations/OperationTypes';
import { MockOperation } from '../../operations/MockOperation';

describe('OperationFactory', () => {
  describe('deserialize', () => {
    it('should deserialize a valid MockOperation', () => {
      const serialized = JSON.stringify({
        operations: [
          {
            type: OperationType.MOCK_OPERATION,
            order: 1,
            params: {
              message: 'Test message',
              delay: 2000
            }
          }
        ]
      });
      
      const operations = OperationFactory.deserialize(serialized);
      
      expect(operations).toHaveLength(1);
      expect(operations[0]).toBeInstanceOf(MockOperation);
      expect(operations[0].type).toBe(OperationType.MOCK_OPERATION);
      expect(operations[0].order).toBe(1);
    });
    
    it('should deserialize MockOperation with default delay', () => {
      const serialized = JSON.stringify({
        operations: [
          {
            type: OperationType.MOCK_OPERATION,
            order: 1,
            params: {
              message: 'Test message'
              // delay not provided, should default to 1000
            }
          }
        ]
      });
      
      const operations = OperationFactory.deserialize(serialized);
      
      expect(operations).toHaveLength(1);
      expect(operations[0]).toBeInstanceOf(MockOperation);
    });
    
    it('should deserialize multiple operations', () => {
      const serialized = JSON.stringify({
        operations: [
          {
            type: OperationType.MOCK_OPERATION,
            order: 1,
            params: { message: 'First', delay: 500 }
          },
          {
            type: OperationType.MOCK_OPERATION,
            order: 2,
            params: { message: 'Second', delay: 1000 }
          }
        ]
      });
      
      const operations = OperationFactory.deserialize(serialized);
      
      expect(operations).toHaveLength(2);
      expect(operations[0].order).toBe(1);
      expect(operations[1].order).toBe(2);
    });
    
    it('should throw error for invalid JSON', () => {
      const invalidJson = 'not valid json {';
      
      expect(() => OperationFactory.deserialize(invalidJson))
        .toThrow('Failed to parse serialized strategy');
    });
    
    it('should throw error for missing operations array', () => {
      const serialized = JSON.stringify({
        metadata: { strategyId: 'test' }
        // operations array missing
      });
      
      expect(() => OperationFactory.deserialize(serialized))
        .toThrow('Invalid strategy structure: missing or invalid operations array');
    });
    
    it('should throw error for unknown operation type', () => {
      const serialized = JSON.stringify({
        operations: [
          {
            type: 'unknown_operation_type',
            order: 1,
            params: {}
          }
        ]
      });
      
      expect(() => OperationFactory.deserialize(serialized))
        .toThrow('Unknown operation type');
    });
    
    it('should throw error for missing operation type', () => {
      const serialized = JSON.stringify({
        operations: [
          {
            order: 1,
            params: { message: 'Test' }
            // type missing
          }
        ]
      });
      
      expect(() => OperationFactory.deserialize(serialized))
        .toThrow('Operation missing required "type" field');
    });
    
    it('should throw error for missing order field', () => {
      const serialized = JSON.stringify({
        operations: [
          {
            type: OperationType.MOCK_OPERATION,
            params: { message: 'Test' }
            // order missing
          }
        ]
      });
      
      expect(() => OperationFactory.deserialize(serialized))
        .toThrow('Operation missing required "order" field');
    });
    
    it('should throw error for missing params field', () => {
      const serialized = JSON.stringify({
        operations: [
          {
            type: OperationType.MOCK_OPERATION,
            order: 1
            // params missing
          }
        ]
      });
      
      expect(() => OperationFactory.deserialize(serialized))
        .toThrow('Operation missing required "params" field');
    });
    
    it('should throw error for MockOperation missing message parameter', () => {
      const serialized = JSON.stringify({
        operations: [
          {
            type: OperationType.MOCK_OPERATION,
            order: 1,
            params: {
              delay: 1000
              // message missing
            }
          }
        ]
      });
      
      expect(() => OperationFactory.deserialize(serialized))
        .toThrow('MockOperation requires "message" parameter of type string');
    });
    
    it('should include operation index in error messages', () => {
      const serialized = JSON.stringify({
        operations: [
          {
            type: OperationType.MOCK_OPERATION,
            order: 1,
            params: { message: 'Valid' }
          },
          {
            type: OperationType.MOCK_OPERATION,
            order: 2,
            params: { delay: 1000 } // missing message
          }
        ]
      });
      
      expect(() => OperationFactory.deserialize(serialized))
        .toThrow('Failed to deserialize operation at index 1');
    });
  });
});
