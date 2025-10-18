/**
 * Wagmi Configuration with Reown AppKit Integration
 * 
 * This module configures the Web3 wallet connection infrastructure for the DeFi Strategy Platform.
 * It integrates Reown's AppKit (formerly WalletConnect) with wagmi to provide:
 * - Multi-chain wallet connections
 * - Network switching capabilities
 * - Transaction signing across supported networks
 * 
 * Architecture:
 * - WagmiAdapter: Core wagmi configuration wrapped in Reown's adapter
 * - AppKit Modal: User-facing wallet connection interface
 * - HTTP Transports: RPC connections for each supported network
 * 
 * Usage:
 * - The wagmiAdapter is consumed by the WagmiProvider in src/context/index.tsx
 * - The AppKit modal is automatically available throughout the app for wallet connections
 * - Users can connect wallets and switch between Arbitrum Sepolia, Arbitrum One, and Bellecour
 */

import { http } from '@wagmi/core'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { createAppKit } from '@reown/appkit/react';
import wagmiNetworks from './wagmiNetworks';
import { AppKitNetwork } from '@reown/appkit/networks';

/**
 * Reown Project ID
 * 
 * Required for AppKit (WalletConnect) integration.
 * Obtain your project ID from: https://cloud.reown.com
 * 
 * Environment Variable: NEXT_PUBLIC_REOWN_PROJECT_ID
 * - Must be prefixed with NEXT_PUBLIC_ to be accessible in the browser
 * - Set in .env.local for local development
 * - Configure in deployment environment for production
 */
export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID

if (!projectId) {
  throw new Error('You need to provide NEXT_PUBLIC_REOWN_PROJECT_ID env variable');
}

/**
 * Network Array for AppKit
 * 
 * Converts the wagmiNetworks object into an array format required by AppKit.
 * TypeScript tuple type ensures at least one network is present.
 * 
 * Networks included:
 * - Bellecour (iExec Sidechain): For Data Protector and TEE operations
 * - Arbitrum Sepolia: For testnet RLC payments and development
 * - Arbitrum One: For mainnet RLC payments (future use)
 */
const networks = Object.values(wagmiNetworks) as [
  AppKitNetwork,
  ...AppKitNetwork[],
];

/**
 * Wagmi Adapter Configuration
 * 
 * The WagmiAdapter wraps wagmi's core configuration with Reown AppKit compatibility.
 * 
 * Configuration Options:
 * - networks: Array of supported blockchain networks
 * - transports: HTTP RPC connections for each network (using default public RPCs)
 * - projectId: Reown project identifier for WalletConnect
 * - ssr: true - Enables server-side rendering support for Next.js
 * 
 * Transport Configuration:
 * - Uses http() transport for each network (public RPC endpoints)
 * - Maps network.id to http() transport for automatic network routing
 * - Can be customized with private RPC URLs for better performance
 * 
 * The wagmiAdapter.wagmiConfig property provides the underlying wagmi Config
 * that is passed to WagmiProvider in the app's context.
 */
export const wagmiAdapter = new WagmiAdapter({
  networks: networks,
  transports: Object.fromEntries(
    Object.values(wagmiNetworks).map((network) => [network.id, http()])
  ),
  projectId,
  ssr: true, // Enable server-side rendering for Next.js
});

/**
 * AppKit Modal Configuration
 * 
 * Creates the wallet connection modal UI that users interact with.
 * This is a singleton that's initialized once and available throughout the app.
 * 
 * Configuration Options:
 * - adapters: [wagmiAdapter] - Connects AppKit to wagmi configuration
 * - networks: Supported blockchain networks for wallet connection
 * - projectId: Reown project ID for WalletConnect functionality
 * 
 * Feature Flags:
 * - email: false - Disables email-based wallet creation (not needed for this platform)
 * - socials: false - Disables social login options (not needed for this platform)
 * 
 * UI Customization:
 * - allWallets: 'HIDE' - Hides the "All Wallets" section for cleaner UI
 * - allowUnsupportedChain: false - Prevents connections to unsupported networks
 * - enableWalletGuide: false - Disables the wallet setup guide
 * 
 * User Flow:
 * 1. User clicks connect wallet button (rendered by AppKit components)
 * 2. Modal appears with wallet options (MetaMask, WalletConnect, etc.)
 * 3. User selects wallet and approves connection
 * 4. App verifies user is on correct network (Arbitrum Sepolia for payments)
 * 5. User can switch networks via the modal when needed
 */
createAppKit({
  adapters: [wagmiAdapter],
  networks: networks,
  projectId,
  features: {
    email: false, // Disable email wallet creation
    socials: false, // Disable social login options
  },
  allWallets: 'HIDE', // Hide "All Wallets" section for cleaner UI
  allowUnsupportedChain: false, // Prevent unsupported network connections
  enableWalletGuide: false, // Disable wallet setup guide
});

