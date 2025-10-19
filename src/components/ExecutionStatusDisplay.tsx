/**
 * ExecutionStatusDisplay Component
 * 
 * Displays the status and results of strategy execution in the TEE.
 * Shows execution progress, loading states, results, and error messages.
 * 
 * Features:
 * - Progress indicator for pending/running states
 * - Loading spinner during execution
 * - Success state with execution results
 * - Error state with error messages
 * - Transaction hash display
 * - Execution metrics (gas used, profit estimate, etc.)
 * 
 * @component
 */

'use client';

import type { ExecutionResult } from '@/types/strategy';

/**
 * Props for the ExecutionStatusDisplay component
 */
interface ExecutionStatusDisplayProps {
  /** Current execution status */
  status: 'idle' | 'pending' | 'running' | 'completed' | 'failed';
  /** Execution result (available when status is 'completed') */
  result?: ExecutionResult;
  /** Error message (available when status is 'failed') */
  error?: string;
  /** Task ID for tracking */
  taskId?: string;
}

/**
 * ExecutionStatusDisplay shows the current state of strategy execution
 * 
 * Status Display Logic:
 * - idle: No execution in progress (hidden)
 * - pending: Task created, waiting for worker assignment
 * - running: TEE container executing strategy
 * - completed: Execution finished successfully, show results
 * - failed: Execution failed, show error message
 */
