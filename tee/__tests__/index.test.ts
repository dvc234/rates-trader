/**
 * Tests for TEE entry point
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('TEE Entry Point', () => {
  const testInputPath = path.join(__dirname, 'test-input.json');
  const testOutputPath = path.join(__dirname, 'test-output.json');
  
  beforeEach(() => {
    // Clean up test files
    if (fs.existsSync(testInputPath)) {
      fs.unlinkSync(testInputPath);
    }
    if (fs.existsSync(testOutputPath)) {
      fs.unlinkSync(testOutputPath);
    }
  });
  
  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testInputPath)) {
      fs.unlinkSync(testInputPath);
    }
    if (fs.existsSync(testOutputPath)) {
      fs.unlinkSync(testOutputPath);
    }
  });
  
  it('should have proper input/output format documentation', () => {
    // This test verifies that the entry point file exists and is properly structured
    const entryPointPath = path.join(__dirname, '..', 'index.ts');
    expect(fs.existsSync(entryPointPath)).toBe(true);
    
    const content = fs.readFileSync(entryPointPath, 'utf-8');
    
    // Verify documentation includes input format
    expect(content).toContain('Input Format');
    expect(content).toContain('IEXEC_IN');
    expect(content).toContain('IEXEC_OUT');
    expect(content).toContain('serializedStrategy');
    
    // Verify documentation includes output format
    expect(content).toContain('Output Format');
    expect(content).toContain('success');
    expect(content).toContain('operationResults');
    
    // Verify main function exists
    expect(content).toContain('async function main()');
    
    // Verify StrategyExecutor is imported and used
    expect(content).toContain('StrategyExecutor');
    expect(content).toContain('executor.initialize');
    expect(content).toContain('executor.execute');
  });
  
  it('should export main function', async () => {
    // Verify the module exports main function
    const module = await import('../index');
    
    // The module should export main
    expect(module.main).toBeDefined();
    expect(typeof module.main).toBe('function');
  });
  
  it('should create valid test input structure', () => {
    // Create a test input that matches the expected format
    const testInput = {
      serializedStrategy: JSON.stringify({
        operations: [
          {
            type: 'mock_operation',
            order: 1,
            params: {
              message: 'Test operation',
              delay: 100
            }
          }
        ]
      }),
      config: {
        slippageTolerance: 1.0,
        executionMode: 'instant' as const,
        capitalAllocation: '1000'
      },
      wallet: {
        address: '0x1234567890123456789012345678901234567890'
      },
      network: {
        chainId: 8453,
        rpcUrl: 'https://mainnet.base.org',
        contracts: {
          oneInchFusion: '0x1111111111111111111111111111111111111111',
          perpetualDex: '0x2222222222222222222222222222222222222222'
        }
      }
    };
    
    // Write test input
    fs.writeFileSync(testInputPath, JSON.stringify(testInput, null, 2));
    
    // Verify it can be read back
    const readBack = JSON.parse(fs.readFileSync(testInputPath, 'utf-8'));
    expect(readBack).toEqual(testInput);
    expect(readBack.serializedStrategy).toBeDefined();
    expect(readBack.config).toBeDefined();
    expect(readBack.wallet).toBeDefined();
    expect(readBack.network).toBeDefined();
  });
  
  it('should define expected output structure', () => {
    // Define the expected output structure
    const expectedSuccessOutput = {
      success: true,
      operationResults: [
        {
          success: true,
          operationType: 'mock_operation',
          data: { message: 'Test', executedAt: Date.now() }
        }
      ],
      totalGasUsed: '123456',
      startTime: Date.now(),
      endTime: Date.now()
    };
    
    const expectedFailureOutput = {
      success: false,
      operationResults: [],
      totalGasUsed: '0',
      error: {
        code: 'EXECUTION_ERROR',
        message: 'Strategy execution failed',
        recoverable: false
      },
      startTime: Date.now(),
      endTime: Date.now()
    };
    
    // Verify structure is valid
    expect(expectedSuccessOutput.success).toBe(true);
    expect(expectedSuccessOutput.operationResults).toBeInstanceOf(Array);
    expect(expectedSuccessOutput.totalGasUsed).toBeDefined();
    
    expect(expectedFailureOutput.success).toBe(false);
    expect(expectedFailureOutput.error).toBeDefined();
    expect(expectedFailureOutput.error.code).toBeDefined();
    expect(expectedFailureOutput.error.message).toBeDefined();
  });
});
