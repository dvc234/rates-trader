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
 * - Capital allocation input
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
  disabled = false
}: StrategyConfigFormProps) {
  // Local state for validation errors
  const [errors, setErrors] = useState<ValidationErrors>({});

  /**
   * Validate form fields and update error state
   * 
   * Validation Rules:
   * - Spread percentage: 0-100 (only for optimized mode)
   * - Slippage tolerance: 0-100 (required)
   * - Capital allocation: positive number (optional)
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
        // Capital allocation is optional
        if (value && value !== '') {
          const capital = Number(value);
          if (isNaN(capital) || capital <= 0) {
            return 'Capital allocation must be a positive number';
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
        </div>
      </div>
    </div>
  );
}
