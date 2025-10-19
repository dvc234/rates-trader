import { describe, it, expect, vi } from 'vitest';
import { CheckFundingRateOperation } from '../CheckFundingRateOperation';
import { OperationType } from '../OperationTypes';
import { ExecutionContext, DexService } from '../../executor/ExecutionContext';

describe('CheckFundingRateOperation', () => {
  describe('constructor', () => {
    it('should create instance with required parameters', () => {
      const op = new CheckFundingRateOperation(1, 'BTC/USD', 0.01);
      
      expect(op.type).toBe(OperationType.CHECK_FUNDING_RATE);
      expect(op.order).toBe(1);
    });
    
    it('should create instance with custom gas cost', () => {
      const op = new CheckFundingRateOperation(1, 'BTC/USD', 0.01, '100');
      
      expect(op.type).toBe(OperationType.CHECK_FUNDING_RATE);
      expect(op.order).toBe(1);
    });
  });
  
  describe('validate', () => {
    it('should validate correct parameters', () => {
      const op = new CheckFundingRateOperation(1, 'BTC/USD', 0.01, '50');
      
      const result = op.validate();
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject empty trading pair', () => {
      const op = new CheckFundingRateOperation(1, '', 0.01, '50');
      
      const result = op.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Trading pair is required and cannot be empty');
    });
    
    it('should reject negative minimum profitable rate', () => {
      const op = new CheckFundingRateOperation(1, 'BTC/USD', -0.01, '50');
      
      const result = op.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Minimum profitable rate must be non-negative');
    });
    
    it('should reject unreasonably high minimum profitable rate', () => {
      const op = new CheckFundingRateOperation(1, 'BTC/USD', 1.5, '50');
      
      const result = op.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Minimum profitable rate seems unreasonably high (>100%)');
    });
    
    it('should reject negative gas cost', () => {
      const op = new CheckFundingRateOperation(1, 'BTC/USD', 0.01, '-10');
      
      const result = op.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Estimated gas cost must be a valid non-negative number');
    });
    
    it('should reject invalid gas cost', () => {
      const op = new CheckFundingRateOperation(1, 'BTC/USD', 0.01, 'invalid');
      
      const result = op.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Estimated gas cost must be a valid non-negative number');
    });
  });
  
  describe('execute', () => {
    it('should execute successfully when funding rate is profitable', async () => {
      // Mock DexService
      const mockDexService: DexService = {
        getFundingRate: vi.fn().mockResolvedValue(0.015) // 1.5% funding rate
      };
      
      // Mock ExecutionContext
      const mockContext = {
        config: {
          capitalAllocation: '10000',
          slippageTolerance: 0.5,
          executionMode: 'instant' as const
        },
        state: new Map(),
        getDexService: () => mockDexService
      } as ExecutionContext;
      
      const op = new CheckFundingRateOperation(1, 'BTC/USD', 0.01, '50');
      const result = await op.execute(mockContext);
      
      expect(result.success).toBe(true);
      expect(result.operationType).toBe(OperationType.CHECK_FUNDING_RATE);
      expect(result.data?.fundingRate).toBe(0.015);
      expect(result.data?.isProfitable).toBe(true);
      
      // Verify state was updated
      expect(mockContext.state.get('fundingRate')).toBe(0.015);
      expect(mockContext.state.get('isProfitable')).toBe(true);
      expect(mockContext.state.get('profitabilityDetails')).toBeDefined();
    });
    
    it('should mark as unprofitable when funding rate is below threshold', async () => {
      const mockDexService: DexService = {
        getFundingRate: vi.fn().mockResolvedValue(0.005) // 0.5% funding rate
      };
      
      const mockContext = {
        config: {
          capitalAllocation: '10000',
          slippageTolerance: 0.5,
          executionMode: 'instant' as const
        },
        state: new Map(),
        getDexService: () => mockDexService
      } as ExecutionContext;
      
      const op = new CheckFundingRateOperation(1, 'BTC/USD', 0.01, '50'); // Requires 1%
      const result = await op.execute(mockContext);
      
      expect(result.success).toBe(true);
      expect(result.data?.isProfitable).toBe(false);
      expect(mockContext.state.get('isProfitable')).toBe(false);
    });
    
    it('should mark as unprofitable when expected profit is negative', async () => {
      const mockDexService: DexService = {
        getFundingRate: vi.fn().mockResolvedValue(0.01) // 1% funding rate
      };
      
      const mockContext = {
        config: {
          capitalAllocation: '1000', // Small capital
          slippageTolerance: 0.5,
          executionMode: 'instant' as const
        },
        state: new Map(),
        getDexService: () => mockDexService
      } as ExecutionContext;
      
      // With $1000 capital and 1% rate = $10 income
      // But gas costs are $50, so net profit is negative
      const op = new CheckFundingRateOperation(1, 'BTC/USD', 0.01, '50');
      const result = await op.execute(mockContext);
      
      expect(result.success).toBe(true);
      expect(result.data?.isProfitable).toBe(false);
      expect(result.data?.expectedProfit).toBeLessThan(0);
    });
    
    it('should include profitability breakdown in result', async () => {
      const mockDexService: DexService = {
        getFundingRate: vi.fn().mockResolvedValue(0.02) // 2% funding rate
      };
      
      const mockContext = {
        config: {
          capitalAllocation: '10000',
          slippageTolerance: 0.5,
          executionMode: 'instant' as const
        },
        state: new Map(),
        getDexService: () => mockDexService
      } as ExecutionContext;
      
      const op = new CheckFundingRateOperation(1, 'BTC/USD', 0.01, '50');
      const result = await op.execute(mockContext);
      
      expect(result.data?.breakdown).toBeDefined();
      expect(result.data?.breakdown.fundingIncome).toBe(200); // 2% of 10000
      expect(result.data?.breakdown.gasCosts).toBe(50);
      expect(result.data?.breakdown.tradingFees).toBe(10); // 0.1% of 10000
      expect(result.data?.expectedProfit).toBe(140); // 200 - 50 - 10
    });
    
    it('should handle errors gracefully', async () => {
      const mockDexService: DexService = {
        getFundingRate: vi.fn().mockRejectedValue(new Error('Network error'))
      };
      
      const mockContext = {
        config: {
          capitalAllocation: '10000',
          slippageTolerance: 0.5,
          executionMode: 'instant' as const
        },
        state: new Map(),
        getDexService: () => mockDexService
      } as ExecutionContext;
      
      const op = new CheckFundingRateOperation(1, 'BTC/USD', 0.01, '50');
      const result = await op.execute(mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('FUNDING_RATE_CHECK_FAILED');
      expect(result.error?.recoverable).toBe(true);
    });
  });
  
  describe('profitability calculations', () => {
    describe('with various capital allocations', () => {
      it('should calculate correct profit for large capital allocation', async () => {
        const mockDexService: DexService = {
          getFundingRate: vi.fn().mockResolvedValue(0.02) // 2% funding rate
        };
        
        const mockContext = {
          config: {
            capitalAllocation: '100000', // $100k capital
            slippageTolerance: 0.5,
            executionMode: 'instant' as const
          },
          state: new Map(),
          getDexService: () => mockDexService
        } as ExecutionContext;
        
        const op = new CheckFundingRateOperation(1, 'BTC/USD', 0.01, '50');
        const result = await op.execute(mockContext);
        
        expect(result.success).toBe(true);
        expect(result.data?.isProfitable).toBe(true);
        // Funding income: 0.02 * 100000 = 2000
        // Gas costs: 50
        // Trading fees: 0.001 * 100000 = 100
        // Expected profit: 2000 - 50 - 100 = 1850
        expect(result.data?.expectedProfit).toBe(1850);
        expect(result.data?.breakdown.fundingIncome).toBe(2000);
        expect(result.data?.breakdown.gasCosts).toBe(50);
        expect(result.data?.breakdown.tradingFees).toBe(100);
      });
      
      it('should calculate correct profit for small capital allocation', async () => {
        const mockDexService: DexService = {
          getFundingRate: vi.fn().mockResolvedValue(0.05) // 5% funding rate (very high)
        };
        
        const mockContext = {
          config: {
            capitalAllocation: '2000', // $2k capital
            slippageTolerance: 0.5,
            executionMode: 'instant' as const
          },
          state: new Map(),
          getDexService: () => mockDexService
        } as ExecutionContext;
        
        const op = new CheckFundingRateOperation(1, 'BTC/USD', 0.01, '50');
        const result = await op.execute(mockContext);
        
        expect(result.success).toBe(true);
        // Funding income: 0.05 * 2000 = 100
        // Gas costs: 50
        // Trading fees: 0.001 * 2000 = 2
        // Expected profit: 100 - 50 - 2 = 48
        expect(result.data?.expectedProfit).toBe(48);
        expect(result.data?.isProfitable).toBe(true);
      });
      
      it('should mark as unprofitable when capital is too small for gas costs', async () => {
        const mockDexService: DexService = {
          getFundingRate: vi.fn().mockResolvedValue(0.02) // 2% funding rate
        };
        
        const mockContext = {
          config: {
            capitalAllocation: '500', // Only $500 capital
            slippageTolerance: 0.5,
            executionMode: 'instant' as const
          },
          state: new Map(),
          getDexService: () => mockDexService
        } as ExecutionContext;
        
        const op = new CheckFundingRateOperation(1, 'BTC/USD', 0.01, '50');
        const result = await op.execute(mockContext);
        
        expect(result.success).toBe(true);
        // Funding income: 0.02 * 500 = 10
        // Gas costs: 50
        // Trading fees: 0.001 * 500 = 0.5
        // Expected profit: 10 - 50 - 0.5 = -40.5 (negative!)
        expect(result.data?.expectedProfit).toBe(-40.5);
        expect(result.data?.isProfitable).toBe(false);
      });
    });
    
    describe('with various funding rates', () => {
      it('should calculate profit correctly with very low funding rate', async () => {
        const mockDexService: DexService = {
          getFundingRate: vi.fn().mockResolvedValue(0.001) // 0.1% funding rate
        };
        
        const mockContext = {
          config: {
            capitalAllocation: '50000',
            slippageTolerance: 0.5,
            executionMode: 'instant' as const
          },
          state: new Map(),
          getDexService: () => mockDexService
        } as ExecutionContext;
        
        const op = new CheckFundingRateOperation(1, 'BTC/USD', 0.005, '50');
        const result = await op.execute(mockContext);
        
        expect(result.success).toBe(true);
        // Funding income: 0.001 * 50000 = 50
        // Gas costs: 50
        // Trading fees: 0.001 * 50000 = 50
        // Expected profit: 50 - 50 - 50 = -50 (negative!)
        expect(result.data?.expectedProfit).toBe(-50);
        expect(result.data?.isProfitable).toBe(false); // Below threshold and negative profit
      });
      
      it('should calculate profit correctly with moderate funding rate', async () => {
        const mockDexService: DexService = {
          getFundingRate: vi.fn().mockResolvedValue(0.015) // 1.5% funding rate
        };
        
        const mockContext = {
          config: {
            capitalAllocation: '20000',
            slippageTolerance: 0.5,
            executionMode: 'instant' as const
          },
          state: new Map(),
          getDexService: () => mockDexService
        } as ExecutionContext;
        
        const op = new CheckFundingRateOperation(1, 'BTC/USD', 0.01, '50');
        const result = await op.execute(mockContext);
        
        expect(result.success).toBe(true);
        // Funding income: 0.015 * 20000 = 300
        // Gas costs: 50
        // Trading fees: 0.001 * 20000 = 20
        // Expected profit: 300 - 50 - 20 = 230
        expect(result.data?.expectedProfit).toBe(230);
        expect(result.data?.isProfitable).toBe(true);
      });
      
      it('should calculate profit correctly with high funding rate', async () => {
        const mockDexService: DexService = {
          getFundingRate: vi.fn().mockResolvedValue(0.1) // 10% funding rate (extremely high)
        };
        
        const mockContext = {
          config: {
            capitalAllocation: '10000',
            slippageTolerance: 0.5,
            executionMode: 'instant' as const
          },
          state: new Map(),
          getDexService: () => mockDexService
        } as ExecutionContext;
        
        const op = new CheckFundingRateOperation(1, 'BTC/USD', 0.01, '50');
        const result = await op.execute(mockContext);
        
        expect(result.success).toBe(true);
        // Funding income: 0.1 * 10000 = 1000
        // Gas costs: 50
        // Trading fees: 0.001 * 10000 = 10
        // Expected profit: 1000 - 50 - 10 = 940
        expect(result.data?.expectedProfit).toBe(940);
        expect(result.data?.isProfitable).toBe(true);
      });
      
      it('should handle zero funding rate', async () => {
        const mockDexService: DexService = {
          getFundingRate: vi.fn().mockResolvedValue(0) // 0% funding rate
        };
        
        const mockContext = {
          config: {
            capitalAllocation: '10000',
            slippageTolerance: 0.5,
            executionMode: 'instant' as const
          },
          state: new Map(),
          getDexService: () => mockDexService
        } as ExecutionContext;
        
        const op = new CheckFundingRateOperation(1, 'BTC/USD', 0.01, '50');
        const result = await op.execute(mockContext);
        
        expect(result.success).toBe(true);
        // Funding income: 0 * 10000 = 0
        // Gas costs: 50
        // Trading fees: 0.001 * 10000 = 10
        // Expected profit: 0 - 50 - 10 = -60
        expect(result.data?.expectedProfit).toBe(-60);
        expect(result.data?.isProfitable).toBe(false);
      });
    });
    
    describe('with various gas costs', () => {
      it('should calculate profit correctly with low gas costs', async () => {
        const mockDexService: DexService = {
          getFundingRate: vi.fn().mockResolvedValue(0.02) // 2% funding rate
        };
        
        const mockContext = {
          config: {
            capitalAllocation: '10000',
            slippageTolerance: 0.5,
            executionMode: 'instant' as const
          },
          state: new Map(),
          getDexService: () => mockDexService
        } as ExecutionContext;
        
        const op = new CheckFundingRateOperation(1, 'BTC/USD', 0.01, '10'); // Low gas cost
        const result = await op.execute(mockContext);
        
        expect(result.success).toBe(true);
        // Funding income: 0.02 * 10000 = 200
        // Gas costs: 10
        // Trading fees: 0.001 * 10000 = 10
        // Expected profit: 200 - 10 - 10 = 180
        expect(result.data?.expectedProfit).toBe(180);
        expect(result.data?.breakdown.gasCosts).toBe(10);
        expect(result.data?.isProfitable).toBe(true);
      });
      
      it('should calculate profit correctly with high gas costs', async () => {
        const mockDexService: DexService = {
          getFundingRate: vi.fn().mockResolvedValue(0.02) // 2% funding rate
        };
        
        const mockContext = {
          config: {
            capitalAllocation: '10000',
            slippageTolerance: 0.5,
            executionMode: 'instant' as const
          },
          state: new Map(),
          getDexService: () => mockDexService
        } as ExecutionContext;
        
        const op = new CheckFundingRateOperation(1, 'BTC/USD', 0.01, '150'); // High gas cost
        const result = await op.execute(mockContext);
        
        expect(result.success).toBe(true);
        // Funding income: 0.02 * 10000 = 200
        // Gas costs: 150
        // Trading fees: 0.001 * 10000 = 10
        // Expected profit: 200 - 150 - 10 = 40
        expect(result.data?.expectedProfit).toBe(40);
        expect(result.data?.breakdown.gasCosts).toBe(150);
        expect(result.data?.isProfitable).toBe(true);
      });
      
      it('should mark as unprofitable when gas costs exceed funding income', async () => {
        const mockDexService: DexService = {
          getFundingRate: vi.fn().mockResolvedValue(0.01) // 1% funding rate
        };
        
        const mockContext = {
          config: {
            capitalAllocation: '10000',
            slippageTolerance: 0.5,
            executionMode: 'instant' as const
          },
          state: new Map(),
          getDexService: () => mockDexService
        } as ExecutionContext;
        
        const op = new CheckFundingRateOperation(1, 'BTC/USD', 0.01, '200'); // Very high gas cost
        const result = await op.execute(mockContext);
        
        expect(result.success).toBe(true);
        // Funding income: 0.01 * 10000 = 100
        // Gas costs: 200
        // Trading fees: 0.001 * 10000 = 10
        // Expected profit: 100 - 200 - 10 = -110 (negative!)
        expect(result.data?.expectedProfit).toBe(-110);
        expect(result.data?.isProfitable).toBe(false);
      });
    });
    
    describe('execution decision logic', () => {
      it('should require both positive profit AND rate above threshold', async () => {
        const mockDexService: DexService = {
          getFundingRate: vi.fn().mockResolvedValue(0.008) // 0.8% - below 1% threshold
        };
        
        const mockContext = {
          config: {
            capitalAllocation: '100000', // Large capital, so profit would be positive
            slippageTolerance: 0.5,
            executionMode: 'instant' as const
          },
          state: new Map(),
          getDexService: () => mockDexService
        } as ExecutionContext;
        
        const op = new CheckFundingRateOperation(1, 'BTC/USD', 0.01, '50'); // Requires 1%
        const result = await op.execute(mockContext);
        
        expect(result.success).toBe(true);
        // Funding income: 0.008 * 100000 = 800
        // Gas costs: 50
        // Trading fees: 0.001 * 100000 = 100
        // Expected profit: 800 - 50 - 100 = 650 (positive!)
        expect(result.data?.expectedProfit).toBe(650);
        // But rate is below threshold, so still not profitable
        expect(result.data?.isProfitable).toBe(false);
      });
      
      it('should mark as unprofitable if rate meets threshold but profit is negative', async () => {
        const mockDexService: DexService = {
          getFundingRate: vi.fn().mockResolvedValue(0.015) // 1.5% - above threshold
        };
        
        const mockContext = {
          config: {
            capitalAllocation: '1000', // Small capital
            slippageTolerance: 0.5,
            executionMode: 'instant' as const
          },
          state: new Map(),
          getDexService: () => mockDexService
        } as ExecutionContext;
        
        const op = new CheckFundingRateOperation(1, 'BTC/USD', 0.01, '50');
        const result = await op.execute(mockContext);
        
        expect(result.success).toBe(true);
        // Funding income: 0.015 * 1000 = 15
        // Gas costs: 50
        // Trading fees: 0.001 * 1000 = 1
        // Expected profit: 15 - 50 - 1 = -36 (negative!)
        expect(result.data?.expectedProfit).toBe(-36);
        // Rate is above threshold but profit is negative
        expect(result.data?.isProfitable).toBe(false);
      });
      
      it('should mark as profitable only when both conditions are met', async () => {
        const mockDexService: DexService = {
          getFundingRate: vi.fn().mockResolvedValue(0.02) // 2% - above threshold
        };
        
        const mockContext = {
          config: {
            capitalAllocation: '10000', // Sufficient capital
            slippageTolerance: 0.5,
            executionMode: 'instant' as const
          },
          state: new Map(),
          getDexService: () => mockDexService
        } as ExecutionContext;
        
        const op = new CheckFundingRateOperation(1, 'BTC/USD', 0.01, '50');
        const result = await op.execute(mockContext);
        
        expect(result.success).toBe(true);
        // Funding income: 0.02 * 10000 = 200
        // Gas costs: 50
        // Trading fees: 0.001 * 10000 = 10
        // Expected profit: 200 - 50 - 10 = 140 (positive!)
        expect(result.data?.expectedProfit).toBe(140);
        // Rate is above threshold AND profit is positive
        expect(result.data?.isProfitable).toBe(true);
      });
      
      it('should handle edge case where profit is exactly zero', async () => {
        const mockDexService: DexService = {
          getFundingRate: vi.fn().mockResolvedValue(0.006) // 0.6% funding rate
        };
        
        const mockContext = {
          config: {
            capitalAllocation: '10000',
            slippageTolerance: 0.5,
            executionMode: 'instant' as const
          },
          state: new Map(),
          getDexService: () => mockDexService
        } as ExecutionContext;
        
        // Set gas cost to make profit exactly zero
        // Funding income: 0.006 * 10000 = 60
        // Trading fees: 0.001 * 10000 = 10
        // Gas costs needed for zero profit: 60 - 10 = 50
        const op = new CheckFundingRateOperation(1, 'BTC/USD', 0.005, '50');
        const result = await op.execute(mockContext);
        
        expect(result.success).toBe(true);
        expect(result.data?.expectedProfit).toBe(0);
        // Zero profit is not considered profitable (must be > 0)
        expect(result.data?.isProfitable).toBe(false);
      });
    });
    
    describe('trading fee calculations', () => {
      it('should calculate trading fees as 0.1% of capital', async () => {
        const mockDexService: DexService = {
          getFundingRate: vi.fn().mockResolvedValue(0.02)
        };
        
        const testCases = [
          { capital: '1000', expectedFee: 1 },
          { capital: '5000', expectedFee: 5 },
          { capital: '10000', expectedFee: 10 },
          { capital: '50000', expectedFee: 50 },
          { capital: '100000', expectedFee: 100 }
        ];
        
        for (const testCase of testCases) {
          const mockContext = {
            config: {
              capitalAllocation: testCase.capital,
              slippageTolerance: 0.5,
              executionMode: 'instant' as const
            },
            state: new Map(),
            getDexService: () => mockDexService
          } as ExecutionContext;
          
          const op = new CheckFundingRateOperation(1, 'BTC/USD', 0.01, '50');
          const result = await op.execute(mockContext);
          
          expect(result.data?.breakdown.tradingFees).toBe(testCase.expectedFee);
        }
      });
    });
  });
});
