/**
 * Tests for IExecExecutionService
 * 
 * These tests verify:
 * - Service initialization
 * - Strategy execution flow
 * - Execution status monitoring
 * - State transitions (pending → running → completed/failed)
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IExecExecutionService } from '../IExecExecutionService';
import { StrategyDataProtectorService } from '../StrategyDataProtectorService';
import type { StrategyConfig } from '@/types/strategy';

// Mock StrategyDataProtectorService
vi.mock('../StrategyDataProtectorService', () => ({
  StrategyDataProtectorService: vi.fn().mockImplementation(() => ({
    isReady: vi.fn().mockReturnValue(true),
    verifyStrategyAccess: vi.fn().mockResolvedValue(true),
    checkStrategyOwnership: vi.fn().mockResolvedValue({
      isOwner: true,
      protectedDataAddress: '0xprotected123',
      purchasedAt: Date.now(),
    }),
  })),
}));

describe('IExecExecutionService', () => {
  let service: IExecExecutionService;
  let mockDataProtectorService: StrategyDataProtectorService;

  beforeEach(() => {
    // Create service with test configuration
    service = new IExecExecutionService({
      appAddress: '0xTestAppAddress',
      executionTimeout: 300,
    });

    // Create mock Data Protector service
    mockDataProtectorService = new StrategyDataProtectorService();
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid config', async () => {
      await service.initialize(mockDataProtectorService);
      expect(service.isReady()).toBe(true);
    });

    it('should throw error if app address not configured', async () => {
      const invalidService = new IExecExecutionService({ appAddress: '' });
      
      await expect(
        invalidService.initialize(mockDataProtectorService)
      ).rejects.toThrow('iExec app address not configured');
    });

    it('should throw error if Data Protector service not ready', async () => {
      const notReadyService = {
        isReady: vi.fn().mockReturnValue(false),
      } as any;

      await expect(
        service.initialize(notReadyService)
      ).rejects.toThrow('Data Protector service must be initialized');
    });
  });

  describe('Strategy Execution', () => {
    beforeEach(async () => {
      await service.initialize(mockDataProtectorService);
    });

    it('should execute strategy successfully', async () => {
      const config: StrategyConfig = {
        executionMode: 'instant',
        slippageTolerance: 1.0,
        capitalAllocation: '1000',
      };

      const result = await service.executeStrategy(
        'btc-delta-neutral',
        '0xUserAddress',
        config
      );

      expect(result.success).toBe(true);
      expect(result.taskId).toBeDefined();
      expect(result.taskId).toMatch(/^0x[0-9a-f]+$/);
    });

    it('should verify ownership before execution', async () => {
      const config: StrategyConfig = {
        executionMode: 'instant',
        slippageTolerance: 1.0,
        capitalAllocation: '1000',
      };

      await service.executeStrategy(
        'btc-delta-neutral',
        '0xUserAddress',
        config
      );

      expect(mockDataProtectorService.verifyStrategyAccess).toHaveBeenCalledWith(
        'btc-delta-neutral',
        '0xUserAddress'
      );
    });

    it('should fail if user does not own strategy', async () => {
      // Mock ownership verification failure
      vi.mocked(mockDataProtectorService.verifyStrategyAccess).mockRejectedValueOnce(
        new Error('User does not own strategy')
      );

      const config: StrategyConfig = {
        executionMode: 'instant',
        slippageTolerance: 1.0,
        capitalAllocation: '1000',
      };

      const result = await service.executeStrategy(
        'btc-delta-neutral',
        '0xUserAddress',
        config
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('must own this strategy');
    });

    it('should fail if protected data address not found', async () => {
      // Mock missing protected data address
      vi.mocked(mockDataProtectorService.checkStrategyOwnership).mockResolvedValueOnce({
        isOwner: true,
        protectedDataAddress: undefined,
        purchasedAt: Date.now(),
      } as any);

      const config: StrategyConfig = {
        executionMode: 'instant',
        slippageTolerance: 1.0,
        capitalAllocation: '1000',
      };

      const result = await service.executeStrategy(
        'btc-delta-neutral',
        '0xUserAddress',
        config
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Protected data address not found');
    });

    it('should throw error if not initialized', async () => {
      const uninitializedService = new IExecExecutionService({
        appAddress: '0xTestAppAddress',
      });

      const config: StrategyConfig = {
        executionMode: 'instant',
        slippageTolerance: 1.0,
        capitalAllocation: '1000',
      };

      await expect(
        uninitializedService.executeStrategy(
          'btc-delta-neutral',
          '0xUserAddress',
          config
        )
      ).rejects.toThrow('not initialized');
    });
  });

  describe('Execution Status Monitoring', () => {
    beforeEach(async () => {
      await service.initialize(mockDataProtectorService);
    });

    it('should return pending status for new tasks', async () => {
      // Create a task ID with current timestamp (age < 10s)
      const taskId = `0x${Date.now().toString(16)}abcdef12`;

      const status = await service.getExecutionStatus(taskId);

      expect(status.status).toBe('pending');
      expect(status.taskId).toBe(taskId);
      expect(status.result).toBeUndefined();
      expect(status.error).toBeUndefined();
    });

    it('should return running status for active tasks', async () => {
      // Create a task ID with timestamp 15 seconds ago (10s < age < 30s)
      const timestamp = Date.now() - 15000;
      const taskId = `0x${timestamp.toString(16)}abcdef12`;

      const status = await service.getExecutionStatus(taskId);

      expect(status.status).toBe('running');
      expect(status.taskId).toBe(taskId);
      expect(status.result).toBeUndefined();
      expect(status.error).toBeUndefined();
    });

    it('should return completed status with results for finished tasks', async () => {
      // Create a task ID with timestamp 35 seconds ago (age > 30s)
      const timestamp = Date.now() - 35000;
      const taskId = `0x${timestamp.toString(16)}abcdef12`;

      const status = await service.getExecutionStatus(taskId);

      expect(status.status).toBe('completed');
      expect(status.taskId).toBe(taskId);
      expect(status.result).toBeDefined();
      expect(status.result?.success).toBe(true);
      expect(status.result?.executedOperations).toBe(3);
      expect(status.result?.metrics).toBeDefined();
      expect(status.result?.metrics?.gasUsed).toBeDefined();
      expect(status.result?.metrics?.profitEstimate).toBeDefined();
      expect(status.result?.metrics?.positions).toBeDefined();
      expect(status.result?.metrics?.spotTrades).toBeDefined();
    });

    it('should return failed status for invalid task ID', async () => {
      const invalidTaskId = 'invalid-task-id';

      const status = await service.getExecutionStatus(invalidTaskId);

      expect(status.status).toBe('failed');
      expect(status.taskId).toBe(invalidTaskId);
      expect(status.error).toBeDefined();
      expect(status.error).toContain('Invalid task ID');
    });

    it('should handle task ID without 0x prefix', async () => {
      const taskIdWithout0x = 'abcdef1234567890';

      const status = await service.getExecutionStatus(taskIdWithout0x);

      expect(status.status).toBe('failed');
      expect(status.error).toBeDefined();
    });

    it('should throw error if not initialized', async () => {
      const uninitializedService = new IExecExecutionService({
        appAddress: '0xTestAppAddress',
      });

      await expect(
        uninitializedService.getExecutionStatus('0x123456')
      ).rejects.toThrow('not initialized');
    });

    it('should never throw errors - always return status object', async () => {
      // Even with invalid input, should return failed status, not throw
      const status = await service.getExecutionStatus('');

      expect(status.status).toBe('failed');
      expect(status.error).toBeDefined();
    });
  });

  describe('State Transitions', () => {
    beforeEach(async () => {
      await service.initialize(mockDataProtectorService);
    });

    it('should transition from pending to running', async () => {
      // Create task ID that will be pending initially
      const taskId = `0x${Date.now().toString(16)}abcdef12`;

      // Check initial status (pending)
      const status1 = await service.getExecutionStatus(taskId);
      expect(status1.status).toBe('pending');

      // Wait 11 seconds (simulated by adjusting timestamp)
      const olderTaskId = `0x${(Date.now() - 11000).toString(16)}abcdef12`;
      
      // Check status again (should be running)
      const status2 = await service.getExecutionStatus(olderTaskId);
      expect(status2.status).toBe('running');
    });

    it('should transition from running to completed', async () => {
      // Create task ID that will be running
      const runningTaskId = `0x${(Date.now() - 15000).toString(16)}abcdef12`;
      
      const status1 = await service.getExecutionStatus(runningTaskId);
      expect(status1.status).toBe('running');

      // Create task ID that will be completed
      const completedTaskId = `0x${(Date.now() - 35000).toString(16)}abcdef12`;
      
      const status2 = await service.getExecutionStatus(completedTaskId);
      expect(status2.status).toBe('completed');
      expect(status2.result).toBeDefined();
    });

    it('should include execution results when completed', async () => {
      const completedTaskId = `0x${(Date.now() - 35000).toString(16)}abcdef12`;
      
      const status = await service.getExecutionStatus(completedTaskId);

      expect(status.status).toBe('completed');
      expect(status.result).toMatchObject({
        success: true,
        executedOperations: expect.any(Number),
        metrics: expect.objectContaining({
          gasUsed: expect.any(String),
          profitEstimate: expect.any(Number),
          fundingRates: expect.any(Object),
          positions: expect.any(Array),
          spotTrades: expect.any(Array),
        }),
      });
    });
  });

  describe('Configuration Management', () => {
    it('should return current configuration', () => {
      const config = service.getConfig();

      expect(config.appAddress).toBe('0xTestAppAddress');
      expect(config.executionTimeout).toBe(300);
    });

    it('should update configuration before initialization', () => {
      service.updateConfig({
        executionTimeout: 600,
      });

      const config = service.getConfig();
      expect(config.executionTimeout).toBe(600);
    });

    it('should throw error when updating config after initialization', async () => {
      await service.initialize(mockDataProtectorService);

      expect(() => {
        service.updateConfig({ executionTimeout: 600 });
      }).toThrow('Cannot update iExec config after initialization');
    });
  });

  describe('Service Readiness', () => {
    it('should not be ready before initialization', () => {
      expect(service.isReady()).toBe(false);
    });

    it('should be ready after initialization', async () => {
      await service.initialize(mockDataProtectorService);
      expect(service.isReady()).toBe(true);
    });
  });
});
