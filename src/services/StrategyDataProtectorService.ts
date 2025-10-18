/**
 * StrategyDataProtectorService
 * 
 * Service for managing strategy purchases and access control using iExec Data Protector.
 * This service handles:
 * - Strategy data protection and encryption
 * - Access control (who can execute strategies)
 * - Ownership verification
 * - Integration with iExec Data Protector and iAppGenerator
 * 
 * Architecture:
 * - Data Protector: Manages access control and encrypted data storage
 * - iAppGenerator: Handles protected data for TEE execution
 * - Strategy operations are encrypted and only accessible to purchasers
 * - Metadata (name, price, risk, APR) is publicly readable
 * 
 * iAppGenerator Configuration:
 * - TEE Docker Image: The Docker image containing the strategy executor
 * - App Address: The deployed iExec app address for TEE execution
 * - These are configured via environment variables or passed during initialization
 */

import { IExecDataProtector } from '@iexec/dataprotector';
import type { Strategy } from '@/types/strategy';

/**
 * Configuration for iExec TEE application
 * The iApp must be built using iApp Generator CLI and deployed to iExec
 */
interface TEEAppConfig {
  /** 
   * Deployed iExec app address (REQUIRED)
   * This is the address of the TEE application that can process protected data
   * Must be deployed using iApp Generator CLI before use
   */
  appAddress: string;
  
  /** 
   * Number of times a user can access the protected data (default: unlimited)
   * Set to a specific number to limit executions per purchase
   */
  maxAccessCount?: number;
}

/**
 * Default TEE app configuration
 * In production, these MUST come from environment variables
 * 
 * IMPORTANT: The iApp must be built and deployed using iApp Generator CLI:
 * 1. Build your TEE app: `npx @iexec/iapp-generator init`
 * 2. Deploy to iExec: `npx @iexec/iapp-generator deploy`
 * 3. Set the deployed app address in NEXT_PUBLIC_IEXEC_APP_ADDRESS
 */
const DEFAULT_TEE_CONFIG: TEEAppConfig = {
  // REQUIRED: Deployed iExec app address
  // This app will be authorized to process protected strategy data
  appAddress: process.env.NEXT_PUBLIC_IEXEC_APP_ADDRESS || '',
  
  // Optional: Limit number of executions per purchase
  // undefined = unlimited executions
  maxAccessCount: undefined,
};

/**
 * Result of a strategy purchase transaction
 */
export interface PurchaseResult {
  success: boolean;
  protectedDataAddress?: string; // Address of protected data (ownership proof)
  transactionHash?: string;
  error?: string;
}

/**
 * Result of ownership verification
 */
export interface OwnershipResult {
  isOwner: boolean;
  protectedDataAddress?: string;
  grantedAt?: number;
}

/**
 * Strategy metadata that is publicly readable
 */
interface StrategyMetadata {
  id: string;
  name: string;
  description: string;
  risk: string;
  aprMin: number;
  aprMax: number;
  price: string;
}

/**
 * Protected strategy data structure
 * Contains both public metadata and encrypted operations
 */
interface ProtectedStrategyData {
  metadata: StrategyMetadata;
  encryptedOperations: string; // Encrypted serialized operations
}

/**
 * Service class for managing strategy purchases and access control
 * using iExec Data Protector
 */
export class StrategyDataProtectorService {
  private dataProtector: IExecDataProtector | null = null;
  private isInitialized = false;
  private teeConfig: TEEAppConfig;

  /**
   * Create a new StrategyDataProtectorService instance
   * 
   * @param teeConfig - Optional TEE app configuration (uses defaults if not provided)
   */
  constructor(teeConfig?: Partial<TEEAppConfig>) {
    this.teeConfig = { ...DEFAULT_TEE_CONFIG, ...teeConfig };
  }

