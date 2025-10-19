/**
 * StrategyConfigForm Component
 * 
 * Form component for configuring strategy execution parameters.
 * Provides inputs for spread percentage, slippage tolerance, and execution mode.
 * Includes real-time validation with error messages.
 * 
 * Features:
 * - Execution mode selector (instant vs optimized)
 * - Spread percentage input (disabled for instant mode)
 * - Slippage tolerance input
 * - Capital allocation input with validation
 * - Estimated gas costs display
 * - Optional current funding rates display
 * - Real-time validation
 * - Error message display
 * 
 * @component
 */

'use client';

import { useState, useEffect } from 'react';
import type { StrategyConfig, ExecutionMode } from '@/types/strategy';

/**
 * Props for the StrategyConfigForm component
 */
interface StrategyConfigFormProps {
  /** Current configuration values */
  config: StrategyConfig;
  /** Callback when configuration changes */
  onChange: (config: StrategyConfig) => void;
  /** Whether the form is disabled (e.g., during execution) */
  disabled?: boolean;
  /** Strategy ID for fetching funding rates (optional) */
  strategyId?: string;
  /** Whether to show funding rates (optional, default: false) */
  showFundingRates?: boolean;
}

/**
 * Validation errors for form fields
 */
interface ValidationErrors {
  spreadPercentage?: string;
  slippageTolerance?: string;
  capitalAllocation?: string;
}

/**
 * Gas cost estimates for strategy execution
 * These are rough estimates based on typical operation costs
 */
interface GasEstimates {
  /** Estimated gas cost in USD */
  estimatedCostUSD: string;
  /** Estimated gas units */
  estimatedGasUnits: string;
  /** Current gas price in Gwei */
  gasPriceGwei: string;
}

/**
 * Funding rate data for perpetual positions
 */
interface FundingRateData {
  /** Current funding rate as percentage */
  rate: number;
  /** Whether the rate is positive (longs pay shorts) or negative (shorts pay longs) */
  isPositive: boolean;
  /** Last updated timestamp */
  lastUpdated: number;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Error message if fetch failed */
  error?: string;
}

/**
 * StrategyConfigForm provides a user interface for configuring strategy execution parameters
 * 
 * Form Validation Logic:
 * - Spread percentage: 0-100, only required for optimized mode
 * - Slippage tolerance: 0-100, always required
 * - Capital allocation: positive number, optional
 * - Execution mode: instant or optimized
 * 
 * Conditional Field Enabling:
 * - Spread percentage is disabled when execution mode is 'instant'
 * - This is because instant execution uses market orders (no spread)
 * - Optimized execution uses limit orders with configured spread
 */
