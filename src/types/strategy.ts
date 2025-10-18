/**
 * Strategy data models and types for the DeFi Strategy Platform
 * These interfaces define the core data structures for strategies, operations, and execution
 */

/**
 * Risk level classification for strategies
 */
export type RiskLevel = 'low' | 'medium' | 'high';

/**
 * Execution mode for strategy operations
 * - instant: Execute immediately with market orders
 * - optimized: Use limit orders with configured spread
 */
export type ExecutionMode = 'instant' | 'optimized';

/**
 * Operation types supported by the TEE executor
 */
export enum OperationType {
    // Testing
    MOCK_OPERATION = 'mock_operation',

    // Spot Trading
    SPOT_BUY = 'spot_buy',
    SPOT_SELL = 'spot_sell',

    // Perpetual Positions - Long
    OPEN_LONG = 'open_long',
    CLOSE_LONG = 'close_long',

    // Perpetual Positions - Short
    OPEN_SHORT = 'open_short',
    CLOSE_SHORT = 'close_short',

    // Market Analysis (read-only operations)
    CHECK_FUNDING_RATE = 'check_funding_rate',
    CHECK_PRICE = 'check_price',
    CHECK_LIQUIDITY = 'check_liquidity',

    // Conditional Logic
    CONDITIONAL = 'conditional',
    WAIT = 'wait'
}

/**
 * Main strategy interface representing a tradable strategy in the marketplace
 * Contains all metadata and encrypted operations for TEE execution
 */
export interface Strategy {
    /** Unique identifier for the strategy */
    id: string;

    /** Display name of the strategy */
    name: string;

    /** Detailed description of what the strategy does */
    description: string;

    /** Risk classification (low, medium, high) */
    risk: RiskLevel;

    /** Expected Annual Percentage Rate range */
    apr: {
        /** Minimum expected APR */
        min: number;
        /** Maximum expected APR */
        max: number;
    };

    /** Price in RLC tokens required to purchase this strategy */
    price: string;

    /** Whether the current user owns this strategy */
    isOwned: boolean;

    /** Encrypted operations data (not displayed to users) */
    encryptedOperations?: string;
}

/**
 * Base parameters for all trading operations
 */
export interface BaseOperationParams {
    /** 
     * Trading pair ticker (e.g., 'ETH/USDC', 'BTC/USDC')
     * Use USDC as quote currency for Base network compatibility
     */
    ticker: string;

    /** 
     * Protocol to execute on
     * - '1inch-fusion' for spot trading (SPOT_BUY, SPOT_SELL)
     * - 'avantis' for perpetuals (OPEN_LONG, OPEN_SHORT, CLOSE_LONG, CLOSE_SHORT, CHECK_FUNDING_RATE)
     * See src/config/protocols.ts for available protocols
     */
    exchange?: string;
}

/**
 * Parameters for spot buy operations
 */
export interface SpotBuyParams extends BaseOperationParams {
    /** Amount to buy (in base currency or percentage of capital) */
    amount: string;

    /** Whether amount is a percentage of allocated capital */
    isPercentage?: boolean;

    /** Maximum price willing to pay (optional, for limit orders) */
    maxPrice?: string;
}

/**
 * Parameters for spot sell operations
 */
export interface SpotSellParams extends BaseOperationParams {
    /** Amount to sell (in base currency or percentage of holdings) */
    amount: string;

    /** Whether amount is a percentage of current holdings */
    isPercentage?: boolean;

    /** Minimum price willing to accept (optional, for limit orders) */
    minPrice?: string;
}

/**
 * Parameters for opening long positions
 */
export interface OpenLongParams extends BaseOperationParams {
    /** Position size (in base currency or percentage of capital) */
    size: string;

    /** Whether size is a percentage of allocated capital */
    isPercentage?: boolean;

    /** Leverage multiplier (e.g., 2, 5, 10) */
    leverage: number;

    /** Stop loss price (optional) */
    stopLoss?: string;

    /** Take profit price (optional) */
    takeProfit?: string;
}

/**
 * Parameters for opening short positions
 */
export interface OpenShortParams extends BaseOperationParams {
    /** Position size (in base currency or percentage of capital) */
    size: string;

    /** Whether size is a percentage of allocated capital */
    isPercentage?: boolean;

    /** Leverage multiplier (e.g., 2, 5, 10) */
    leverage: number;

    /** Stop loss price (optional) */
    stopLoss?: string;

    /** Take profit price (optional) */
    takeProfit?: string;
}

/**
 * Parameters for closing long positions
 */
export interface CloseLongParams extends BaseOperationParams {
    /** Amount to close (in base currency or percentage of position) */
    amount?: string;

    /** Whether to close entire position */
    closeAll?: boolean;

    /** Minimum price to accept for closing */
    minPrice?: string;
}

/**
 * Parameters for closing short positions
 */
