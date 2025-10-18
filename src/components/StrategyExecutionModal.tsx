/**
 * StrategyExecutionModal Component
 * 
 * Modal dialog for configuring and executing strategies.
 * Integrates configuration form, execution flow, and status display.
 * 
 * Features:
 * - Strategy configuration form
 * - Execute button with validation
 * - Real-time execution status
 * - Result display
 * - Configuration persistence
 * 
 * @component
 */

'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import type { Strategy, StrategyConfig } from '@/types/strategy';
import StrategyConfigForm from './StrategyConfigForm';
import ExecutionStatusDisplay from './ExecutionStatusDisplay';
import { IExecExecutionService } from '@/services/IExecExecutionService';
import { getStrategyDataProtectorService } from '@/services/StrategyDataProtectorService';

/**
 * Props for the StrategyExecutionModal component
 */
interface StrategyExecutionModalProps {
  /** Strategy to execute */
  strategy: Strategy;
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** iExec execution service instance */
  executionService: IExecExecutionService;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: StrategyConfig = {
  executionMode: 'instant',
  slippageTolerance: 1.0,
  spreadPercentage: undefined,
  capitalAllocation: undefined,
};

/**
 * StrategyExecutionModal provides a complete interface for executing strategies
 * 
 * Execution Flow:
 * 1. User configures strategy parameters
 * 2. User clicks execute button
 * 3. Service verifies ownership via Data Protector
 * 4. Service creates iExec task for TEE execution
 * 5. Modal polls for execution status
 * 6. Results are displayed when complete
 * 
 * State Management:
 * - Configuration is persisted to localStorage
 * - Execution status is tracked in component state
 * - Modal can be closed and reopened without losing state
 */
export default function StrategyExecutionModal({
  strategy,
  isOpen,
  onClose,
  executionService
}: StrategyExecutionModalProps) {
  const { address } = useAccount();

  // Configuration state
  const [config, setConfig] = useState<StrategyConfig>(DEFAULT_CONFIG);

  // Execution state
  const [executionStatus, setExecutionStatus] = useState<'idle' | 'pending' | 'running' | 'completed' | 'failed'>('idle');
  const [taskId, setTaskId] = useState<string | undefined>();
  const [executionResult, setExecutionResult] = useState<any>();
  const [executionError, setExecutionError] = useState<string | undefined>();
  const [isExecuting, setIsExecuting] = useState(false);

  /**
   * Load saved configuration from localStorage on mount
   * 
   * Persistence Logic:
   * - Configurations are saved per strategy per wallet
   * - Key format: `strategy_config_${strategyId}_${address}`
   * - Falls back to default config if no saved config exists
   */
  useEffect(() => {
    if (!address) return;

    const storageKey = `strategy_config_${strategy.id}_${address.toLowerCase()}`;
    const savedConfig = localStorage.getItem(storageKey);

    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setConfig(parsed);
      } catch (error) {
        console.error('Failed to parse saved config:', error);
        setConfig(DEFAULT_CONFIG);
      }
    }
  }, [strategy.id, address]);

  /**
   * Save configuration to localStorage when it changes
   */
  useEffect(() => {
    if (!address) return;

    const storageKey = `strategy_config_${strategy.id}_${address.toLowerCase()}`;
    localStorage.setItem(storageKey, JSON.stringify(config));
  }, [config, strategy.id, address]);

  /**
   * Handle configuration changes from the form
   */
  const handleConfigChange = (newConfig: StrategyConfig) => {
    setConfig(newConfig);
  };

  /**
   * Reset configuration to defaults
   */
  const handleResetConfig = () => {
    setConfig(DEFAULT_CONFIG);
  };

  /**
   * Validate configuration before execution
   */
  const validateConfig = (): { isValid: boolean; error?: string } => {
    // Validate slippage tolerance
    if (config.slippageTolerance < 0 || config.slippageTolerance > 100) {
      return { isValid: false, error: 'Slippage tolerance must be between 0 and 100' };
    }

    // Validate spread percentage for optimized mode
    if (config.executionMode === 'optimized') {
      if (config.spreadPercentage === undefined || config.spreadPercentage === null) {
        return { isValid: false, error: 'Spread percentage is required for optimized execution' };
      }
      if (config.spreadPercentage < 0 || config.spreadPercentage > 100) {
        return { isValid: false, error: 'Spread percentage must be between 0 and 100' };
      }
    }

    // Validate capital allocation if provided
    if (config.capitalAllocation !== undefined && config.capitalAllocation !== '') {
      const capital = Number(config.capitalAllocation);
      if (isNaN(capital) || capital <= 0) {
        return { isValid: false, error: 'Capital allocation must be a positive number' };
      }
    }

    return { isValid: true };
  };

  /**
   * Execute the strategy
   * 
   * Execution Flow:
   * 1. Validate configuration
   * 2. Verify ownership via Data Protector
   * 3. Create iExec task for TEE execution
   * 4. Start polling for status updates
   * 5. Display results when complete
   */
  const handleExecute = async () => {
    if (!address) {
      setExecutionError('Please connect your wallet');
      return;
    }

    // Validate configuration
    const validation = validateConfig();
    if (!validation.isValid) {
      setExecutionError(validation.error);
      return;
    }

    try {
      setIsExecuting(true);
      setExecutionStatus('pending');
      setExecutionError(undefined);
      setExecutionResult(undefined);

      console.log('[ExecutionModal] Starting execution:', {
        strategyId: strategy.id,
        userAddress: address,
        config,
      });

      // Execute strategy via iExec service
      // This will:
      // 1. Verify ownership via Data Protector
      // 2. Prepare TEE input with config and protected data reference
      // 3. Create iExec task for TEE execution
      const result = await executionService.executeStrategy(
        strategy.id,
        address,
        config
      );

      if (!result.success) {
        throw new Error(result.error || 'Execution failed');
      }

      console.log('[ExecutionModal] Execution started, task ID:', result.taskId);

      // Store task ID for status polling
      setTaskId(result.taskId);

      // Start polling for status
      pollExecutionStatus(result.taskId!);
    } catch (error: any) {
      console.error('[ExecutionModal] Execution failed:', error);
      setExecutionStatus('failed');
      setExecutionError(error.message || 'Failed to execute strategy');
      setIsExecuting(false);
    }
  };

  /**
   * Poll for execution status updates
   * 
   * Polling Strategy:
   * - Poll every 5 seconds while pending or running
   * - Stop polling when completed or failed
   * - Update UI with current status
   */
  const pollExecutionStatus = async (taskId: string) => {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max (60 * 5 seconds)

    const poll = async () => {
      try {
        attempts++;

        console.log('[ExecutionModal] Polling status, attempt:', attempts);

        // Get current status from iExec service
        const status = await executionService.getExecutionStatus(taskId);

        console.log('[ExecutionModal] Status:', status.status);

        // Update UI with current status
        setExecutionStatus(status.status);

        // Handle completed state
        if (status.status === 'completed') {
          setExecutionResult(status.result);
          setIsExecuting(false);
          console.log('[ExecutionModal] Execution completed successfully');
          return;
        }

        // Handle failed state
        if (status.status === 'failed') {
          setExecutionError(status.error || 'Execution failed');
          setIsExecuting(false);
          console.error('[ExecutionModal] Execution failed:', status.error);
          return;
        }

        // Continue polling if still pending or running
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000); // Poll every 5 seconds
        } else {
          // Timeout after max attempts
          setExecutionStatus('failed');
          setExecutionError('Execution timeout. Please check task status manually.');
          setIsExecuting(false);
          console.error('[ExecutionModal] Polling timeout');
        }
      } catch (error: any) {
        console.error('[ExecutionModal] Status polling error:', error);
        setExecutionStatus('failed');
        setExecutionError(error.message || 'Failed to get execution status');
        setIsExecuting(false);
      }
    };

    // Start polling
    poll();
  };

  /**
   * Handle modal close
   * Reset execution state when closing
   */
  const handleClose = () => {
    // Don't allow closing while executing
    if (isExecuting) {
      return;
    }

    // Reset execution state
    setExecutionStatus('idle');
    setTaskId(undefined);
    setExecutionResult(undefined);
    setExecutionError(undefined);

    onClose();
  };

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Execute Strategy</h2>
              <p className="text-sm text-gray-600 mt-1">{strategy.name}</p>
            </div>
            <button
              onClick={handleClose}
              disabled={isExecuting}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            {/* Configuration Form - Only show if not executing */}
            {executionStatus === 'idle' && (
              <>
                <StrategyConfigForm
                  config={config}
                  onChange={handleConfigChange}
                  disabled={isExecuting}
                />

                {/* Error Message */}
                {executionError && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-700">{executionError}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={handleExecute}
                    disabled={isExecuting}
                    className="primary flex-1"
                  >
                    {isExecuting ? 'Executing...' : 'Execute Strategy'}
                  </button>
                  <button
                    onClick={handleResetConfig}
                    disabled={isExecuting}
                    className="secondary"
                  >
                    Reset
                  </button>
                </div>
              </>
            )}

            {/* Execution Status Display */}
            <ExecutionStatusDisplay
              status={executionStatus}
              result={executionResult}
              error={executionError}
              taskId={taskId}
            />

            {/* Close Button - Show after execution completes */}
            {(executionStatus === 'completed' || executionStatus === 'failed') && (
              <div className="mt-6">
                <button onClick={handleClose} className="primary w-full">
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