export default function ExecutionStatusDisplay({
  status,
  result,
  error,
  taskId
}: ExecutionStatusDisplayProps) {
  // Don't render anything if idle
  if (status === 'idle') {
    return null;
  }

  return (
    <div className="mt-6">
      {/* Pending State - Waiting for worker */}
      {status === 'pending' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            {/* Loading Spinner */}
            <div className="flex-shrink-0">
              <svg
                className="animate-spin h-8 w-8 text-blue-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>

            {/* Status Text */}
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-blue-900 mb-1">
                Initializing Execution
              </h3>
              <p className="text-blue-700 text-sm mb-3">
                Your strategy execution has been submitted to the iExec network.
                Waiting for a worker to be assigned...
              </p>
              {taskId && (
                <div className="bg-white rounded p-3 border border-blue-200">
                  <p className="text-xs text-gray-600 mb-1">Task ID:</p>
                  <p className="text-xs font-mono text-gray-800 break-all">{taskId}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Running State - TEE executing */}
      {status === 'running' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            {/* Loading Spinner */}
            <div className="flex-shrink-0">
              <svg
                className="animate-spin h-8 w-8 text-blue-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>

            {/* Status Text */}
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-blue-900 mb-1">
                Executing Strategy
              </h3>
              <p className="text-blue-700 text-sm mb-3">
                Your strategy is being executed securely in the Trusted Execution Environment.
                This may take a few minutes...
              </p>

              {/* Progress Steps */}
              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Worker assigned</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>TEE container started</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Executing operations on Base mainnet...</span>
                </div>
              </div>

              {taskId && (
                <div className="bg-white rounded p-3 border border-blue-200">
                  <p className="text-xs text-gray-600 mb-1">Task ID:</p>
                  <p className="text-xs font-mono text-gray-800 break-all">{taskId}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Completed State - Show results */}
      {status === 'completed' && result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          {/* Success Header */}
          <div className="flex items-start gap-4 mb-4">
            <div className="flex-shrink-0">
              <svg
                className="w-8 h-8 text-green-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-green-900 mb-1">
                Execution Completed Successfully
              </h3>
              <p className="text-green-700 text-sm">
                Your strategy has been executed in the TEE. Results are shown below.
              </p>
            </div>
          </div>

          {/* Execution Metrics */}
          <div className="bg-white rounded-lg p-4 border border-green-200 space-y-3">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Execution Summary</h4>

            {/* Operations Executed */}
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Operations Executed:</span>
              <span className="text-sm font-semibold text-gray-900">
                {result.executedOperations}
              </span>
            </div>

            {/* Funding Rate Used - Enhanced Display */}
            {result.metrics?.fundingRates && Object.keys(result.metrics.fundingRates).length > 0 && (
              <div className="py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600 block mb-2">Funding Rate Used:</span>
                <div className="space-y-1">
                  {Object.entries(result.metrics.fundingRates).map(([pair, rate]) => (
                    <div key={pair} className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">{pair}:</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-mono font-semibold ${
                          rate >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {(rate * 100).toFixed(4)}%
                        </span>
                        <span className="text-xs text-gray-500">
                          ({rate >= 0 ? 'Long pays Short' : 'Short pays Long'})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Short Position Details - Enhanced Display */}
            {result.metrics?.positions && result.metrics.positions.length > 0 && (
              <div className="py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600 block mb-2">Short Position Details:</span>
                <div className="space-y-2">
                  {result.metrics.positions.map((position, index) => (
                    <div key={index} className="bg-gradient-to-r from-red-50 to-orange-50 rounded-lg p-3 border border-red-200">
                      {/* Position Header */}
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded">
                            {position.type.toUpperCase()}
                          </span>
                          <span className="font-semibold text-gray-800 text-sm">
                            {position.ticker}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-gray-600 bg-white px-2 py-1 rounded">
                          {position.leverage}x Leverage
                        </span>
                      </div>

                      {/* Position Details Grid */}
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div className="bg-white rounded p-2">
                          <p className="text-xs text-gray-500 mb-1">Entry Price</p>
                          <p className="text-sm font-bold text-gray-800">
                            ${parseFloat(position.entryPrice).toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-white rounded p-2">
                          <p className="text-xs text-gray-500 mb-1">Position Size</p>
                          <p className="text-sm font-bold text-gray-800">
                            {position.size} {position.ticker.split('/')[0]}
                          </p>
                        </div>
                      </div>

                      {/* Stop Loss / Take Profit if available */}
                      {(position.stopLoss || position.takeProfit) && (
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          {position.stopLoss && (
                            <div className="bg-white rounded p-2">
                              <p className="text-xs text-gray-500 mb-1">Stop Loss</p>
                              <p className="text-xs font-semibold text-red-600">
                                ${parseFloat(position.stopLoss).toLocaleString()}
                              </p>
                            </div>
                          )}
                          {position.takeProfit && (
                            <div className="bg-white rounded p-2">
                              <p className="text-xs text-gray-500 mb-1">Take Profit</p>
                              <p className="text-xs font-semibold text-green-600">
                                ${parseFloat(position.takeProfit).toLocaleString()}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Transaction Hash */}
                      {position.transactionHash && (
                        <div className="mt-2 pt-2 border-t border-red-200">
                          <p className="text-xs text-gray-500 mb-1">Transaction:</p>
                          <a
                            href={`https://basescan.org/tx/${position.transactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 text-xs font-mono break-all hover:underline"
                          >
                            {position.transactionHash.slice(0, 10)}...{position.transactionHash.slice(-8)}
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Spot Holding Details - Enhanced Display */}
            {result.metrics?.spotTrades && result.metrics.spotTrades.length > 0 && (
              <div className="py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600 block mb-2">Spot Holding Details:</span>
                <div className="space-y-2">
                  {result.metrics.spotTrades.map((trade, index) => (
                    <div key={index} className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-3 border border-blue-200">
                      {/* Trade Header */}
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-white text-xs font-bold rounded ${
                            trade.type === 'buy' ? 'bg-green-600' : 'bg-red-600'
                          }`}>
                            {trade.type.toUpperCase()}
                          </span>
                          <span className="font-semibold text-gray-800 text-sm">
                            {trade.asset}
                          </span>
                        </div>
                      </div>

                      {/* Trade Details Grid */}
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div className="bg-white rounded p-2">
                          <p className="text-xs text-gray-500 mb-1">Execution Price</p>
                          <p className="text-sm font-bold text-gray-800">
                            ${parseFloat(trade.executionPrice).toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-white rounded p-2">
                          <p className="text-xs text-gray-500 mb-1">Amount</p>
                          <p className="text-sm font-bold text-gray-800">
                            {trade.amount} {trade.asset}
                          </p>
                        </div>
                      </div>

                      {/* Total Value */}
                      <div className="bg-white rounded p-2 mb-2">
                        <p className="text-xs text-gray-500 mb-1">Total Value</p>
                        <p className="text-sm font-bold text-gray-800">
                          ${(parseFloat(trade.amount) * parseFloat(trade.executionPrice)).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </p>
                      </div>

                      {/* Transaction Hash */}
                      {trade.transactionHash && (
                        <div className="pt-2 border-t border-blue-200">
                          <p className="text-xs text-gray-500 mb-1">Transaction:</p>
                          <a
                            href={`https://basescan.org/tx/${trade.transactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 text-xs font-mono break-all hover:underline"
                          >
                            {trade.transactionHash.slice(0, 10)}...{trade.transactionHash.slice(-8)}
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Profit Estimate - Enhanced Display */}
            {result.metrics?.profitEstimate !== undefined && (
              <div className="py-2 border-b border-gray-100">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border border-green-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Estimated Profit</p>
                      <p className={`text-2xl font-bold ${
                        result.metrics.profitEstimate >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {result.metrics.profitEstimate >= 0 ? '+' : ''}${result.metrics.profitEstimate.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Based on current positions</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {result.metrics.profitEstimate >= 0 ? '📈 Profitable' : '📉 At Risk'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Gas Used */}
            {result.metrics?.gasUsed && (
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-600">Total Gas Used:</span>
                <span className="text-sm font-semibold text-gray-900">
                  {result.metrics.gasUsed} ETH
                </span>
              </div>
            )}
          </div>

          {/* Task ID */}
          {taskId && (
            <div className="mt-4 bg-white rounded p-3 border border-green-200">
              <p className="text-xs text-gray-600 mb-1">Task ID:</p>
              <p className="text-xs font-mono text-gray-800 break-all">{taskId}</p>
            </div>
          )}
        </div>
      )}

      {/* Failed State - Show error */}
      {status === 'failed' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            {/* Error Icon */}
            <div className="flex-shrink-0">
              <svg
                className="w-8 h-8 text-red-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>

            {/* Error Message */}
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-900 mb-1">
                Execution Failed
              </h3>
              <p className="text-red-700 text-sm mb-3">
                {error || 'An error occurred during strategy execution. Please try again.'}
              </p>

              {/* Task ID */}
              {taskId && (
                <div className="bg-white rounded p-3 border border-red-200">
                  <p className="text-xs text-gray-600 mb-1">Task ID:</p>
                  <p className="text-xs font-mono text-gray-800 break-all">{taskId}</p>
                </div>
              )}

              {/* Troubleshooting Tips */}
              <div className="mt-4 bg-white rounded p-3 border border-red-200">
                <p className="text-xs font-semibold text-gray-700 mb-2">Troubleshooting:</p>
                <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                  <li>Check your wallet balance and network connection</li>
                  <li>Verify you have sufficient RLC for execution</li>
                  <li>Ensure you&apos;re connected to the correct network</li>
                  <li>Try adjusting your configuration parameters</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
