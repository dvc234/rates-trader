/**
 * Network Configuration for DeFi Strategy Platform
 * 
 * This module defines the blockchain networks supported by the platform.
 * The platform operates across multiple networks for different purposes:
 * 
 * - Arbitrum Sepolia: Used for iExec payments with RLC tokens (testnet)
 * - Arbitrum One: Production network for iExec payments (future use)
 * - Bellecour (iExec Sidechain): iExec's native network for Data Protector and TEE operations
 * 
 * Network Architecture:
 * - Payment Layer: Arbitrum networks handle RLC token transactions for strategy purchases
 * - Execution Layer: Base mainnet (to be added) will handle actual strategy execution
 * - iExec Layer: Bellecour network manages Data Protector access control and TEE coordination
 */

import {
  type AppKitNetwork,
  arbitrumSepolia,
  arbitrum,
} from '@reown/appkit/networks';

// Re-export Arbitrum networks from Reown AppKit for convenience
export { arbitrumSepolia, arbitrum } from '@reown/appkit/networks';

/**
 * Bellecour Network Configuration (iExec Sidechain)
 * 
 * Bellecour is iExec's production sidechain used for:
 * - Data Protector: Encrypting and managing access to strategy operations
 * - iAppGenerator: Coordinating TEE (Trusted Execution Environment) executions
 * - RLC token operations on the iExec ecosystem
 * 
 * Network Details:
 * - Chain ID: 134 (0x86 in hex)
 * - Native Token: xRLC (bridged RLC token)
 * - RPC Endpoint: https://bellecour.iex.ec
 * - Block Explorer: Blockscout at https://blockscout-bellecour.iex.ec
 */
export const bellecour: AppKitNetwork = {
  id: 0x86, // Chain ID 134 in hexadecimal
  name: 'iExec Sidechain',
  nativeCurrency: {
    decimals: 18,
    name: 'xRLC',
    symbol: 'xRLC',
  },
  rpcUrls: {
    public: { http: ['https://bellecour.iex.ec'] },
    default: { http: ['https://bellecour.iex.ec'] },
  },
  blockExplorers: {
    etherscan: {
      name: 'Blockscout',
      url: 'https://blockscout-bellecour.iex.ec',
    },
    default: { name: 'Blockscout', url: 'https://blockscout-bellecour.iex.ec' },
  },
};

/**
 * Explorer Slugs Mapping
 * 
 * Maps chain IDs to their corresponding slug identifiers in the iExec explorer.
 * Used for constructing URLs to view transactions and data on iExec's explorer interface.
 * 
 * Supported Networks:
 * - 134: Bellecour (iExec Sidechain) - Production iExec network
 * - 42161: Arbitrum One - Ethereum L2 for mainnet operations
 * - 421614: Arbitrum Sepolia - Testnet for development and testing
 */
export const explorerSlugs: Record<number, string> = {
  134: 'bellecour', // iExec Sidechain (Bellecour)
  42161: 'arbitrum-mainnet', // Arbitrum One
  421614: 'arbitrum-sepolia-testnet', // Arbitrum Sepolia
};

/**
 * Default Network Configuration Object
 * 
 * Aggregates all supported networks for use in wagmi configuration.
 * These networks are configured in the WagmiAdapter to enable:
 * - Multi-chain wallet connections
 * - Network switching in the UI
 * - Transaction signing on appropriate networks
 * 
 * Current Networks:
 * - bellecour: iExec operations (Data Protector, TEE coordination)
 * - arbitrumSepolia: Testnet for RLC payments and development
 * - arbitrum: Mainnet for production RLC payments (future use)
 * 
 * Note: Base mainnet will be added in Phase 7 for strategy execution
 */
const wagmiNetworks = {
  bellecour,
  arbitrumSepolia,
  arbitrum,
};

export default wagmiNetworks;
