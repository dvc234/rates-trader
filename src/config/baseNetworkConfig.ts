/**
 * Base Network Configuration
 * 
 * Configuration for DEX and protocol contract addresses on Base mainnet.
 * These addresses are used by the TEE for strategy execution.
 * 
 * Network: Base Mainnet (Chain ID: 8453)
 * 
 * Strategy Execution Flow:
 * 1. TEE receives strategy operations and user config
 * 2. TEE connects to Base mainnet using RPC endpoint
 * 3. TEE interacts with DEX contracts using addresses from this config
 * 4. TEE executes operations (spot buys, perpetual shorts)
 * 5. TEE returns results to user
 * 
 * Security:
 * - Contract addresses are public and can be verified on-chain
 * - Always verify addresses match official protocol documentation
 * - Use block explorers to confirm contract authenticity
 */

/**
 * Base Network Configuration Interface
 */
export interface BaseNetworkConfig {
  /** Chain ID for Base mainnet */
  chainId: number;
  
  /** RPC endpoint for Base mainnet */
  rpcUrl: string;
  
  /** Block explorer URL */
  explorerUrl: string;
  
  /** DEX and protocol contract addresses */
  contracts: {
    /** 1inch Fusion contract for spot trading */
    oneInchFusion?: string;
    
    /** Perpetual DEX contract for shorts */
    perpetualDex?: string;
    
    /** Optional: Uniswap V3 Router for fallback swaps */
    uniswapV3Router?: string;
    
    /** Optional: Aave Pool for lending operations */
    aavePool?: string;
  };
}

/**
 * Base Mainnet Configuration
 * 
 * Default configuration for Base mainnet (Chain ID: 8453).
 * Contract addresses are loaded from environment variables.
 * 
 * Environment Variables:
 * - NEXT_PUBLIC_BASE_RPC_URL: Custom RPC endpoint (optional)
 * - NEXT_PUBLIC_ONEINCH_FUSION_ADDRESS: 1inch Fusion contract (optional; only if NEXT_PUBLIC_ENABLE_1INCH=true)
 * - NEXT_PUBLIC_PERPETUAL_DEX_ADDRESS: Perpetual DEX contract (required if NEXT_PUBLIC_PERPS_PROTOCOL != 'none')
 * - NEXT_PUBLIC_UNISWAP_V3_ROUTER: Uniswap V3 Router (optional)
 * - NEXT_PUBLIC_AAVE_POOL: Aave Pool contract (optional)
 * - NEXT_PUBLIC_ENABLE_1INCH: 'true' to require 1inch address, else optional
 * - NEXT_PUBLIC_PERPS_PROTOCOL: perps protocol key, e.g., 'avantis' | 'gmx' | 'synthetix' | 'dydx' | 'none'
 * 
 * Contract Address Sources:
 * - 1inch Fusion: https://docs.1inch.io/docs/fusion-swap/introduction
 * - Perpetual DEXs: Protocol-specific documentation (GMX, Synthetix, dYdX, Avantis)
 * - Uniswap V3: https://docs.uniswap.org/contracts/v3/reference/deployments
 * - Aave: https://docs.aave.com/developers/deployed-contracts/v3-mainnet
 * 
 * Verification:
 * - Base Explorer: https://basescan.org
 * - Verify all addresses on BaseScan before use
 * - Check contract source code is verified
 * - Confirm addresses match official protocol documentation
 */
export const baseNetworkConfig: BaseNetworkConfig = {
  // Base mainnet chain ID
  chainId: 8453,
  
  // RPC endpoint - uses public RPC by default
  // For production, use a private RPC from Alchemy, Infura, or QuickNode
  rpcUrl: process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org',
  
  // Block explorer for transaction verification
  explorerUrl: 'https://basescan.org',
  
  // DEX and protocol contract addresses
  contracts: {
    // 1inch Fusion contract for spot trading
    // Used for: Spot buy operations with limit/market orders
    // Documentation: https://docs.1inch.io/docs/fusion-swap/introduction
    // Verify on BaseScan: https://basescan.org/address/[address]
    oneInchFusion: process.env.NEXT_PUBLIC_ONEINCH_FUSION_ADDRESS,
    
    // Perpetual DEX contract for opening/closing shorts
    // Used for: Opening perpetual short positions on BTC/ETH
    // Configure based on which protocol you're using:
    // - GMX: https://gmx-docs.io/docs/api/contracts-v2
    // - Synthetix Perps: https://docs.synthetix.io/integrations/perps-integration-guide/
    // - dYdX: https://docs.dydx.exchange/
    perpetualDex: process.env.NEXT_PUBLIC_PERPETUAL_DEX_ADDRESS,
    
    // Optional: Uniswap V3 Router for fallback swaps
    // Used for: Backup spot trading if 1inch is unavailable
    // Documentation: https://docs.uniswap.org/contracts/v3/reference/deployments
    uniswapV3Router: process.env.NEXT_PUBLIC_UNISWAP_V3_ROUTER,
    
    // Optional: Aave Pool for lending operations
    // Used for: Future strategies involving lending/borrowing
    // Documentation: https://docs.aave.com/developers/deployed-contracts/v3-mainnet
    aavePool: process.env.NEXT_PUBLIC_AAVE_POOL,
  },
};

/**
 * Validate Base network configuration
 * 
 * Checks that required contract addresses are configured.
 * Should be called during service initialization.
 * 
 * @returns Validation result with missing addresses
 */
export function validateBaseNetworkConfig(): {
  isValid: boolean;
  missingAddresses: string[];
} {
  const missing: string[] = [];
  
  // Check required addresses
  // 1inch Fusion uses multiple contracts/resolvers; not enforcing a single address here.
  // If you intend to use on-chain Fusion contracts directly, set NEXT_PUBLIC_ONEINCH_FUSION_ADDRESS and validate elsewhere.

  if (!baseNetworkConfig.contracts.perpetualDex) {
    missing.push('NEXT_PUBLIC_PERPETUAL_DEX_ADDRESS');
  }
  
  return {
    isValid: missing.length === 0,
    missingAddresses: missing,
  };
}

/**
 * Get contract address by name
 * 
 * Helper function to retrieve contract addresses with validation.
 * Throws error if address is not configured.
 * 
 * @param contractName - Name of the contract
 * @returns Contract address
 * @throws Error if address is not configured
 */
export function getContractAddress(
  contractName: keyof BaseNetworkConfig['contracts']
): string {
  const address = baseNetworkConfig.contracts[contractName];
  
  if (!address) {
    throw new Error(
      `Contract address not configured: ${contractName}. ` +
      `Please set the corresponding environment variable.`
    );
  }
  
  return address;
}

/**
 * Format Base network configuration for TEE input
 * 
 * Prepares network configuration in the format expected by the TEE.
 * Used when creating iExec tasks for strategy execution.
 * 
 * @returns Network configuration for TEE
 */
export function formatBaseConfigForTEE() {
  return {
    chainId: baseNetworkConfig.chainId,
    rpcUrl: baseNetworkConfig.rpcUrl,
    explorerUrl: baseNetworkConfig.explorerUrl,
    contracts: {
      oneInchFusion: baseNetworkConfig.contracts.oneInchFusion || '',
      perpetualDex: baseNetworkConfig.contracts.perpetualDex || '',
      uniswapV3Router: baseNetworkConfig.contracts.uniswapV3Router || '',
      aavePool: baseNetworkConfig.contracts.aavePool || '',
    },
  };
}

export default baseNetworkConfig;