export interface CloseShortParams extends BaseOperationParams {
    /** Amount to close (in base currency or percentage of position) */
    amount?: string;

    /** Whether to close entire position */
    closeAll?: boolean;

    /** Maximum price to accept for closing */
    maxPrice?: string;
}

/**
 * Parameters for checking funding rates
 */
export interface CheckFundingRateParams extends BaseOperationParams {
    /** Minimum acceptable funding rate threshold */
    minRate?: number;

    /** Maximum acceptable funding rate threshold */
    maxRate?: number;
}

/**
 * Parameters for checking prices
 */
export interface CheckPriceParams extends BaseOperationParams {
    /** Comparison operator */
    operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';

    /** Target price to compare against */
    targetPrice: string;
}

/**
 * Parameters for conditional operations
 */
export interface ConditionalParams {
    /** Condition to evaluate (references previous operation results) */
    condition: string;

    /** Operations to execute if condition is true */
    thenOperations: StrategyOperation[];

    /** Operations to execute if condition is false (optional) */
    elseOperations?: StrategyOperation[];
}

/**
 * Parameters for wait operations
 */
export interface WaitParams {
    /** Duration to wait in milliseconds */
    duration: number;

    /** Optional condition to wait for */
    condition?: string;
}

/**
 * Union type for all operation parameters
 */
export type OperationParams =
    | SpotBuyParams
    | SpotSellParams
    | OpenLongParams
    | OpenShortParams
    | CloseLongParams
    | CloseShortParams
    | CheckFundingRateParams
    | CheckPriceParams
    | ConditionalParams
    | WaitParams
    | Record<string, string | number | boolean | undefined>;

/**
 * Strategy operation interface for TEE execution
 * Represents a single atomic operation that executes within the TEE
 */
export interface StrategyOperation {
    /** Type of operation to execute */
    type: OperationType;

    /** Execution order (operations execute sequentially by order) */
    order: number;

    /** Operation-specific parameters */
    params: OperationParams;

    /** Optional label for referencing this operation's result */
    label?: string;

    /** Whether this operation can fail without stopping execution */
    optional?: boolean;
}

/**
 * User configuration for strategy execution
 * These parameters customize how the strategy executes
 */
export interface StrategyConfig {
    /** 
     * Spread percentage for limit orders (optional)
     * Disabled when executionMode is 'instant'
     * Range: 0-100
     */
    spreadPercentage?: number;

    /** 
     * Maximum acceptable slippage tolerance
     * Range: 0-100 (percentage)
     */
    slippageTolerance: number;

    /** 
     * Execution mode determining order type
     * instant: market orders, optimized: limit orders
     */
    executionMode: ExecutionMode;

    /** 
     * Amount of capital to allocate to this strategy execution
     * Specified in USD or base currency
     */
    capitalAllocation?: string;
}

/**
 * Position details for perpetual contracts
 */
export interface PositionDetails {
    /** Position type */
    type: 'long' | 'short';

    /** Trading pair */
    ticker: string;

    /** Entry price */
    entryPrice: string;

    /** Position size */
    size: string;

    /** Leverage used */
    leverage: number;

    /** Transaction hash */
    transactionHash: string;

    /** Stop loss price if set */
    stopLoss?: string;

    /** Take profit price if set */
    takeProfit?: string;
}

/**
 * Spot trade details
 */
export interface SpotTradeDetails {
    /** Trade type */
    type: 'buy' | 'sell';

    /** Trading pair */
    ticker: string;

    /** Asset symbol */
    asset: string;

    /** Amount traded */
    amount: string;

    /** Execution price */
    executionPrice: string;

    /** Transaction hash */
    transactionHash: string;
}

/**
 * Result of a strategy execution in the TEE
 * Contains execution status, transaction details, and metrics
 */
export interface ExecutionResult {
    /** Whether the execution completed successfully */
    success: boolean;

    /** Number of operations that were executed */
    executedOperations: number;

    /** Error message if execution failed */
    error?: string;

    /** Execution metrics and performance data */
    metrics?: {
        /** Total gas used across all operations */
        gasUsed?: string;

        /** Estimated profit/loss from the execution */
        profitEstimate?: number;

        /** Funding rates checked during execution */
        fundingRates?: Record<string, number>;

        /** Prices checked during execution */
        prices?: Record<string, string>;

        /** All positions opened during execution */
        positions?: PositionDetails[];

        /** All spot trades executed */
        spotTrades?: SpotTradeDetails[];

        /** Positions closed during execution */
        closedPositions?: {
            ticker: string;
            type: 'long' | 'short';
            exitPrice: string;
            pnl: string;
            transactionHash: string;
        }[];
    };
}

/**
 * Validation result for strategy configuration or operations
 */
export interface ValidationResult {
    /** Whether the validation passed */
    isValid: boolean;

    /** Array of error messages if validation failed */
    errors: string[];
}