export default function StrategyConfigForm({
  config,
  onChange,
  disabled = false,
  strategyId,
  showFundingRates = false
}: StrategyConfigFormProps) {
  // Local state for validation errors
  const [errors, setErrors] = useState<ValidationErrors>({});
  
  // State for gas cost estimates
  const [gasEstimates, setGasEstimates] = useState<GasEstimates>({
    estimatedCostUSD: '0.00',
    estimatedGasUnits: '0',
    gasPriceGwei: '0'
  });
  
  // State for funding rate data (optional feature)
  const [fundingRate, setFundingRate] = useState<FundingRateData>({
    rate: 0,
    isPositive: true,
    lastUpdated: Date.now(),
    isLoading: false
  });

  /**
   * Estimate gas costs for strategy execution
   * 
   * Gas Cost Calculation:
   * - Base cost: ~200,000 gas for typical strategy execution
   * - Per operation: ~100,000 gas per operation (spot buy, perpetual short)
   * - Typical strategy: 2-3 operations = ~400,000 gas total
   * - Gas price: Fetched from Base network or estimated at 0.001 Gwei
   * - ETH price: Estimated at $3000 for USD conversion
   * 
   * Note: These are rough estimates. Actual costs vary based on:
   * - Network congestion
   * - Operation complexity
   * - DEX liquidity
   * - Number of operations in strategy
   */
  const estimateGasCosts = async () => {
    try {
      // Estimate gas units for typical strategy execution
      // Base cost: 200k gas for TEE initialization and setup
      // Per operation: 100k gas (spot buy, perpetual short, etc.)
      // Typical funding rate strategy: 3 operations (check rate, open short, spot buy)
      const baseGas = 200000;
      const operationGas = 100000;
      const operationCount = 3; // Typical for funding rate strategy
      const estimatedGasUnits = baseGas + (operationGas * operationCount);
      
      // Estimate gas price on Base network
      // Base typically has very low gas prices (~0.001 Gwei)
      // For estimation, we use a conservative 0.01 Gwei
      const gasPriceGwei = 0.01;
      
      // Calculate gas cost in ETH
      // 1 Gwei = 10^-9 ETH
      const gasCostETH = (estimatedGasUnits * gasPriceGwei) / 1e9;
      
      // Convert to USD (estimate ETH at $3000)
      const ethPriceUSD = 3000;
      const gasCostUSD = gasCostETH * ethPriceUSD;
      
      setGasEstimates({
        estimatedCostUSD: gasCostUSD.toFixed(2),
        estimatedGasUnits: estimatedGasUnits.toString(),
        gasPriceGwei: gasPriceGwei.toFixed(4)
      });
    } catch (error) {
      console.error('Failed to estimate gas costs:', error);
      // Set default estimates on error
      setGasEstimates({
        estimatedCostUSD: '0.12',
        estimatedGasUnits: '500000',
        gasPriceGwei: '0.01'
      });
    }
  };
  
  /**
   * Fetch current funding rates for perpetual positions
   * 
   * This is an optional feature that displays current market conditions.
   * Only fetches if showFundingRates prop is true.
   * 
   * Note: In production, this would call the perpetual DEX API.
   * For MVP, we return mock data for demonstration.
   */
  const fetchFundingRates = async () => {
    if (!showFundingRates || !strategyId) {
      return;
    }
    
    setFundingRate(prev => ({ ...prev, isLoading: true, error: undefined }));
    
    try {
      // TODO: In production, fetch from perpetual DEX API
      // Example: Avantis, GMX, Synthetix, dYdX
      // const response = await fetch(`/api/funding-rates/${strategyId}`);
      // const data = await response.json();
      
      // Mock data for demonstration
      // Positive rate means longs pay shorts (favorable for short positions)
      const mockRate = 0.0123; // 0.0123% per 8 hours
      
      setFundingRate({
        rate: mockRate,
        isPositive: mockRate > 0,
        lastUpdated: Date.now(),
        isLoading: false
      });
    } catch (error) {
      console.error('Failed to fetch funding rates:', error);
      setFundingRate(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to fetch current funding rates'
      }));
    }
  };
  
  /**
   * Validate form fields and update error state
   * 
   * Validation Rules:
   * - Spread percentage: 0-100 (only for optimized mode)
   * - Slippage tolerance: 0-100 (required)
   * - Capital allocation: positive number (optional but recommended)
   *   - Minimum: $10 to cover gas costs
   *   - Maximum: No hard limit, but warn if very large
   */
  const validateField = (field: keyof StrategyConfig, value: any): string | undefined => {
    switch (field) {
      case 'spreadPercentage':
        // Spread percentage only validated for optimized mode
        if (config.executionMode === 'optimized') {
          if (value === undefined || value === null || value === '') {
            return 'Spread percentage is required for optimized execution';
          }
          const num = Number(value);
          if (isNaN(num) || num < 0 || num > 100) {
            return 'Spread percentage must be between 0 and 100';
          }
        }
        return undefined;

      case 'slippageTolerance':
        if (value === undefined || value === null || value === '') {
          return 'Slippage tolerance is required';
        }
        const slippage = Number(value);
        if (isNaN(slippage) || slippage < 0 || slippage > 100) {
          return 'Slippage tolerance must be between 0 and 100';
        }
        return undefined;

      case 'capitalAllocation':
        // Capital allocation is optional but recommended
        if (value && value !== '') {
          const capital = Number(value);
          
          // Must be a valid positive number
          if (isNaN(capital) || capital <= 0) {
            return 'Capital allocation must be a positive number';
          }
          
          // Minimum capital check: Should be at least $10 to cover gas costs
          // Gas costs on Base are typically $0.10-$0.50, but we recommend $10 minimum
          // to ensure meaningful position sizes after fees
          if (capital < 10) {
            return 'Minimum capital allocation is $10 to cover gas costs and fees';
          }
          
          // Warning for very large amounts (over $100,000)
          // This is not an error, just a sanity check
          if (capital > 100000) {
            // Note: We don't return an error here, just log a warning
            // The user can still proceed with large amounts
            console.warn('Large capital allocation detected:', capital);
          }
        }
        return undefined;

      default:
        return undefined;
    }
  };

  /**
   * Validate all fields and update error state
   */
  const validateAll = (): boolean => {
    const newErrors: ValidationErrors = {};

    // Validate spread percentage (only for optimized mode)
    if (config.executionMode === 'optimized') {
      const spreadError = validateField('spreadPercentage', config.spreadPercentage);
      if (spreadError) newErrors.spreadPercentage = spreadError;
    }

    // Validate slippage tolerance (always required)
    const slippageError = validateField('slippageTolerance', config.slippageTolerance);
    if (slippageError) newErrors.slippageTolerance = slippageError;

    // Validate capital allocation (optional)
    const capitalError = validateField('capitalAllocation', config.capitalAllocation);
    if (capitalError) newErrors.capitalAllocation = capitalError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle execution mode change
   * When switching to instant mode, clear spread percentage
   */
  const handleExecutionModeChange = (mode: ExecutionMode) => {
    const newConfig = {
      ...config,
      executionMode: mode,
      // Clear spread percentage when switching to instant mode
      // Instant mode uses market orders, so spread is not applicable
      spreadPercentage: mode === 'instant' ? undefined : config.spreadPercentage,
    };
    onChange(newConfig);
  };

  /**
   * Handle spread percentage change
   */
  const handleSpreadChange = (value: string) => {
    const newConfig = {
      ...config,
      spreadPercentage: value === '' ? undefined : Number(value),
    };
    onChange(newConfig);

    // Validate field
    const error = validateField('spreadPercentage', value === '' ? undefined : Number(value));
    setErrors(prev => ({ ...prev, spreadPercentage: error }));
  };

  /**
   * Handle slippage tolerance change
   */
  const handleSlippageChange = (value: string) => {
    const newConfig = {
      ...config,
      slippageTolerance: value === '' ? 0 : Number(value),
    };
    onChange(newConfig);

    // Validate field
    const error = validateField('slippageTolerance', value === '' ? 0 : Number(value));
    setErrors(prev => ({ ...prev, slippageTolerance: error }));
  };

  /**
   * Handle capital allocation change
   */
  const handleCapitalChange = (value: string) => {
    const newConfig = {
      ...config,
      capitalAllocation: value === '' ? undefined : value,
    };
    onChange(newConfig);

    // Validate field
    const error = validateField('capitalAllocation', value === '' ? undefined : value);
    setErrors(prev => ({ ...prev, capitalAllocation: error }));
  };

  // Validate on mount and when config changes
  useEffect(() => {
    validateAll();
  }, [config.executionMode]);
  
  // Estimate gas costs on mount and when capital allocation changes
  useEffect(() => {
    estimateGasCosts();
  }, [config.capitalAllocation]);
  
  // Fetch funding rates on mount if enabled
  useEffect(() => {
    if (showFundingRates) {
      fetchFundingRates();
      
      // Refresh funding rates every 5 minutes
      const interval = setInterval(fetchFundingRates, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [showFundingRates, strategyId]);

  return (
    <div className="space-y-6">
      {/* Execution Mode Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Execution Mode
        </label>
        <div className="grid grid-cols-2 gap-3">
          {/* Instant Mode Button */}
          <button
            type="button"
            onClick={() => handleExecutionModeChange('instant')}
            disabled={disabled}
            className={`
              px-4 py-3 rounded-lg border-2 transition-all duration-200
              ${config.executionMode === 'instant'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <div className="font-semibold">Instant</div>
            <div className="text-xs mt-1">Market orders</div>
          </button>

          {/* Optimized Mode Button */}
          <button
            type="button"
            onClick={() => handleExecutionModeChange('optimized')}
            disabled={disabled}
            className={`
              px-4 py-3 rounded-lg border-2 transition-all duration-200
              ${config.executionMode === 'optimized'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <div className="font-semibold">Optimized</div>
            <div className="text-xs mt-1">Limit orders</div>
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {config.executionMode === 'instant'
            ? 'Execute immediately with market orders'
            : 'Use limit orders with configured spread for better pricing'
          }
        </p>
      </div>

      {/* Spread Percentage Input - Disabled for instant mode */}
      <div>
        <label
          htmlFor="spreadPercentage"
          className={`block text-sm font-medium mb-2 ${
            config.executionMode === 'instant' ? 'text-gray-400' : 'text-gray-700'
          }`}
        >
          Spread Percentage
          {config.executionMode === 'instant' && (
            <span className="ml-2 text-xs">(Disabled for instant mode)</span>
          )}
        </label>
        <div className="relative">
          <input
            id="spreadPercentage"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={config.spreadPercentage ?? ''}
            onChange={(e) => handleSpreadChange(e.target.value)}
            disabled={disabled || config.executionMode === 'instant'}
            className={`
              w-full px-4 py-2 border rounded-lg
              ${errors.spreadPercentage ? 'border-red-500' : 'border-gray-300'}
              ${disabled || config.executionMode === 'instant'
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-white text-gray-900'
              }
              focus:outline-none focus:ring-2 focus:ring-blue-500
            `}
            placeholder="e.g., 0.5"
          />
          <span className="absolute right-3 top-2.5 text-gray-400">%</span>
        </div>
        {errors.spreadPercentage && (
          <p className="text-red-500 text-xs mt-1">{errors.spreadPercentage}</p>
        )}
        <p className="text-xs text-gray-500 mt-1">
          Price difference between limit order and market price
        </p>
      </div>

      {/* Slippage Tolerance Input */}
      <div>
        <label htmlFor="slippageTolerance" className="block text-sm font-medium text-gray-700 mb-2">
          Slippage Tolerance
        </label>
        <div className="relative">
          <input
            id="slippageTolerance"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={config.slippageTolerance}
            onChange={(e) => handleSlippageChange(e.target.value)}
            disabled={disabled}
            className={`
              w-full px-4 py-2 border rounded-lg
              ${errors.slippageTolerance ? 'border-red-500' : 'border-gray-300'}
              ${disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-900'}
              focus:outline-none focus:ring-2 focus:ring-blue-500
            `}
            placeholder="e.g., 1.0"
          />
          <span className="absolute right-3 top-2.5 text-gray-400">%</span>
        </div>
        {errors.slippageTolerance && (
          <p className="text-red-500 text-xs mt-1">{errors.slippageTolerance}</p>
        )}
        <p className="text-xs text-gray-500 mt-1">
          Maximum acceptable price movement during execution
        </p>
      </div>

      {/* Capital Allocation Input */}
      <div>
        <label htmlFor="capitalAllocation" className="block text-sm font-medium text-gray-700 mb-2">
          Capital Allocation (Optional)
        </label>
        <div className="relative">
          <span className="absolute left-3 top-2.5 text-gray-400">$</span>
          <input
            id="capitalAllocation"
            type="number"
            min="0"
            step="0.01"
            value={config.capitalAllocation ?? ''}
            onChange={(e) => handleCapitalChange(e.target.value)}
            disabled={disabled}
            className={`
              w-full pl-8 pr-4 py-2 border rounded-lg
              ${errors.capitalAllocation ? 'border-red-500' : 'border-gray-300'}
              ${disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-900'}
              focus:outline-none focus:ring-2 focus:ring-blue-500
            `}
            placeholder="e.g., 1000"
          />
        </div>
        {errors.capitalAllocation && (
          <p className="text-red-500 text-xs mt-1">{errors.capitalAllocation}</p>
        )}
        <p className="text-xs text-gray-500 mt-1">
          Amount of capital to allocate to this strategy execution
        </p>
      </div>

      {/* Estimated Gas Costs */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-sm font-semibold text-blue-900 mb-1">
              Estimated Gas Costs
            </h4>
            <p className="text-xs text-blue-700 mb-2">
              Approximate cost to execute this strategy on Base network
            </p>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-blue-900">
              ${gasEstimates.estimatedCostUSD}
            </div>
            <div className="text-xs text-blue-600">
              ~{parseInt(gasEstimates.estimatedGasUnits).toLocaleString()} gas
            </div>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-blue-200">
          <div className="flex justify-between text-xs text-blue-700">
            <span>Gas Price:</span>
            <span>{gasEstimates.gasPriceGwei} Gwei</span>
          </div>
        </div>
        <p className="text-xs text-blue-600 mt-2">
          💡 Base network typically has very low gas costs. Actual costs may vary based on network congestion.
        </p>
      </div>

      {/* Current Funding Rates (Optional) */}
      {showFundingRates && (
        <div className={`rounded-lg p-4 border ${
          fundingRate.isPositive 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-start justify-between">
            <div>
              <h4 className={`text-sm font-semibold mb-1 ${
                fundingRate.isPositive ? 'text-green-900' : 'text-red-900'
              }`}>
                Current Funding Rate
              </h4>
              <p className={`text-xs mb-2 ${
                fundingRate.isPositive ? 'text-green-700' : 'text-red-700'
              }`}>
                {fundingRate.isPositive 
                  ? 'Longs pay shorts (favorable for short positions)' 
                  : 'Shorts pay longs (unfavorable for short positions)'
                }
              </p>
            </div>
            <div className="text-right">
              {fundingRate.isLoading ? (
                <div className="text-sm text-gray-500">Loading...</div>
              ) : fundingRate.error ? (
                <div className="text-sm text-red-600">Error</div>
              ) : (
                <>
                  <div className={`text-lg font-bold ${
                    fundingRate.isPositive ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {fundingRate.isPositive ? '+' : ''}{(fundingRate.rate * 100).toFixed(4)}%
                  </div>
                  <div className={`text-xs ${
                    fundingRate.isPositive ? 'text-green-600' : 'text-red-600'
                  }`}>
                    per 8 hours
                  </div>
                </>
              )}
            </div>
          </div>
          {fundingRate.error && (
            <p className="text-xs text-red-600 mt-2">
              {fundingRate.error}
            </p>
          )}
          {!fundingRate.isLoading && !fundingRate.error && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className={`flex justify-between text-xs ${
                fundingRate.isPositive ? 'text-green-700' : 'text-red-700'
              }`}>
                <span>Last Updated:</span>
                <span>{new Date(fundingRate.lastUpdated).toLocaleTimeString()}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Configuration Summary */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Configuration Summary</h4>
        <div className="space-y-1 text-xs text-gray-600">
          <div className="flex justify-between">
            <span>Execution Mode:</span>
            <span className="font-medium text-gray-800">
              {config.executionMode === 'instant' ? 'Instant (Market)' : 'Optimized (Limit)'}
            </span>
          </div>
          {config.executionMode === 'optimized' && config.spreadPercentage !== undefined && (
            <div className="flex justify-between">
              <span>Spread:</span>
              <span className="font-medium text-gray-800">{config.spreadPercentage}%</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Slippage Tolerance:</span>
            <span className="font-medium text-gray-800">{config.slippageTolerance}%</span>
          </div>
          {config.capitalAllocation && (
            <div className="flex justify-between">
              <span>Capital:</span>
              <span className="font-medium text-gray-800">${config.capitalAllocation}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 mt-2 border-t border-gray-300">
            <span>Est. Gas Cost:</span>
            <span className="font-medium text-gray-800">${gasEstimates.estimatedCostUSD}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
