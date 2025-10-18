/**
 * Protocol Configuration
 * Defines the DEX and protocol integrations for strategy execution
 */

/**
 * Protocol identifiers used in strategy operations
 */
export enum Protocol {
  // Spot Trading
  ONE_INCH_FUSION = '1inch-fusion',
  
  // Perpetual Trading
  SYNTHETIX_V3 = 'synthetix-v3',
}

/**
 * Protocol metadata and configuration
 */
export interface ProtocolConfig {
  /** Protocol identifier */
  id: Protocol;
  
  /** Display name */
  name: string;
  
  /** Protocol type */
  type: 'spot' | 'perpetual' | 'both';
  
  /** Supported networks */
  networks: string[];
  
  /** Contract addresses by network */
  addresses?: Record<string, string>;
  
  /** Protocol documentation URL */
  docsUrl?: string;
}

/**
 * Protocol configurations for Base network
 */
export const PROTOCOL_CONFIGS: Record<Protocol, ProtocolConfig> = {
  [Protocol.ONE_INCH_FUSION]: {
    id: Protocol.ONE_INCH_FUSION,
    name: '1inch Fusion',
    type: 'spot',
    networks: ['base', 'ethereum', 'arbitrum', 'optimism'],
    docsUrl: 'https://docs.1inch.io/docs/fusion-swap/introduction',
  },
  
  [Protocol.SYNTHETIX_V3]: {
    id: Protocol.SYNTHETIX_V3,
    name: 'Synthetix v3',
    type: 'perpetual',
    networks: ['base', 'ethereum', 'optimism', 'arbitrum'],
    addresses: {
      // Base network addresses (update with actual addresses)
      base: '0x...', // Synthetix v3 Core System
    },
    docsUrl: 'https://docs.synthetix.io/v/v3/',
  },
};

/**
 * Get protocol configuration by ID
 */
export function getProtocolConfig(protocolId: string): ProtocolConfig | undefined {
  return PROTOCOL_CONFIGS[protocolId as Protocol];
}

/**
 * Get all protocols by type
 */
export function getProtocolsByType(type: 'spot' | 'perpetual' | 'both'): ProtocolConfig[] {
  return Object.values(PROTOCOL_CONFIGS).filter(
    config => config.type === type || config.type === 'both'
  );
}

/**
 * Check if protocol is supported on network
 */
export function isProtocolSupported(protocolId: string, network: string): boolean {
  const config = getProtocolConfig(protocolId);
  return config?.networks.includes(network) ?? false;
}
