/**
 * Tests for StrategyDataProtectorService
 * 
 * These tests verify:
 * - Strategy purchase flow
 * - Ownership verification logic
 * - Access control enforcement
 * - Non-owner prevention from accessing encrypted operations
 * - TEE execution authorization
 * - Error handling scenarios
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StrategyDataProtectorService } from '../StrategyDataProtectorService';
import type { Strategy } from '@/types/strategy';

// Mock the IExecDataProtector
vi.mock('@iexec/dataprotector', () => ({
    IExecDataProtector: vi.fn().mockImplementation(() => ({
        core: {
            protectData: vi.fn(),
            grantAccess: vi.fn(),
            getProtectedData: vi.fn(),
        },
    })),
}));

describe('StrategyDataProtectorService - Ownership Verification', () => {
    let service: StrategyDataProtectorService;
    let mockWalletProvider: any;
    let mockDataProtector: any;

    const mockUserAddress = '0x1234567890123456789012345678901234567890';
    const mockStrategyId = 'btc-delta-neutral';
    const mockProtectedDataAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

    beforeEach(async () => {
        // Create service instance
        service = new StrategyDataProtectorService({
            appAddress: '0x9999999999999999999999999999999999999999',
        });

        // Mock wallet provider
        mockWalletProvider = {
            request: vi.fn(),
        };

        // Initialize service
        await service.initialize(mockWalletProvider);

        // Get mock data protector instance
        mockDataProtector = (service as any).dataProtector;
    });

    describe('checkStrategyOwnership', () => {
        it('should return isOwner: true when user owns the strategy', async () => {
            // Mock protected data response - user owns the strategy
            mockDataProtector.core.getProtectedData.mockResolvedValue([
                {
                    address: mockProtectedDataAddress,
                    name: `Strategy: ${mockStrategyId}`,
                    creationTimestamp: Date.now(),
                    data: JSON.stringify({
                        strategyId: mockStrategyId,
                        metadata: { id: mockStrategyId, name: 'BTC Delta Neutral' },
                    }),
                },
            ]);

            const result = await service.checkStrategyOwnership(
                mockStrategyId,
                mockUserAddress
            );

            expect(result.isOwner).toBe(true);
            expect(result.protectedDataAddress).toBe(mockProtectedDataAddress);
            expect(result.grantedAt).toBeDefined();
        });

        it('should return isOwner: false when user does not own the strategy', async () => {
            // Mock protected data response - user owns no strategies
            mockDataProtector.core.getProtectedData.mockResolvedValue([]);

            const result = await service.checkStrategyOwnership(
                mockStrategyId,
                mockUserAddress
            );

            expect(result.isOwner).toBe(false);
            expect(result.protectedDataAddress).toBeUndefined();
            expect(result.grantedAt).toBeUndefined();
        });

        it('should match strategy by protected data address', async () => {
            // Mock protected data response - match by address
            mockDataProtector.core.getProtectedData.mockResolvedValue([
                {
                    address: mockProtectedDataAddress,
                    name: 'Some Strategy',
                    creationTimestamp: Date.now(),
                },
            ]);

            const result = await service.checkStrategyOwnership(
                mockProtectedDataAddress, // Use address as strategy ID
                mockUserAddress
            );

            expect(result.isOwner).toBe(true);
            expect(result.protectedDataAddress).toBe(mockProtectedDataAddress);
        });

        it('should match strategy by name', async () => {
            // Mock protected data response - match by name
            mockDataProtector.core.getProtectedData.mockResolvedValue([
                {
                    address: mockProtectedDataAddress,
                    name: `Strategy: ${mockStrategyId}`,
                    creationTimestamp: Date.now(),
                },
            ]);

            const result = await service.checkStrategyOwnership(
                mockStrategyId,
                mockUserAddress
            );

            expect(result.isOwner).toBe(true);
        });

        it('should return isOwner: false on error (security fail-safe)', async () => {
            // Mock error during query
            mockDataProtector.core.getProtectedData.mockRejectedValue(
                new Error('Network error')
            );

            const result = await service.checkStrategyOwnership(
                mockStrategyId,
                mockUserAddress
            );

            // Should fail-safe to no ownership on error
            expect(result.isOwner).toBe(false);
        });

        it('should handle multiple owned strategies and find the correct one', async () => {
            // Mock protected data response - user owns multiple strategies
            mockDataProtector.core.getProtectedData.mockResolvedValue([
                {
                    address: '0xaaaa',
                    name: 'Strategy: other-strategy',
                    creationTimestamp: Date.now(),
                },
                {
                    address: mockProtectedDataAddress,
                    name: `Strategy: ${mockStrategyId}`,
                    creationTimestamp: Date.now(),
                },
                {
                    address: '0xbbbb',
                    name: 'Strategy: another-strategy',
                    creationTimestamp: Date.now(),
                },
            ]);

            const result = await service.checkStrategyOwnership(
                mockStrategyId,
                mockUserAddress
            );

            expect(result.isOwner).toBe(true);
            expect(result.protectedDataAddress).toBe(mockProtectedDataAddress);
        });
    });

    describe('verifyStrategyAccess', () => {
        it('should not throw when user owns the strategy', async () => {
            // Mock ownership check - user owns strategy
            mockDataProtector.core.getProtectedData.mockResolvedValue([
                {
                    address: mockProtectedDataAddress,
                    name: `Strategy: ${mockStrategyId}`,
                    creationTimestamp: Date.now(),
                },
            ]);

            // Should not throw
            await expect(
                service.verifyStrategyAccess(mockStrategyId, mockUserAddress)
            ).resolves.not.toThrow();
        });

        it('should throw when user does not own the strategy', async () => {
            // Mock ownership check - user does not own strategy
            mockDataProtector.core.getProtectedData.mockResolvedValue([]);

            // Should throw access denied error
            await expect(
                service.verifyStrategyAccess(mockStrategyId, mockUserAddress)
            ).rejects.toThrow('Access denied');
        });

        it('should throw with descriptive error message for non-owners', async () => {
            // Mock ownership check - user does not own strategy
            mockDataProtector.core.getProtectedData.mockResolvedValue([]);

            try {
                await service.verifyStrategyAccess(mockStrategyId, mockUserAddress);
                expect.fail('Should have thrown an error');
            } catch (error: any) {
                expect(error.message).toContain('Access denied');
                expect(error.message).toContain(mockUserAddress);
                expect(error.message).toContain(mockStrategyId);
                expect(error.message).toContain('purchase');
            }
        });

        it('should prevent non-owners from accessing encrypted operations', async () => {
            // Mock ownership check - user does not own strategy
            mockDataProtector.core.getProtectedData.mockResolvedValue([]);

            // Attempt to verify access (simulating TEE execution attempt)
            let accessDenied = false;
            try {
                await service.verifyStrategyAccess(mockStrategyId, mockUserAddress);
            } catch (error) {
                accessDenied = true;
            }

            // Verify that access was denied
            expect(accessDenied).toBe(true);
        });
    });

    describe('getUserOwnedStrategies', () => {
        it('should return array of owned strategy addresses', async () => {
            // Mock protected data response - user owns multiple strategies
            mockDataProtector.core.getProtectedData.mockResolvedValue([
                {
                    address: '0xaaaa',
                    name: 'Strategy: strategy-1',
                    creationTimestamp: Date.now(),
                },
                {
                    address: '0xbbbb',
                    name: 'Strategy: strategy-2',
                    creationTimestamp: Date.now(),
                },
            ]);

            const result = await service.getUserOwnedStrategies(mockUserAddress);

            expect(result).toHaveLength(2);
            expect(result).toContain('0xaaaa');
            expect(result).toContain('0xbbbb');
        });

        it('should return empty array when user owns no strategies', async () => {
            // Mock protected data response - no strategies
            mockDataProtector.core.getProtectedData.mockResolvedValue([]);

            const result = await service.getUserOwnedStrategies(mockUserAddress);

            expect(result).toHaveLength(0);
        });

        it('should filter out non-strategy protected data', async () => {
            // Mock protected data response - mixed data
            mockDataProtector.core.getProtectedData.mockResolvedValue([
                {
                    address: '0xaaaa',
                    name: 'Strategy: strategy-1',
                    creationTimestamp: Date.now(),
                },
                {
                    address: '0xbbbb',
                    name: 'Some other data', // Not a strategy
                    creationTimestamp: Date.now(),
                },
                {
                    address: '0xcccc',
                    name: 'Strategy: strategy-2',
                    creationTimestamp: Date.now(),
                },
            ]);

            const result = await service.getUserOwnedStrategies(mockUserAddress);

            // Should only include strategies
            expect(result).toHaveLength(2);
            expect(result).toContain('0xaaaa');
            expect(result).toContain('0xcccc');
            expect(result).not.toContain('0xbbbb');
        });

        it('should return empty array on error (fail-safe)', async () => {
            // Mock error during query
            mockDataProtector.core.getProtectedData.mockRejectedValue(
                new Error('Network error')
            );

            const result = await service.getUserOwnedStrategies(mockUserAddress);

            // Should fail-safe to empty array
            expect(result).toHaveLength(0);
        });
    });

    describe('Access Control Integration', () => {
        it('should enforce ownership before allowing TEE execution', async () => {
            // Scenario: Non-owner tries to execute strategy
            mockDataProtector.core.getProtectedData.mockResolvedValue([]);

            // Step 1: Check ownership
            const ownership = await service.checkStrategyOwnership(
                mockStrategyId,
                mockUserAddress
            );
            expect(ownership.isOwner).toBe(false);

            // Step 2: Verify access (should fail)
            let canExecute = false;
            try {
                await service.verifyStrategyAccess(mockStrategyId, mockUserAddress);
                canExecute = true;
            } catch (error) {
                canExecute = false;
            }

            // Step 3: Verify execution is blocked
            expect(canExecute).toBe(false);
        });

        it('should allow TEE execution for strategy owners', async () => {
            // Scenario: Owner tries to execute strategy
            mockDataProtector.core.getProtectedData.mockResolvedValue([
                {
                    address: mockProtectedDataAddress,
                    name: `Strategy: ${mockStrategyId}`,
                    creationTimestamp: Date.now(),
                },
            ]);

            // Step 1: Check ownership
            const ownership = await service.checkStrategyOwnership(
                mockStrategyId,
                mockUserAddress
            );
            expect(ownership.isOwner).toBe(true);

            // Step 2: Verify access (should succeed)
            let canExecute = false;
            try {
                await service.verifyStrategyAccess(mockStrategyId, mockUserAddress);
                canExecute = true;
            } catch (error) {
                canExecute = false;
            }

            // Step 3: Verify execution is allowed
            expect(canExecute).toBe(true);
        });
    });
});

describe('StrategyDataProtectorService - Strategy Purchase', () => {
    let service: StrategyDataProtectorService;
    let mockWalletProvider: any;
    let mockDataProtector: any;

    const mockUserAddress = '0x1234567890123456789012345678901234567890';
    const mockProtectedDataAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
    const mockAppAddress = '0x9999999999999999999999999999999999999999';

    // Mock strategy with serialize method
    const mockStrategy = {
        id: 'btc-delta-neutral',
        name: 'BTC Delta Neutral',
        description: 'Funding rate arbitrage strategy',
        risk: 'medium',
        apr: { min: 5, max: 15 },
        price: '10',
        serialize: vi.fn().mockReturnValue(JSON.stringify({
            operations: [
                { type: 'check_funding_rate', order: 1, params: {} },
                { type: 'open_perpetual_short', order: 2, params: {} },
                { type: 'spot_buy', order: 3, params: {} },
            ],
        })),
    };

    beforeEach(async () => {
        // Create service instance with mock app address
        service = new StrategyDataProtectorService({
            appAddress: mockAppAddress,
        });

        // Mock wallet provider
        mockWalletProvider = {
            request: vi.fn(),
        };

        // Initialize service
        await service.initialize(mockWalletProvider);

        // Get mock data protector instance
        mockDataProtector = (service as any).dataProtector;
    });

    describe('purchaseStrategy', () => {
        it('should successfully purchase a strategy', async () => {
            // Mock protectData response
            mockDataProtector.core.protectData.mockResolvedValue({
                address: mockProtectedDataAddress,
            });

            // Mock grantAccess response
            mockDataProtector.core.grantAccess.mockResolvedValue({
                txHash: '0xtxhash123',
            });

            const result = await service.purchaseStrategy(mockStrategy, mockUserAddress);

            // Verify purchase succeeded
            expect(result.success).toBe(true);
            expect(result.protectedDataAddress).toBe(mockProtectedDataAddress);

            // Verify protectData was called with correct parameters
            expect(mockDataProtector.core.protectData).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    strategyId: mockStrategy.id,
                    strategyName: mockStrategy.name,
                    metadata: expect.objectContaining({
                        id: mockStrategy.id,
                        name: mockStrategy.name,
                    }),
                    operations: expect.any(String),
                }),
                name: `Strategy: ${mockStrategy.name}`,
            });

            // Verify grantAccess was called with correct parameters
            expect(mockDataProtector.core.grantAccess).toHaveBeenCalledWith({
                protectedData: mockProtectedDataAddress,
                authorizedApp: mockAppAddress,
                authorizedUser: mockUserAddress,
                numberOfAccess: undefined,
            });

            // Verify strategy was serialized
            expect(mockStrategy.serialize).toHaveBeenCalled();
        });

        it('should grant access to both buyer and TEE app', async () => {
            // Mock responses
            mockDataProtector.core.protectData.mockResolvedValue({
                address: mockProtectedDataAddress,
            });
            mockDataProtector.core.grantAccess.mockResolvedValue({
                txHash: '0xtxhash123',
            });

            await service.purchaseStrategy(mockStrategy, mockUserAddress);

            // Verify grantAccess includes both buyer and TEE app
            const grantCall = mockDataProtector.core.grantAccess.mock.calls[0][0];
            expect(grantCall.authorizedUser).toBe(mockUserAddress);
            expect(grantCall.authorizedApp).toBe(mockAppAddress);
        });

        it('should handle insufficient funds error', async () => {
            // Mock protectData to throw insufficient funds error
            mockDataProtector.core.protectData.mockRejectedValue(
                new Error('insufficient funds for gas')
            );

            const result = await service.purchaseStrategy(mockStrategy, mockUserAddress);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Insufficient RLC balance');
        });

        it('should handle user rejection error', async () => {
            // Mock protectData to throw user rejection error
            mockDataProtector.core.protectData.mockRejectedValue(
                new Error('user rejected transaction')
            );

            const result = await service.purchaseStrategy(mockStrategy, mockUserAddress);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Transaction rejected by user');
        });

        it('should handle generic purchase errors', async () => {
            // Mock protectData to throw generic error
            mockDataProtector.core.protectData.mockRejectedValue(
                new Error('Network error')
            );

            const result = await service.purchaseStrategy(mockStrategy, mockUserAddress);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.protectedDataAddress).toBeUndefined();
        });

        it('should handle grantAccess failure', async () => {
            // Mock protectData success but grantAccess failure
            mockDataProtector.core.protectData.mockResolvedValue({
                address: mockProtectedDataAddress,
            });
            mockDataProtector.core.grantAccess.mockRejectedValue(
                new Error('Grant access failed')
            );

            const result = await service.purchaseStrategy(mockStrategy, mockUserAddress);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should protect strategy data with correct structure', async () => {
            // Mock responses
            mockDataProtector.core.protectData.mockResolvedValue({
                address: mockProtectedDataAddress,
            });
            mockDataProtector.core.grantAccess.mockResolvedValue({
                txHash: '0xtxhash123',
            });

            await service.purchaseStrategy(mockStrategy, mockUserAddress);

            // Verify data structure passed to protectData
            const protectCall = mockDataProtector.core.protectData.mock.calls[0][0];
            expect(protectCall.data).toHaveProperty('strategyId');
            expect(protectCall.data).toHaveProperty('strategyName');
            expect(protectCall.data).toHaveProperty('metadata');
            expect(protectCall.data).toHaveProperty('operations');
            expect(protectCall.data.metadata).toHaveProperty('id');
            expect(protectCall.data.metadata).toHaveProperty('name');
            expect(protectCall.data.metadata).toHaveProperty('description');
            expect(protectCall.data.metadata).toHaveProperty('risk');
            expect(protectCall.data.metadata).toHaveProperty('aprMin');
            expect(protectCall.data.metadata).toHaveProperty('aprMax');
            expect(protectCall.data.metadata).toHaveProperty('price');
        });

        it('should include serialized operations in protected data', async () => {
            // Mock responses
            mockDataProtector.core.protectData.mockResolvedValue({
                address: mockProtectedDataAddress,
            });
            mockDataProtector.core.grantAccess.mockResolvedValue({
                txHash: '0xtxhash123',
            });

            const serializedOps = JSON.stringify({ operations: [] });
            mockStrategy.serialize.mockReturnValue(serializedOps);

            await service.purchaseStrategy(mockStrategy, mockUserAddress);

            // Verify serialized operations are included
            const protectCall = mockDataProtector.core.protectData.mock.calls[0][0];
            expect(protectCall.data.operations).toBe(serializedOps);
        });

        it('should respect maxAccessCount configuration', async () => {
            // Create service with limited access count
            const limitedService = new StrategyDataProtectorService({
                appAddress: mockAppAddress,
                maxAccessCount: 5,
            });
            await limitedService.initialize(mockWalletProvider);
            const limitedMockDataProtector = (limitedService as any).dataProtector;

            // Mock responses
            limitedMockDataProtector.core.protectData.mockResolvedValue({
                address: mockProtectedDataAddress,
            });
            limitedMockDataProtector.core.grantAccess.mockResolvedValue({
                txHash: '0xtxhash123',
            });

            await limitedService.purchaseStrategy(mockStrategy, mockUserAddress);

            // Verify numberOfAccess is set
            const grantCall = limitedMockDataProtector.core.grantAccess.mock.calls[0][0];
            expect(grantCall.numberOfAccess).toBe(5);
        });
    });

    describe('Purchase Flow Integration', () => {
        it('should complete full purchase flow from start to finish', async () => {
            // Mock all required calls
            mockDataProtector.core.protectData.mockResolvedValue({
                address: mockProtectedDataAddress,
            });
            mockDataProtector.core.grantAccess.mockResolvedValue({
                txHash: '0xtxhash123',
            });

            // Step 1: Purchase strategy
            const purchaseResult = await service.purchaseStrategy(
                mockStrategy,
                mockUserAddress
            );
            expect(purchaseResult.success).toBe(true);
            expect(purchaseResult.protectedDataAddress).toBe(mockProtectedDataAddress);

            // Step 2: Verify ownership after purchase
            mockDataProtector.core.getProtectedData.mockResolvedValue([
                {
                    address: mockProtectedDataAddress,
                    name: `Strategy: ${mockStrategy.name}`,
                    creationTimestamp: Date.now(),
                },
            ]);

            const ownership = await service.checkStrategyOwnership(
                mockStrategy.id,
                mockUserAddress
            );
            expect(ownership.isOwner).toBe(true);

            // Step 3: Verify access is granted
            await expect(
                service.verifyStrategyAccess(mockStrategy.id, mockUserAddress)
            ).resolves.not.toThrow();
        });

        it('should prevent execution before purchase', async () => {
            // User has not purchased strategy yet
            mockDataProtector.core.getProtectedData.mockResolvedValue([]);

            // Verify ownership check fails
            const ownership = await service.checkStrategyOwnership(
                mockStrategy.id,
                mockUserAddress
            );
            expect(ownership.isOwner).toBe(false);

            // Verify access is denied
            await expect(
                service.verifyStrategyAccess(mockStrategy.id, mockUserAddress)
            ).rejects.toThrow('Access denied');
        });

        it('should allow execution after successful purchase', async () => {
            // Mock successful purchase
            mockDataProtector.core.protectData.mockResolvedValue({
                address: mockProtectedDataAddress,
            });
            mockDataProtector.core.grantAccess.mockResolvedValue({
                txHash: '0xtxhash123',
            });

            // Purchase strategy
            await service.purchaseStrategy(mockStrategy, mockUserAddress);

            // Mock ownership verification
            mockDataProtector.core.getProtectedData.mockResolvedValue([
                {
                    address: mockProtectedDataAddress,
                    name: `Strategy: ${mockStrategy.name}`,
                    creationTimestamp: Date.now(),
                },
            ]);

            // Verify access is now granted
            await expect(
                service.verifyStrategyAccess(mockStrategy.id, mockUserAddress)
            ).resolves.not.toThrow();
        });
    });

    describe('Error Scenarios', () => {
        it('should handle network errors during purchase', async () => {
            // Mock network error
            mockDataProtector.core.protectData.mockRejectedValue(
                new Error('Network request failed')
            );

            const result = await service.purchaseStrategy(mockStrategy, mockUserAddress);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should handle invalid strategy data', async () => {
            // Mock strategy with invalid serialize method
            const invalidStrategy = {
                ...mockStrategy,
                serialize: vi.fn().mockImplementation(() => {
                    throw new Error('Serialization failed');
                }),
            };

            const result = await service.purchaseStrategy(
                invalidStrategy,
                mockUserAddress
            );

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should handle protectData returning invalid response', async () => {
            // Mock protectData with missing address
            mockDataProtector.core.protectData.mockResolvedValue({
                // Missing address field
            });

            const result = await service.purchaseStrategy(mockStrategy, mockUserAddress);

            // Should fail when trying to grant access with undefined address
            expect(result.success).toBe(false);
        });

        it('should handle concurrent purchase attempts gracefully', async () => {
            // Mock responses
            mockDataProtector.core.protectData.mockResolvedValue({
                address: mockProtectedDataAddress,
            });
            mockDataProtector.core.grantAccess.mockResolvedValue({
                txHash: '0xtxhash123',
            });

            // Attempt concurrent purchases
            const purchase1 = service.purchaseStrategy(mockStrategy, mockUserAddress);
            const purchase2 = service.purchaseStrategy(mockStrategy, mockUserAddress);

            const [result1, result2] = await Promise.all([purchase1, purchase2]);

            // Both should complete (Data Protector handles deduplication)
            expect(result1.success).toBe(true);
            expect(result2.success).toBe(true);
        });

        it('should fail gracefully when service is not initialized', async () => {
            // Create uninitialized service
            const uninitializedService = new StrategyDataProtectorService({
                appAddress: mockAppAddress,
            });

            // Attempt purchase without initialization
            await expect(
                uninitializedService.purchaseStrategy(mockStrategy, mockUserAddress)
            ).rejects.toThrow('not initialized');
        });

        it('should handle missing TEE app address configuration', async () => {
            // Create service without app address
            const serviceWithoutApp = new StrategyDataProtectorService({
                appAddress: '',
            });

            // Initialization should fail
            await expect(
                serviceWithoutApp.initialize(mockWalletProvider)
            ).rejects.toThrow('TEE app address not configured');
        });
    });
});

describe('StrategyDataProtectorService - Strategy Purchase', () => {
    let service: StrategyDataProtectorService;
    let mockWalletProvider: any;
    let mockDataProtector: any;

    const mockUserAddress = '0x1234567890123456789012345678901234567890';
    const mockProtectedDataAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
    const mockAppAddress = '0x9999999999999999999999999999999999999999';

    // Mock strategy with serialize method
    const mockStrategy = {
        id: 'btc-delta-neutral',
        name: 'BTC Delta Neutral',
        description: 'Funding rate arbitrage strategy',
        risk: 'medium',
        apr: { min: 5, max: 15 },
        price: '10',
        serialize: vi.fn().mockReturnValue(JSON.stringify({
            operations: [
                { type: 'check_funding_rate', order: 1, params: {} },
                { type: 'open_perpetual_short', order: 2, params: {} },
                { type: 'spot_buy', order: 3, params: {} },
            ],
        })),
    };

    beforeEach(async () => {
        // Create service instance with mock app address
        service = new StrategyDataProtectorService({
            appAddress: mockAppAddress,
        });

        // Mock wallet provider
        mockWalletProvider = {
            request: vi.fn(),
        };

        // Initialize service
        await service.initialize(mockWalletProvider);

        // Get mock data protector instance
        mockDataProtector = (service as any).dataProtector;
    });

    describe('purchaseStrategy', () => {
        it('should successfully purchase a strategy', async () => {
            // Mock protectData response
            mockDataProtector.core.protectData.mockResolvedValue({
                address: mockProtectedDataAddress,
            });

            // Mock grantAccess response
            mockDataProtector.core.grantAccess.mockResolvedValue({
                txHash: '0xtxhash123',
            });

            const result = await service.purchaseStrategy(mockStrategy, mockUserAddress);

            // Verify purchase succeeded
            expect(result.success).toBe(true);
            expect(result.protectedDataAddress).toBe(mockProtectedDataAddress);

            // Verify protectData was called with correct parameters
            expect(mockDataProtector.core.protectData).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    strategyId: mockStrategy.id,
                    strategyName: mockStrategy.name,
                    metadata: expect.objectContaining({
                        id: mockStrategy.id,
                        name: mockStrategy.name,
                    }),
                    operations: expect.any(String),
                }),
                name: `Strategy: ${mockStrategy.name}`,
            });

            // Verify grantAccess was called with correct parameters
            expect(mockDataProtector.core.grantAccess).toHaveBeenCalledWith({
                protectedData: mockProtectedDataAddress,
                authorizedApp: mockAppAddress,
                authorizedUser: mockUserAddress,
                numberOfAccess: undefined,
            });

            // Verify strategy was serialized
            expect(mockStrategy.serialize).toHaveBeenCalled();
        });

        it('should grant access to both buyer and TEE app', async () => {
            // Mock responses
            mockDataProtector.core.protectData.mockResolvedValue({
                address: mockProtectedDataAddress,
            });
            mockDataProtector.core.grantAccess.mockResolvedValue({
                txHash: '0xtxhash123',
            });

            await service.purchaseStrategy(mockStrategy, mockUserAddress);

            // Verify grantAccess includes both buyer and TEE app
            const grantCall = mockDataProtector.core.grantAccess.mock.calls[0][0];
            expect(grantCall.authorizedUser).toBe(mockUserAddress);
            expect(grantCall.authorizedApp).toBe(mockAppAddress);
        });

        it('should handle insufficient funds error', async () => {
            // Mock protectData to throw insufficient funds error
            mockDataProtector.core.protectData.mockRejectedValue(
                new Error('insufficient funds for gas')
            );

            const result = await service.purchaseStrategy(mockStrategy, mockUserAddress);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Insufficient RLC balance');
        });

        it('should handle user rejection error', async () => {
            // Mock protectData to throw user rejection error
            mockDataProtector.core.protectData.mockRejectedValue(
                new Error('user rejected transaction')
            );

            const result = await service.purchaseStrategy(mockStrategy, mockUserAddress);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Transaction rejected by user');
        });

        it('should handle generic purchase errors', async () => {
            // Mock protectData to throw generic error
            mockDataProtector.core.protectData.mockRejectedValue(
                new Error('Network error')
            );

            const result = await service.purchaseStrategy(mockStrategy, mockUserAddress);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.protectedDataAddress).toBeUndefined();
        });

        it('should handle grantAccess failure', async () => {
            // Mock protectData success but grantAccess failure
            mockDataProtector.core.protectData.mockResolvedValue({
                address: mockProtectedDataAddress,
            });
            mockDataProtector.core.grantAccess.mockRejectedValue(
                new Error('Grant access failed')
            );

            const result = await service.purchaseStrategy(mockStrategy, mockUserAddress);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should protect strategy data with correct structure', async () => {
            // Mock responses
            mockDataProtector.core.protectData.mockResolvedValue({
                address: mockProtectedDataAddress,
            });
            mockDataProtector.core.grantAccess.mockResolvedValue({
                txHash: '0xtxhash123',
            });

            await service.purchaseStrategy(mockStrategy, mockUserAddress);

            // Verify data structure passed to protectData
            const protectCall = mockDataProtector.core.protectData.mock.calls[0][0];
            expect(protectCall.data).toHaveProperty('strategyId');
            expect(protectCall.data).toHaveProperty('strategyName');
            expect(protectCall.data).toHaveProperty('metadata');
            expect(protectCall.data).toHaveProperty('operations');
            expect(protectCall.data.metadata).toHaveProperty('id');
            expect(protectCall.data.metadata).toHaveProperty('name');
            expect(protectCall.data.metadata).toHaveProperty('description');
            expect(protectCall.data.metadata).toHaveProperty('risk');
            expect(protectCall.data.metadata).toHaveProperty('aprMin');
            expect(protectCall.data.metadata).toHaveProperty('aprMax');
            expect(protectCall.data.metadata).toHaveProperty('price');
        });

        it('should include serialized operations in protected data', async () => {
            // Mock responses
            mockDataProtector.core.protectData.mockResolvedValue({
                address: mockProtectedDataAddress,
            });
            mockDataProtector.core.grantAccess.mockResolvedValue({
                txHash: '0xtxhash123',
            });

            const serializedOps = JSON.stringify({ operations: [] });
            mockStrategy.serialize.mockReturnValue(serializedOps);

            await service.purchaseStrategy(mockStrategy, mockUserAddress);

            // Verify serialized operations are included
            const protectCall = mockDataProtector.core.protectData.mock.calls[0][0];
            expect(protectCall.data.operations).toBe(serializedOps);
        });

        it('should respect maxAccessCount configuration', async () => {
            // Create service with limited access count
            const limitedService = new StrategyDataProtectorService({
                appAddress: mockAppAddress,
                maxAccessCount: 5,
            });
            await limitedService.initialize(mockWalletProvider);
            const limitedMockDataProtector = (limitedService as any).dataProtector;

            // Mock responses
            limitedMockDataProtector.core.protectData.mockResolvedValue({
                address: mockProtectedDataAddress,
            });
            limitedMockDataProtector.core.grantAccess.mockResolvedValue({
                txHash: '0xtxhash123',
            });

            await limitedService.purchaseStrategy(mockStrategy, mockUserAddress);

            // Verify numberOfAccess is set
            const grantCall = limitedMockDataProtector.core.grantAccess.mock.calls[0][0];
            expect(grantCall.numberOfAccess).toBe(5);
        });
    });

    describe('Purchase Flow Integration', () => {
        it('should complete full purchase flow from start to finish', async () => {
            // Mock all required calls
            mockDataProtector.core.protectData.mockResolvedValue({
                address: mockProtectedDataAddress,
            });
            mockDataProtector.core.grantAccess.mockResolvedValue({
                txHash: '0xtxhash123',
            });

            // Step 1: Purchase strategy
            const purchaseResult = await service.purchaseStrategy(
                mockStrategy,
                mockUserAddress
            );
            expect(purchaseResult.success).toBe(true);
            expect(purchaseResult.protectedDataAddress).toBe(mockProtectedDataAddress);

            // Step 2: Verify ownership after purchase
            mockDataProtector.core.getProtectedData.mockResolvedValue([
                {
                    address: mockProtectedDataAddress,
                    name: `Strategy: ${mockStrategy.name}`,
                    creationTimestamp: Date.now(),
                },
            ]);

            const ownership = await service.checkStrategyOwnership(
                mockStrategy.id,
                mockUserAddress
            );
            expect(ownership.isOwner).toBe(true);

            // Step 3: Verify access is granted
            await expect(
                service.verifyStrategyAccess(mockStrategy.id, mockUserAddress)
            ).resolves.not.toThrow();
        });

        it('should prevent execution before purchase', async () => {
            // User has not purchased strategy yet
            mockDataProtector.core.getProtectedData.mockResolvedValue([]);

            // Verify ownership check fails
            const ownership = await service.checkStrategyOwnership(
                mockStrategy.id,
                mockUserAddress
            );
            expect(ownership.isOwner).toBe(false);

            // Verify access is denied
            await expect(
                service.verifyStrategyAccess(mockStrategy.id, mockUserAddress)
            ).rejects.toThrow('Access denied');
        });

        it('should allow execution after successful purchase', async () => {
            // Mock successful purchase
            mockDataProtector.core.protectData.mockResolvedValue({
                address: mockProtectedDataAddress,
            });
            mockDataProtector.core.grantAccess.mockResolvedValue({
                txHash: '0xtxhash123',
            });

            // Purchase strategy
            await service.purchaseStrategy(mockStrategy, mockUserAddress);

            // Mock ownership verification
            mockDataProtector.core.getProtectedData.mockResolvedValue([
                {
                    address: mockProtectedDataAddress,
                    name: `Strategy: ${mockStrategy.name}`,
                    creationTimestamp: Date.now(),
                },
            ]);

            // Verify access is now granted
            await expect(
                service.verifyStrategyAccess(mockStrategy.id, mockUserAddress)
            ).resolves.not.toThrow();
        });
    });

    describe('Error Scenarios', () => {
        it('should handle network errors during purchase', async () => {
            // Mock network error
            mockDataProtector.core.protectData.mockRejectedValue(
                new Error('Network request failed')
            );

            const result = await service.purchaseStrategy(mockStrategy, mockUserAddress);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should handle invalid strategy data', async () => {
            // Mock strategy with invalid serialize method
            const invalidStrategy = {
                ...mockStrategy,
                serialize: vi.fn().mockImplementation(() => {
                    throw new Error('Serialization failed');
                }),
            };

            const result = await service.purchaseStrategy(
                invalidStrategy,
                mockUserAddress
            );

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should handle protectData returning invalid response', async () => {
            // Mock protectData with missing address
            mockDataProtector.core.protectData.mockResolvedValue({
                // Missing address field
            });

            const result = await service.purchaseStrategy(mockStrategy, mockUserAddress);

            // Should fail when trying to grant access with undefined address
            expect(result.success).toBe(false);
        });

        it('should handle concurrent purchase attempts gracefully', async () => {
            // Mock responses
            mockDataProtector.core.protectData.mockResolvedValue({
                address: mockProtectedDataAddress,
            });
            mockDataProtector.core.grantAccess.mockResolvedValue({
                txHash: '0xtxhash123',
            });

            // Attempt concurrent purchases
            const purchase1 = service.purchaseStrategy(mockStrategy, mockUserAddress);
            const purchase2 = service.purchaseStrategy(mockStrategy, mockUserAddress);

            const [result1, result2] = await Promise.all([purchase1, purchase2]);

            // Both should complete (Data Protector handles deduplication)
            expect(result1.success).toBe(true);
            expect(result2.success).toBe(true);
        });

        it('should fail gracefully when service is not initialized', async () => {
            // Create uninitialized service
            const uninitializedService = new StrategyDataProtectorService({
                appAddress: mockAppAddress,
            });

            // Attempt purchase without initialization
            await expect(
                uninitializedService.purchaseStrategy(mockStrategy, mockUserAddress)
            ).rejects.toThrow('not initialized');
        });

        it('should handle missing TEE app address configuration', async () => {
            // Create service without app address
            const serviceWithoutApp = new StrategyDataProtectorService({
                appAddress: '',
            });

            // Initialization should fail
            await expect(
                serviceWithoutApp.initialize(mockWalletProvider)
            ).rejects.toThrow('TEE app address not configured');
        });
    });
});
