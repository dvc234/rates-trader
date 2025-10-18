/**
 * Configuration parameters for strategy execution.
 * These are provided by the user when they execute a strategy.
 */
export interface StrategyConfig {
  /** 
   * Spread percentage for limit orders (optional).
   * Disabled when executionMode is 'instant'.
   * Range: 0-100
   */
  spreadPercentage?: number;
  
  /** 
   * Maximum acceptable slippage tolerance as a percentage.
   * Range: 0-100
   */
  slippageTolerance: number;
  
  /** 
   * Execution mode determining order type.
   * - 'instant': Use market orders for immediate execution
   * - 'optimized': Use limit orders with configured spread
   */
  executionMode: 'instant' | 'optimized';
  
  /** 
   * Total capital to allocate for the strategy execution.
   * Specified in the base currency (e.g., USD or ETH).
   */
  capitalAllocation: string;
}

/**
 * Network configuration for blockchain interactions.
 * Specifies which networks and contracts to use during execution.
 */
export interface NetworkConfig {
  /** Chain ID of the execution network (e.g., Base mainnet) */
  chainId: number;
  
  /** RPC endpoint URL for blockchain interactions */
  rpcUrl: string;
  
  /** Contract addresses for DEX interactions */
  contracts: {
    /** 1inch Fusion contract address */
    oneInchFusion?: string;
    
    /** Perpetual DEX contract address */
    perpetualDex?: string;
    
    /** Additional contract addresses as needed */
    [key: string]: string | undefined;
  };
}

/**
 * Secure wallet interface for transaction signing within the TEE.
 * 
 * This interface abstracts wallet operations to ensure private keys
 * remain secure within the TEE environment and are never exposed.
 */
export interface SecureWallet {
  /** The wallet's public address */
  readonly address: string;
  
  /**
   * Signs a transaction within the TEE.
   * 
   * @param transaction - The transaction data to sign
   * @returns Promise resolving to the signed transaction
   */
  signTransaction(transaction: any): Promise<string>;
  
  /**
   * Gets the current balance of the wallet.
   * 
   * @param tokenAddress - Optional token address (omit for native token)
   * @returns Promise resolving to the balance as a string
   */
  getBalance(tokenAddress?: string): Promise<string>;
}

/**
 * Service interface for DEX interactions.
 * Provides methods for querying and executing trades on decentralized exchanges.
 */
export interface DexService {
  /**
   * Gets the current funding rate for a trading pair.
   * 
   * @param pair - The trading pair (e.g., 'BTC/USD')
   * @returns Promise resolving to the funding rate as a number
   */
  getFundingRate(pair: string): Promise<number>;
}

/**
 * Service interface for perpetual DEX operations.
 * Handles opening and closing leveraged positions.
 */
export interface PerpetualService {
  /**
   * Opens a short position on the perpetual DEX.
   * 
   * @param params - Position parameters
   * @returns Promise resolving to position details
   */
  openShort(params: {
    pair: string;
    amount: string;
    leverage: number;
    wallet: SecureWallet;
  }): Promise<{
    entryPrice: string;
    transactionHash: string;
    gasUsed: string;
  }>;
  
  /**
   * Closes an open position.
   * 
   * @param position - The position to close
   * @returns Promise resolving to transaction details
   */
  closePosition(position: any): Promise<{
    transactionHash: string;
    gasUsed: string;
  }>;
}

/**
 * Service interface for 1inch Fusion integration.
 * Handles spot trading using 1inch's Fusion mode.
 */
export interface OneInchService {
  /**
   * Executes a swap using 1inch Fusion.
   * 
   * @param params - Swap parameters
   * @returns Promise resolving to swap results
   */
  executeFusionSwap(params: {
    asset: string;
    amount: string;
    orderType: 'market' | 'limit';
    targetPrice?: string;
    wallet: SecureWallet;
    slippage: number;
  }): Promise<{
    amountReceived: string;
    executionPrice: string;
    transactionHash: string;
    gasUsed: string;
  }>;
}

/**
 * Execution context shared across all operations in a strategy execution.
 * 
 * The ExecutionContext provides:
 * - User configuration parameters
 * - Secure wallet for transaction signing
 * - Network configuration
 * - Shared state map for passing data between operations
 * - Access to blockchain services (DEX, perpetual, 1inch)
 * 
 * Operations can read from and write to the shared state to coordinate
 * their execution. For example, one operation might store a position's
 * entry price, and a subsequent operation can reference that price.
 * 
 * @example
 * ```typescript
 * // In first operation
 * context.state.set('shortPosition', { entryPrice: '50000' });
 * 
 * // In second operation
 * const position = context.state.get('shortPosition');
 * const targetPrice = position.entryPrice;
 * ```
 */
export interface ExecutionContext {
  /** User-provided configuration for this execution */
  readonly config: StrategyConfig;
  
  /** Secure wallet for signing transactions within the TEE */
  readonly wallet: SecureWallet;
  
  /** Network configuration for blockchain interactions */
  readonly network: NetworkConfig;
  
  /** 
   * Shared state map for passing data between operations.
   * Operations can store and retrieve arbitrary data using string keys.
   */
  state: Map<string, any>;
  
  /**
   * Gets the DEX service for funding rate queries.
   * 
   * @returns The DEX service instance
   */
  getDexService(): DexService;
  
  /**
   * Gets the perpetual service for opening/closing positions.
   * 
   * @returns The perpetual service instance
   */
  getPerpetualService(): PerpetualService;
  
  /**
   * Gets the 1inch service for spot trading.
   * 
   * @returns The 1inch service instance
   */
  getOneInchService(): OneInchService;
}