  /**
   * Initialize the Data Protector SDK
   * Must be called before using any other methods
   * 
   * @param walletProvider - Web3 provider from connected wallet
   * @throws Error if initialization fails or if TEE app address is not configured
   */
  async initialize(walletProvider: any): Promise<void> {
    try {
      // Validate TEE app configuration
      if (!this.teeConfig.appAddress) {
        throw new Error(
          'TEE app address not configured. Please set NEXT_PUBLIC_IEXEC_APP_ADDRESS. ' +
          'See IEXEC_SETUP.md for instructions on building and deploying your iApp.'
        );
      }

      // Initialize iExec Data Protector with wallet provider
      // Data Protector Core handles data encryption and access control
      this.dataProtector = new IExecDataProtector(walletProvider);
      this.isInitialized = true;
      
      console.log('[DataProtector] Initialized successfully');
      console.log('[DataProtector] TEE App Address:', this.teeConfig.appAddress);
      console.log('[DataProtector] Max Access Count:', this.teeConfig.maxAccessCount || 'unlimited');
    } catch (error) {
      console.error('[DataProtector] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Protect strategy data using Data Protector Core
   * This encrypts the strategy operations and stores them with iExec
   * 
   * How it works:
   * 1. Strategy operations are serialized to JSON
   * 2. Data Protector Core encrypts the data
   * 3. Encrypted data is stored on IPFS
   * 4. Ownership is recorded on-chain (Arbitrum Sepolia)
   * 5. Only authorized users and iApps can decrypt the data
   * 
   * @param strategy - Strategy to protect (must have serialize method)
   * @returns Protected data address (used as ownership proof)
   * @throws Error if protection fails
   */
  private async protectStrategyData(strategy: Strategy & { serialize(): string }): Promise<string> {
    this.ensureInitialized();

    try {
      // Serialize strategy operations for encryption
      const serializedOperations = strategy.serialize();
      
      // Prepare data object for protection
      // DataProtector expects a simple key-value object
      const dataToProtect: Record<string, any> = {
        strategyId: strategy.id,
        strategyName: strategy.name,
        metadata: {
          id: strategy.id,
          name: strategy.name,
          description: strategy.description,
          risk: strategy.risk,
          aprMin: strategy.apr.min,
          aprMax: strategy.apr.max,
          price: strategy.price,
        },
        operations: serializedOperations, // Encrypted operations
      };

      // Use Data Protector Core to encrypt and store the strategy data
      // This creates a protected data object on-chain (Arbitrum Sepolia)
      const result = await this.dataProtector!.core.protectData({
        data: dataToProtect,
        name: `Strategy: ${strategy.name}`,
      });

      console.log('[DataProtector] Strategy data protected:', result.address);
      return result.address;
    } catch (error) {
      console.error('[DataProtector] Failed to protect strategy data:', error);
      throw new Error('Failed to protect strategy data');
    }
  }

  /**
   * Purchase a strategy by granting access to the buyer
   * 
   * Purchase Flow:
   * 1. Protect strategy data (encrypt and store on IPFS)
   * 2. Grant access to BOTH the buyer AND the TEE iApp
   * 3. Record ownership on-chain (Arbitrum Sepolia)
   * 4. Return protected data address as ownership proof
   * 
   * Access Control:
   * - Buyer can read the protected data
   * - TEE iApp can process the protected data
   * - Only the buyer can trigger TEE execution
   * - Access count can be limited (configured in TEEAppConfig)
   * 
   * @param strategy - Strategy to purchase (must have serialize method)
   * @param buyerAddress - Address of the buyer
   * @returns Purchase result with protected data address
   */
  async purchaseStrategy(
    strategy: Strategy & { serialize(): string },
    buyerAddress: string
  ): Promise<PurchaseResult> {
    this.ensureInitialized();

    try {
      console.log('[DataProtector] Starting purchase for strategy:', strategy.id);
      console.log('[DataProtector] Buyer:', buyerAddress);
      console.log('[DataProtector] TEE App:', this.teeConfig.appAddress);

      // Step 1: Protect the strategy data if not already protected
      // In production, strategies would be pre-protected by the platform
      // For MVP, we protect on-demand during purchase
      const protectedDataAddress = await this.protectStrategyData(strategy);

      // Step 2: Grant access to BOTH the buyer AND the TEE iApp
      // This is required for the buyer to execute the strategy in the TEE
      // The TEE iApp needs access to decrypt and process the strategy operations
      const grantResult = await this.dataProtector!.core.grantAccess({
        protectedData: protectedDataAddress,
        authorizedApp: this.teeConfig.appAddress, // TEE iApp that can process the data
        authorizedUser: buyerAddress, // Buyer who can trigger execution
        numberOfAccess: this.teeConfig.maxAccessCount, // Optional: limit executions
      });

      console.log('[DataProtector] Access granted to buyer and TEE app');
      console.log('[DataProtector] Grant details:', grantResult);

      return {
        success: true,
        protectedDataAddress,
        // Note: grantAccess returns the access grant details, not a transaction hash
        // The transaction is executed internally by Data Protector
        transactionHash: undefined,
      };
    } catch (error: any) {
      console.error('[DataProtector] Purchase failed:', error);
      
      // Handle specific error cases
      if (error.message?.includes('insufficient funds')) {
        return {
          success: false,
          error: 'Insufficient RLC balance for purchase',
        };
      }
      
      if (error.message?.includes('user rejected')) {
        return {
          success: false,
          error: 'Transaction rejected by user',
        };
      }

      return {
        success: false,
        error: error.message || 'Purchase failed. Please try again.',
      };
    }
  }

  /**
   * Check if a user owns a specific strategy
   * Queries Data Protector to verify access rights
   * 
   * @param strategyId - ID of the strategy to check
   * @param userAddress - Address of the user
   * @returns Ownership verification result
   */
  async checkStrategyOwnership(
    strategyId: string,
    userAddress: string
  ): Promise<OwnershipResult> {
    this.ensureInitialized();

    try {
      console.log('[DataProtector] Checking ownership:', { strategyId, userAddress });

      // Query Data Protector for user's protected data
      // This returns all protected data objects the user has access to
      const userProtectedData = await this.dataProtector!.core.getProtectedData({
        owner: userAddress,
      });

      // Check if user has access to this specific strategy
      // Match by strategy ID in the protected data
      const ownedStrategy = userProtectedData.find((data: any) => {
        try {
          // Protected data structure: { strategyId, metadata, operations }
          return data.name?.includes(strategyId) || data.address === strategyId;
        } catch {
          return false;
        }
      });

      if (ownedStrategy) {
        return {
          isOwner: true,
          protectedDataAddress: ownedStrategy.address,
          grantedAt: ownedStrategy.creationTimestamp,
        };
      }

      // User does not own this strategy
      return {
        isOwner: false,
      };
    } catch (error) {
      console.error('[DataProtector] Ownership check failed:', error);
      
      // On error, assume no ownership for security
      return {
        isOwner: false,
      };
    }
  }

  /**
   * Get all strategies owned by a user
   * 
   * @param userAddress - Address of the user
   * @returns Array of owned strategy IDs
   */
  async getUserOwnedStrategies(userAddress: string): Promise<string[]> {
    this.ensureInitialized();

    try {
      // Fetch all protected data for the user
      const userProtectedData = await this.dataProtector!.core.getProtectedData({
        owner: userAddress,
      });

      // Extract strategy IDs from protected data
      const strategyIds: string[] = [];
      for (const data of userProtectedData) {
        try {
          // Extract strategy ID from the protected data name
          // Format: "Strategy: <name>" or similar
          if (data.name && data.name.includes('Strategy:')) {
            // For now, use the address as the strategy ID
            // In production, you'd parse the actual strategy ID from the data
            strategyIds.push(data.address);
          }
        } catch {
          // Skip invalid data
          continue;
        }
      }

      return strategyIds;
    } catch (error) {
      console.error('[DataProtector] Failed to fetch owned strategies:', error);
      return [];
    }
  }

  /**
   * Ensure the service is initialized before use
   * @throws Error if not initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized || !this.dataProtector) {
      throw new Error('StrategyDataProtectorService not initialized. Call initialize() first.');
    }
  }

  /**
   * Check if the service is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.dataProtector !== null;
  }

  /**
   * Get the current TEE app configuration
   * Useful for debugging and displaying configuration to users
   */
  getTEEConfig(): TEEAppConfig {
    return { ...this.teeConfig };
  }

  /**
   * Update TEE app configuration
   * Can only be called before initialization
   * 
   * @param config - Partial TEE configuration to update
   * @throws Error if already initialized
   */
  updateTEEConfig(config: Partial<TEEAppConfig>): void {
    if (this.isInitialized) {
      throw new Error('Cannot update TEE config after initialization');
    }
    this.teeConfig = { ...this.teeConfig, ...config };
  }
}

// Singleton instance for use across the application
let serviceInstance: StrategyDataProtectorService | null = null;

/**
 * Get the singleton instance of StrategyDataProtectorService
 * Creates a new instance if one doesn't exist
 * 
 * @param teeConfig - Optional TEE configuration (only used on first call)
 */
export function getStrategyDataProtectorService(
  teeConfig?: Partial<TEEAppConfig>
): StrategyDataProtectorService {
  if (!serviceInstance) {
    serviceInstance = new StrategyDataProtectorService(teeConfig);
  }
  return serviceInstance;
}
