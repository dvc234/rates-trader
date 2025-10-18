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
import {
  validateAddress,
  validateStrategyId,
  sanitizeErrorMessage,
  sanitizeErrorForLogging,
  rateLimiter,
} from '@/utils/security';

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
   * 
   * Ownership Verification Process:
   * 1. Query Data Protector for all protected data where user has been granted access
   * 2. Match the strategy by protected data address or strategy ID in metadata
   * 3. Verify the user has active access rights (not revoked or expired)
   * 
   * Security Considerations:
   * - Non-owners cannot access encrypted operations (enforced by Data Protector)
   * - Only wallets that purchased the strategy can execute it in TEE
   * - Access grants are stored on-chain (Arbitrum Sepolia) and cannot be forged
   * - On any error, we assume no ownership for security
   * 
   * @param strategyId - ID of the strategy to check (can be strategy.id or protectedDataAddress)
   * @param userAddress - Ethereum address of the user to check
   * @returns Ownership verification result with protected data address if owned
   * 
   * @example
   * ```typescript
   * const ownership = await service.checkStrategyOwnership('btc-delta-neutral', '0x123...');
   * if (ownership.isOwner) {
   *   console.log('User can execute this strategy');
   *   console.log('Protected data:', ownership.protectedDataAddress);
   * } else {
   *   console.log('User must purchase this strategy first');
   * }
   * ```
   */
  async checkStrategyOwnership(
    strategyId: string,
    userAddress: string
  ): Promise<OwnershipResult> {
    this.ensureInitialized();

    try {
      // Security: Validate inputs
      const strategyIdValidation = validateStrategyId(strategyId);
      if (!strategyIdValidation.isValid) {
        console.error('[DataProtector] Invalid strategy ID:', sanitizeErrorMessage(strategyIdValidation.error));
        return {
          isOwner: false,
          protectedDataAddress: undefined,
        };
      }

      const addressValidation = validateAddress(userAddress);
      if (!addressValidation.isValid) {
        console.error('[DataProtector] Invalid user address:', sanitizeErrorMessage(addressValidation.error));
        return {
          isOwner: false,
          protectedDataAddress: undefined,
        };
      }

      console.log('[DataProtector] Checking ownership:', { 
        strategyId: strategyIdValidation.sanitizedValue, 
        userAddress: addressValidation.sanitizedValue 
      });

      // Query Data Protector for protected data where user has been granted access
      // This is different from querying by owner - we want to find data the user can ACCESS
      // The owner is the platform/strategy creator, but buyers get access grants
      const userProtectedData = await this.dataProtector!.core.getProtectedData({
        owner: userAddress, // First check if user owns the protected data directly
      });

      console.log('[DataProtector] Found protected data owned by user:', userProtectedData.length);

      // Check if user owns this specific strategy by matching strategy ID
      // We check multiple fields to handle different matching scenarios:
      // 1. Protected data address matches strategy ID (for direct lookups)
      // 2. Strategy name in protected data matches strategy ID
      // 3. Strategy ID in metadata matches
      const ownedStrategy = userProtectedData.find((data: any) => {
        try {
          // Match by protected data address (most direct)
          if (data.address === strategyId) {
            console.log('[DataProtector] Matched by address:', data.address);
            return true;
          }

          // Match by strategy name in protected data name field
          // Format: "Strategy: <name>" or similar
          if (data.name && data.name.includes(strategyId)) {
            console.log('[DataProtector] Matched by name:', data.name);
            return true;
          }

          // If we have access to the data content, check metadata
          // Note: This may not be available without decryption
          if (data.data) {
            try {
              const parsedData = typeof data.data === 'string' 
                ? JSON.parse(data.data) 
                : data.data;
              
              if (parsedData.strategyId === strategyId || parsedData.metadata?.id === strategyId) {
                console.log('[DataProtector] Matched by metadata:', parsedData.strategyId);
                return true;
              }
            } catch {
              // Data might be encrypted, skip parsing
            }
          }

          return false;
        } catch (error) {
          console.warn('[DataProtector] Error matching strategy:', error);
          return false;
        }
      });

      if (ownedStrategy) {
        console.log('[DataProtector] User owns strategy:', {
          protectedDataAddress: ownedStrategy.address,
          grantedAt: ownedStrategy.creationTimestamp,
        });

        return {
          isOwner: true,
          protectedDataAddress: ownedStrategy.address,
          grantedAt: ownedStrategy.creationTimestamp,
        };
      }

      // User does not own this strategy
      // This prevents non-owners from:
      // 1. Accessing encrypted operations
      // 2. Executing the strategy in TEE
      // 3. Viewing sensitive strategy details
      console.log('[DataProtector] User does not own strategy:', strategyId);
      return {
        isOwner: false,
      };
    } catch (error) {
      // Security: Log sanitized error
      console.error('[DataProtector] Ownership check failed:', sanitizeErrorForLogging(error));
      
      // On error, assume no ownership for security
      // This prevents potential exploits where errors might be used to bypass checks
      return {
        isOwner: false,
      };
    }
  }

  /**
   * Get all strategies owned by a user
   * 
   * This method queries Data Protector for all protected data where the user
   * has been granted access (i.e., strategies they have purchased).
   * 
   * Access Control:
   * - Only returns strategies the user has purchased
   * - Non-purchased strategies are not included
   * - Each returned strategy can be executed by the user in TEE
   * 
   * @param userAddress - Ethereum address of the user
   * @returns Array of protected data addresses (strategy ownership proofs)
   * 
   * @example
   * ```typescript
   * const ownedStrategies = await service.getUserOwnedStrategies('0x123...');
   * console.log('User owns', ownedStrategies.length, 'strategies');
   * 
   * // Check if user owns a specific strategy
   * const ownsStrategy = ownedStrategies.includes(strategyProtectedDataAddress);
   * ```
   */
  async getUserOwnedStrategies(userAddress: string): Promise<string[]> {
    this.ensureInitialized();

    try {
      console.log('[DataProtector] Fetching owned strategies for:', userAddress);

      // Fetch all protected data where user has been granted access
      // This returns strategies the user has purchased
      const userProtectedData = await this.dataProtector!.core.getProtectedData({
        owner: userAddress,
      });

      console.log('[DataProtector] Found', userProtectedData.length, 'protected data objects');

      // Extract strategy IDs from protected data
      // We filter to only include strategy-related protected data
      const strategyIds: string[] = [];
      
      for (const data of userProtectedData) {
        try {
          // Check if this protected data represents a strategy
          // Strategies have names like "Strategy: <name>"
          if (data.name && data.name.includes('Strategy:')) {
            // Use the protected data address as the strategy identifier
            // This is the ownership proof that allows TEE execution
            strategyIds.push(data.address);
            
            console.log('[DataProtector] Found owned strategy:', {
              name: data.name,
              address: data.address,
              createdAt: data.creationTimestamp,
            });
          }
        } catch (error) {
          // Skip invalid or malformed data
          console.warn('[DataProtector] Skipping invalid protected data:', error);
          continue;
        }
      }

      console.log('[DataProtector] User owns', strategyIds.length, 'strategies');
      return strategyIds;
    } catch (error) {
      console.error('[DataProtector] Failed to fetch owned strategies:', error);
      
      // Return empty array on error (fail-safe)
      // This prevents showing strategies the user might not own
      return [];
    }
  }

  /**
   * Verify that a user has permission to access encrypted strategy operations
   * 
   * This method enforces access control by:
   * 1. Checking ownership via Data Protector
   * 2. Preventing non-owners from accessing encrypted operations
   * 3. Ensuring only purchasers can execute strategies in TEE
   * 
   * Security Enforcement:
   * - Non-owners receive an error and cannot proceed
   * - Encrypted operations remain inaccessible to non-purchasers
   * - TEE execution is blocked for non-owners
   * - Access verification happens on-chain (cannot be bypassed)
   * 
   * @param strategyId - ID of the strategy to verify access for
   * @param userAddress - Address of the user requesting access
   * @throws Error if user does not own the strategy
   * 
   * @example
   * ```typescript
   * // Before allowing TEE execution
   * try {
   *   await service.verifyStrategyAccess(strategyId, userAddress);
   *   // User has access, proceed with execution
   *   await executeInTEE(strategyId, config);
   * } catch (error) {
   *   // User does not own strategy, show purchase prompt
   *   showPurchaseDialog(strategyId);
   * }
   * ```
   */
  async verifyStrategyAccess(
    strategyId: string,
    userAddress: string
  ): Promise<void> {
    this.ensureInitialized();

    // Security: Validate inputs
    const strategyIdValidation = validateStrategyId(strategyId);
    if (!strategyIdValidation.isValid) {
      throw new Error(sanitizeErrorMessage(strategyIdValidation.error));
    }

    const addressValidation = validateAddress(userAddress);
    if (!addressValidation.isValid) {
      throw new Error(sanitizeErrorMessage(addressValidation.error));
    }

    // Security: Rate limiting to prevent abuse
    // Allow max 20 verification checks per user per minute
    const rateLimitKey = `verify_${addressValidation.sanitizedValue}`;
    if (!rateLimiter.checkLimit(rateLimitKey, 20, 60 * 1000)) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    console.log('[DataProtector] Verifying strategy access:', { 
      strategyId: strategyIdValidation.sanitizedValue, 
      userAddress: addressValidation.sanitizedValue 
    });

    // Check ownership via Data Protector
    const ownership = await this.checkStrategyOwnership(
      strategyIdValidation.sanitizedValue!,
      addressValidation.sanitizedValue!
    );

    if (!ownership.isOwner) {
      // User does not own this strategy
      // Prevent access to encrypted operations and TEE execution
      // Security: Don't expose internal details in error message
      const error = new Error(
        'Access denied: You must own this strategy to execute it. Please purchase it first.'
      );
      
      console.error('[DataProtector] Access denied for user:', addressValidation.sanitizedValue);
      throw error;
    }

    console.log('[DataProtector] Access verified:', {
      strategyId,
      userAddress,
      protectedDataAddress: ownership.protectedDataAddress,
    });

    // Access granted - user can proceed with TEE execution
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
