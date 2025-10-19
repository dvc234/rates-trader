/**
 * StrategyCard Component
 * 
 * Displays a single strategy in a card format with key information and action buttons.
 * Conditionally renders purchase or execute button based on ownership status.
 * 
 * @component
 */

import { Strategy } from '@/types/strategy';

/**
 * Props for the StrategyCard component
 */
interface StrategyCardProps {
  /** Strategy data to display */
  strategy: Strategy;
  /** Callback when purchase button is clicked */
  onPurchase?: (strategyId: string) => void;
  /** Callback when execute button is clicked */
  onExecute?: (strategyId: string) => void;
  /** Whether the card is in a loading state */
  isLoading?: boolean;
}

/**
 * Maps risk level to display color
 */
const getRiskColor = (risk: Strategy['risk']): string => {
  switch (risk) {
    case 'low':
      return 'text-green-600 bg-green-50';
    case 'medium':
      return 'text-yellow-600 bg-yellow-50';
    case 'high':
      return 'text-red-600 bg-red-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
};

/**
 * StrategyCard displays strategy information and provides action buttons
 * 
 * The card shows:
 * - Strategy name and description
 * - Risk level with color coding
 * - Expected APR range
 * - Price in RLC tokens
 * - Action button (Purchase or Execute based on ownership)
 */
export default function StrategyCard({
  strategy,
  onPurchase,
  onExecute,
  isLoading = false
}: StrategyCardProps) {
  /**
   * Handles the action button click
   * Routes to either purchase or execute based on ownership status
   */
  const handleAction = () => {
    if (isLoading) return;
    
    // Conditional logic: if user owns the strategy, trigger execute
    // Otherwise, trigger purchase flow
    if (strategy.isOwned && onExecute) {
      onExecute(strategy.id);
    } else if (!strategy.isOwned && onPurchase) {
      onPurchase(strategy.id);
    }
  };

  // Check if this is the demo strategy
  const isDemoStrategy = strategy.id === 'demo-real-strategy-001';

  return (
    <div className={`rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow duration-200 ${
      isDemoStrategy 
        ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300' 
        : 'bg-white border border-gray-200'
    }`}>
      {/* Demo Badge */}
      {isDemoStrategy && (
        <div className="mb-3">
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-blue-600 text-white">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            LIVE DEMO - Real Execution
          </span>
        </div>
      )}
      
      {/* Strategy Header */}
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">
          {strategy.name}
        </h3>
        <p className="text-gray-600 text-sm leading-relaxed">
          {strategy.description}
        </p>
      </div>

      {/* Strategy Metrics */}
      <div className="space-y-3 mb-6">
        {/* Risk Level */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Risk Level:</span>
          <span className={`text-sm font-medium px-3 py-1 rounded-full ${getRiskColor(strategy.risk)}`}>
            {strategy.risk.charAt(0).toUpperCase() + strategy.risk.slice(1)}
          </span>
        </div>

        {/* APR Range */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Expected APR:</span>
          <span className="text-sm font-semibold text-gray-800">
            {strategy.apr.min}% - {strategy.apr.max}%
          </span>
        </div>

        {/* Price */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Price:</span>
          <span className="text-sm font-semibold text-gray-800">
            {strategy.price} RLC
          </span>
        </div>
      </div>

      {/* Action Button - Conditional rendering based on ownership */}
      {/* If strategy is owned, show Execute button */}
      {/* If strategy is not owned, show Purchase button */}
      <button
        onClick={handleAction}
        disabled={isLoading}
        className={strategy.isOwned ? 'primary w-full' : 'secondary w-full'}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Loading...
          </span>
        ) : strategy.isOwned ? (
          'Execute Strategy'
        ) : (
          `Purchase for ${strategy.price} RLC`
        )}
      </button>
    </div>
  );
}
