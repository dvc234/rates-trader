/**
 * IExecExecutionService
 * 
 * Service for executing strategies in the iExec Trusted Execution Environment (TEE).
 * This service handles:
 * - Ownership verification via Data Protector
 * - Preparation of encrypted operations for TEE execution
 * - Passing user configuration to the TEE
 * - Triggering TEE execution via iExec SDK
 * - Retrieving and parsing execution results
 * 
 * Architecture:
 * - Data Protector: Verifies user owns the strategy before execution
 * - iExec SDK: Manages TEE task creation and execution
 * - TEE Container: Executes strategy operations securely on Base mainnet
 * - Result Retrieval: Fetches execution results from iExec storage
 * 
 * Security:
 * - Only strategy owners can execute (verified via Data Protector)
 * - Strategy operations remain encrypted until TEE execution
 * - Private keys never leave the TEE environment
 * - Only sanitized results are returned to the user
 */

import type { StrategyConfig, ExecutionResult } from '@/types/strategy';
import type { StrategyDataProtectorService } from './StrategyDataProtectorService';

/**
 * Configuration for iExec TEE execution
 */
interface IExecConfig {
    /**
     * Deployed iExec app address (REQUIRED)
     * This is the TEE application that will execute the strategy
     * Must be deployed using iApp Generator CLI
     */
    appAddress: string;

    /**
     * Maximum gas price willing to pay for execution (in wei)
     * Optional - uses network default if not specified
     */
    maxGasPrice?: string;

    /**
     * Timeout for execution in seconds
     * Default: 300 seconds (5 minutes)
     */
    executionTimeout?: number;
}

/**
 * Default iExec configuration
 * In production, these MUST come from environment variables
 */
const DEFAULT_IEXEC_CONFIG: IExecConfig = {
    appAddress: process.env.NEXT_PUBLIC_IEXEC_APP_ADDRESS || '',
    executionTimeout: 300, // 5 minutes
};

/**
 * Result of a strategy execution request
 */
export interface ExecutionRequestResult {
    success: boolean;
    taskId?: string;
    error?: string;
}

/**
 * Status of a TEE execution task
 */
export interface ExecutionStatus {
    status: 'pending' | 'running' | 'completed' | 'failed';
    taskId: string;
    result?: ExecutionResult;
    error?: string;
}


/**
 * Service class for executing strategies in iExec TEE
 * 
 * This service integrates with:
 * - StrategyDataProtectorService: For ownership verification
 * - iExec SDK: For TEE task management
 * - TEE Container: For secure strategy execution
 */
export class IExecExecutionService {
    private isInitialized = false;
    private iexecConfig: IExecConfig;
    private dataProtectorService: StrategyDataProtectorService | null = null;

    /**
     * Create a new IExecExecutionService instance
     * 
     * @param iexecConfig - Optional iExec configuration (uses defaults if not provided)
     */
    constructor(iexecConfig?: Partial<IExecConfig>) {
        this.iexecConfig = { ...DEFAULT_IEXEC_CONFIG, ...iexecConfig };
    }

    /**
     * Initialize the iExec Execution Service
     * 
     * This method:
     * 1. Validates the iExec app address configuration
     * 2. Stores reference to Data Protector service for ownership checks
     * 3. Prepares the service for strategy execution
     * 
     * @param dataProtectorService - Initialized Data Protector service for ownership verification
     * @throws Error if iExec app address is not configured
     * @throws Error if Data Protector service is not initialized
     */
    async initialize(dataProtectorService: StrategyDataProtectorService): Promise<void> {
        try {
            // Validate iExec app configuration
            if (!this.iexecConfig.appAddress) {
                throw new Error(
                    'iExec app address not configured. Please set NEXT_PUBLIC_IEXEC_APP_ADDRESS. ' +
                    'See IEXEC_SETUP.md for instructions on building and deploying your iApp.'
                );
            }

            // Validate Data Protector service is ready
            if (!dataProtectorService.isReady()) {
                throw new Error(
                    'Data Protector service must be initialized before IExecExecutionService. ' +
                    'Call dataProtectorService.initialize() first.'
                );
            }

            // Store reference to Data Protector service
            // We'll use this to verify ownership before execution
            this.dataProtectorService = dataProtectorService;
            this.isInitialized = true;

            console.log('[IExecExecution] Initialized successfully');
            console.log('[IExecExecution] TEE App Address:', this.iexecConfig.appAddress);
            console.log('[IExecExecution] Execution Timeout:', this.iexecConfig.executionTimeout, 'seconds');
        } catch (error) {
            console.error('[IExecExecution] Initialization failed:', error);
            throw error;
        }
    }


    /**
     * Execute a strategy in the iExec TEE
     * 
     * Execution Flow:
     * 1. Verify user owns the strategy (via Data Protector)
     * 2. Retrieve protected strategy data address
     * 3. Prepare execution input (config + protected data reference)
     * 4. Create iExec task to execute strategy in TEE
     * 5. Return task ID for status tracking
     * 
     * The TEE will:
     * - Decrypt the protected strategy operations
     * - Execute operations sequentially on Base mainnet
     * - Return sanitized results (transactions, PnL, gas used)
     * 
     * Security:
     * - Only verified owners can execute strategies
     * - Strategy operations remain encrypted until TEE execution
     * - User configuration is passed securely to TEE
     * - Private keys are managed within TEE (never exposed)
     * 
     * @param strategyId - ID of the strategy to execute
     * @param userAddress - Address of the user executing the strategy
     * @param config - User configuration for strategy execution
     * @returns Execution request result with task ID for tracking
     * 
     * @example
     * ```typescript
     * const result = await service.executeStrategy(
     *   'btc-delta-neutral',
     *   '0x123...',
     *   {
     *     executionMode: 'instant',
     *     slippageTolerance: 1.0,
     *     capitalAllocation: '1000'
     *   }
     * );
     * 
     * if (result.success) {
     *   console.log('Task ID:', result.taskId);
     *   // Poll for results using getExecutionStatus(result.taskId)
     * }
     * ```
     */
    async executeStrategy(
        strategyId: string,
        userAddress: string,
        config: StrategyConfig
    ): Promise<ExecutionRequestResult> {
        this.ensureInitialized();

        try {
            console.log('[IExecExecution] Starting strategy execution:', {
                strategyId,
                userAddress,
                executionMode: config.executionMode,
                capitalAllocation: config.capitalAllocation,
            });

            // Step 1: Verify ownership via Data Protector
            // This ensures only strategy owners can execute
            // Throws error if user doesn't own the strategy
            console.log('[IExecExecution] Verifying strategy ownership...');
            await this.dataProtectorService!.verifyStrategyAccess(strategyId, userAddress);
            console.log('[IExecExecution] Ownership verified');

            // Step 2: Get protected data address for this strategy
            // This address references the encrypted strategy operations
            // The TEE will use this to decrypt and execute the strategy
            console.log('[IExecExecution] Retrieving protected data address...');
            const ownership = await this.dataProtectorService!.checkStrategyOwnership(
                strategyId,
                userAddress
            );

            if (!ownership.protectedDataAddress) {
                throw new Error('Protected data address not found for strategy');
            }

            console.log('[IExecExecution] Protected data address:', ownership.protectedDataAddress);

            // Step 3: Prepare TEE input data
            // This includes user configuration and reference to protected data
            const teeInput = this.prepareTEEInput(
                ownership.protectedDataAddress,
                config,
                userAddress
            );

            console.log('[IExecExecution] TEE input prepared');

            // Step 4: Create iExec task for TEE execution
            // In production, this would use the actual iExec SDK
            // For now, we return a mock task ID
            const taskId = await this.createIExecTask(teeInput);

            console.log('[IExecExecution] iExec task created:', taskId);

            return {
                success: true,
                taskId,
            };
        } catch (error: any) {
            console.error('[IExecExecution] Execution failed:', error);

            // Handle specific error cases
            if (error.message?.includes('does not own strategy')) {
                return {
                    success: false,
                    error: 'You must own this strategy to execute it. Please purchase it first.',
                };
            }

            if (error.message?.includes('insufficient funds')) {
                return {
                    success: false,
                    error: 'Insufficient RLC balance for execution',
                };
            }

            return {
                success: false,
                error: error.message || 'Strategy execution failed. Please try again.',
            };
        }
    }


    /**
     * Prepare input data for TEE execution
     * 
     * This method creates the input structure that will be passed to the TEE.
     * The TEE expects:
     * - protectedDataAddress: Reference to encrypted strategy operations
     * - config: User configuration (execution mode, slippage, capital)
     * - userAddress: Wallet address for transaction signing
     * - network: Network configuration (Base mainnet)
     * 
     * Data Flow:
     * 1. Frontend calls executeStrategy() with config
     * 2. This method prepares TEE input structure
     * 3. iExec SDK passes input to TEE container
     * 4. TEE decrypts strategy using protectedDataAddress
     * 5. TEE executes with user config on Base mainnet
     * 
     * @param protectedDataAddress - Address of encrypted strategy data
     * @param config - User execution configuration
     * @param userAddress - User's wallet address
     * @returns Formatted input for TEE execution
     */
    private prepareTEEInput(
        protectedDataAddress: string,
        config: StrategyConfig,
        userAddress: string
    ): any {
        // Prepare network configuration for Base mainnet
        // The TEE will use this to connect to the blockchain
        const networkConfig = {
            chainId: 8453, // Base mainnet
            rpcUrl: 'https://mainnet.base.org',
            contracts: {
                // Contract addresses for DEX interactions
                // These would be configured based on the protocols used
                oneInchFusion: process.env.NEXT_PUBLIC_ONEINCH_FUSION_ADDRESS || '',
                perpetualDex: process.env.NEXT_PUBLIC_PERPETUAL_DEX_ADDRESS || '',
            },
        };

        // Create TEE input structure
        // This matches the format expected by tee/index.ts
        const teeInput = {
            // Reference to encrypted strategy data
            // TEE will use Data Protector to decrypt this
            protectedDataAddress,

            // User configuration for execution
            config: {
                spreadPercentage: config.spreadPercentage,
                slippageTolerance: config.slippageTolerance,
                executionMode: config.executionMode,
                capitalAllocation: config.capitalAllocation,
            },

            // Wallet information
            // In production, the TEE would have secure key management
            wallet: {
                address: userAddress,
            },

            // Network configuration
            network: networkConfig,
        };

        console.log('[IExecExecution] TEE input structure:', {
            protectedDataAddress,
            executionMode: config.executionMode,
            capitalAllocation: config.capitalAllocation,
            network: networkConfig.chainId,
        });

        return teeInput;
    }


    /**
     * Create an iExec task for TEE execution
     * 
     * This method integrates with the iExec SDK to:
     * 1. Initialize iExec SDK with wallet provider
     * 2. Create a new task with the TEE app
     * 3. Pass input data to the TEE
     * 4. Return task ID for tracking
     * 
     * iExec SDK Integration:
     * - Uses IExec class from @iexec/iexec SDK
     * - Specifies the deployed TEE app address
     * - Provides input data as dataset
     * - Configures task parameters (timeout, gas, etc.)
     * 
     * Task Lifecycle:
     * 1. Task created (returns task ID)
     * 2. Task assigned to worker
     * 3. TEE container starts
     * 4. Strategy executes in TEE
     * 5. Results written to iExec storage
     * 6. Task marked as completed
     * 
     * @param teeInput - Prepared input data for TEE
     * @returns Task ID for tracking execution status
     * 
     * @example Production Implementation:
     * ```typescript
     * import { IExec } from '@iexec/iexec';
     * 
     * const iexec = new IExec({ ethProvider: window.ethereum });
     * const taskId = await iexec.task.run({
     *   app: this.iexecConfig.appAddress,
     *   dataset: JSON.stringify(teeInput),
     *   params: {
     *     iexec_args: '--input /iexec_in/iexec_in.json',
     *   },
     * });
     * ```
     */
    private async createIExecTask(teeInput: any): Promise<string> {
        try {
            console.log('[IExecExecution] Creating iExec task...');
            console.log('[IExecExecution] App address:', this.iexecConfig.appAddress);

            // TODO: Integrate with actual iExec SDK
            // This is a placeholder implementation
            // In production, this would:
            // 1. Import IExec SDK: import { IExec } from '@iexec/iexec';
            // 2. Initialize with wallet: const iexec = new IExec({ ethProvider });
            // 3. Create task: const { taskid } = await iexec.task.run({ ... });
            // 4. Return task ID: return taskid;

            // For now, generate a mock task ID
            // This allows testing the service without a deployed iApp
            const mockTaskId = `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;

            console.log('[IExecExecution] Mock task created:', mockTaskId);
            console.log('[IExecExecution] TEE input size:', JSON.stringify(teeInput).length, 'bytes');

            // In production, uncomment this code:
            /*
            const { IExec } = await import('@iexec/iexec');
            const iexec = new IExec({
              ethProvider: window.ethereum,
            });
      
            const { taskid } = await iexec.task.run({
              app: this.iexecConfig.appAddress,
              dataset: JSON.stringify(teeInput),
              params: {
                iexec_args: '--input /iexec_in/iexec_in.json',
              },
              tag: ['tee', 'scone'], // TEE execution tags
              trust: 1, // Minimum trust level
              callback: undefined, // Optional callback address
            });
      
            return taskid;
            */

            return mockTaskId;
        } catch (error) {
            console.error('[IExecExecution] Failed to create iExec task:', error);
            throw new Error(
                `Failed to create iExec task: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }


    /**
     * Get the status of a TEE execution task
     * 
     * This method queries iExec to check the status of a running task and provides
     * real-time updates on execution progress. It handles all task lifecycle states
     * and retrieves results when execution completes.
     * 
     * Status Polling Strategy:
     * - Frontend should poll this method periodically (recommended: 5-10 seconds)
     * - Continue polling while status is 'pending' or 'running'
     * - Stop polling when status reaches 'completed' or 'failed'
     * - Implement exponential backoff for long-running tasks
     * 
     * Task Lifecycle States:
     * 1. 'pending': Task created, waiting for worker assignment
     * 2. 'running': Task assigned to worker, TEE container executing strategy
     * 3. 'completed': Execution finished successfully, results available
     * 4. 'failed': Execution failed, error message available
     * 
     * State Transitions:
     * - pending → running: Worker assigned, TEE container starting
     * - running → completed: Strategy executed successfully, results written
     * - running → failed: Execution error, rollback attempted
     * - pending → failed: Task initialization failed (rare)
     * 
     * Result Retrieval:
     * - When status is 'completed', result field contains full ExecutionResult
     * - Result includes: success flag, executed operations, transaction hashes, gas used
     * - Results are fetched from iExec storage and parsed automatically
     * - Failed executions include sanitized error messages (no strategy logic exposed)
     * 
     * Error Handling:
     * - Network errors: Returns 'failed' status with error message
     * - Invalid task ID: Returns 'failed' status
     * - Timeout: Task may still be running, continue polling
     * - TEE errors: Sanitized error message in result
     * 
     * @param taskId - ID of the task to check (returned from executeStrategy)
     * @returns Current execution status with results if completed
     * @throws Never throws - all errors are captured in ExecutionStatus
     * 
     * @example
     * ```typescript
     * // Simple polling implementation
     * const pollStatus = async (taskId: string) => {
     *   const status = await service.getExecutionStatus(taskId);
     *   
     *   if (status.status === 'completed') {
     *     console.log('Execution completed:', status.result);
     *     return status.result;
     *   } else if (status.status === 'failed') {
     *     console.error('Execution failed:', status.error);
     *     throw new Error(status.error);
     *   } else {
     *     // Still running, poll again after 5 seconds
     *     await new Promise(resolve => setTimeout(resolve, 5000));
     *     return pollStatus(taskId);
     *   }
     * };
     * 
     * // Polling with exponential backoff
     * const pollWithBackoff = async (taskId: string, attempt = 0) => {
     *   const status = await service.getExecutionStatus(taskId);
     *   
     *   if (status.status === 'completed' || status.status === 'failed') {
     *     return status;
     *   }
     *   
     *   // Exponential backoff: 5s, 10s, 20s, max 30s
     *   const delay = Math.min(5000 * Math.pow(2, attempt), 30000);
     *   await new Promise(resolve => setTimeout(resolve, delay));
     *   return pollWithBackoff(taskId, attempt + 1);
     * };
     * ```
     */
    async getExecutionStatus(taskId: string): Promise<ExecutionStatus> {
        this.ensureInitialized();

        try {
            console.log('[IExecExecution] Checking task status:', taskId);

            // Validate task ID format
            if (!taskId || !taskId.startsWith('0x')) {
                console.error('[IExecExecution] Invalid task ID format:', taskId);
                return {
                    status: 'failed',
                    taskId,
                    error: 'Invalid task ID format',
                };
            }

            // TODO: Integrate with actual iExec SDK
            // This is a placeholder implementation for development/testing
            // In production, this would query the iExec network for real task status

            // For now, return mock status based on task age
            // This simulates the task lifecycle for testing purposes
            const mockStatus = this.getMockTaskStatus(taskId);

            console.log('[IExecExecution] Task status:', mockStatus.status);

            if (mockStatus.result) {
                console.log('[IExecExecution] Execution result:', {
                    success: mockStatus.result.success,
                    operations: mockStatus.result.executedOperations,
                    positions: mockStatus.result.metrics?.positions?.length || 0,
                    spotTrades: mockStatus.result.metrics?.spotTrades?.length || 0,
                });
            }

            return mockStatus;

            // Production implementation (uncomment when iExec SDK is integrated):
            /*
            const { IExec } = await import('@iexec/iexec');
            const iexec = new IExec({
              ethProvider: window.ethereum,
            });
      
            // Query iExec for task details
            console.log('[IExecExecution] Querying iExec network for task:', taskId);
            const task = await iexec.task.show(taskId);
            
            // Map iExec status codes to our status enum
            // iExec status codes:
            // 0 = UNSET (pending)
            // 1 = ACTIVE (running)
            // 2 = REVEALING (running)
            // 3 = COMPLETED (completed)
            // 4 = FAILED (failed)
            // 5 = TIMEOUT (failed)
            let status: ExecutionStatus['status'];
            
            // State transition: pending → running → completed/failed
            if (task.status === 0) {
              // Task created, waiting for worker assignment
              status = 'pending';
              console.log('[IExecExecution] Task pending, waiting for worker assignment');
            } else if (task.status === 1 || task.status === 2) {
              // Task assigned to worker, TEE container executing
              status = 'running';
              console.log('[IExecExecution] Task running, TEE executing strategy');
            } else if (task.status === 3) {
              // Execution completed successfully
              status = 'completed';
              console.log('[IExecExecution] Task completed successfully');
            } else {
              // Execution failed or timed out
              status = 'failed';
              console.log('[IExecExecution] Task failed:', task.statusName);
            }
      
            // If completed, fetch and parse results from iExec storage
            if (status === 'completed') {
              try {
                const resultUrl = task.results?.storage || '';
                if (!resultUrl) {
                  throw new Error('No result URL available');
                }
      
                console.log('[IExecExecution] Fetching results from:', resultUrl);
                const response = await fetch(resultUrl);
                
                if (!response.ok) {
                  throw new Error(`Failed to fetch results: ${response.statusText}`);
                }
      
                const resultData = await response.json();
                
                // Validate result structure
                if (!resultData || typeof resultData.success !== 'boolean') {
                  throw new Error('Invalid result format');
                }
      
                console.log('[IExecExecution] Results retrieved successfully');
                
                return {
                  status: 'completed',
                  taskId,
                  result: resultData as ExecutionResult,
                };
              } catch (error) {
                console.error('[IExecExecution] Failed to fetch results:', error);
                
                // Return failed status if we can't retrieve results
                return {
                  status: 'failed',
                  taskId,
                  error: `Execution completed but failed to retrieve results: ${
                    error instanceof Error ? error.message : 'Unknown error'
                  }`,
                };
              }
            }
      
            // If failed, extract error message from task
            if (status === 'failed') {
              const errorMessage = task.statusName || 'Task execution failed';
              console.log('[IExecExecution] Task failed with error:', errorMessage);
              
              return {
                status: 'failed',
                taskId,
                error: errorMessage,
              };
            }
      
            // Still pending or running - return current status
            return {
              status,
              taskId,
            };
            */
        } catch (error) {
            console.error('[IExecExecution] Failed to get task status:', error);

            // Never throw - always return a status object
            // This ensures the UI can handle errors gracefully
            return {
                status: 'failed',
                taskId,
                error: error instanceof Error ? error.message : 'Failed to get task status',
            };
        }
    }

    /**
     * Mock task status for development/testing
     * Simulates task lifecycle based on task creation time
     * 
     * Simulation Logic:
     * - 0-10s: pending (waiting for worker)
     * - 10-30s: running (TEE executing)
     * - 30s+: completed (results available)
     * 
     * This allows testing the UI without a deployed iApp
     * 
     * Task ID Format:
     * - Expected format: 0x[timestamp_hex][random_hex]
     * - Timestamp is extracted from the first 8-12 hex characters after 0x
     * 
     * @param taskId - Task ID (contains timestamp)
     * @returns Simulated execution status
     */
    private getMockTaskStatus(taskId: string): ExecutionStatus {
        try {
            // Extract timestamp from task ID
            // Task IDs created by createIExecTask have format: 0x[timestamp][random]
            // We need to extract the timestamp portion (first 8-12 hex chars)
            const hexPart = taskId.slice(2); // Remove '0x' prefix

            // Try to extract timestamp from the beginning of the hex string
            // Timestamps are typically 10-12 hex digits (40-48 bits)
            let timestamp: number;

            // Try parsing different lengths to find valid timestamp
            for (let len = 8; len <= Math.min(12, hexPart.length); len++) {
                const timestampHex = hexPart.slice(0, len);
                const parsed = parseInt(timestampHex, 16);

                // Check if this looks like a valid timestamp (within reasonable range)
                // Valid timestamps should be close to current time
                const now = Date.now();
                const diff = Math.abs(now - parsed);

                // If difference is less than 1 hour, this is likely the timestamp
                if (diff < 3600000) {
                    timestamp = parsed;
                    break;
                }
            }

            // If we couldn't find a valid timestamp, use current time
            // This will result in 'pending' status
            if (!timestamp!) {
                timestamp = Date.now();
            }

            // Calculate task age
            const age = Date.now() - timestamp;

            // Simulate state transitions based on task age
            if (age < 10000) {
                // 0-10 seconds: pending (waiting for worker assignment)
                return {
                    status: 'pending',
                    taskId,
                };
            } else if (age < 30000) {
                // 10-30 seconds: running (TEE executing strategy)
                return {
                    status: 'running',
                    taskId,
                };
            } else {
                // 30+ seconds: completed with mock results
                return {
                    status: 'completed',
                    taskId,
                    result: {
                        success: true,
                        executedOperations: 3,
                        metrics: {
                            gasUsed: '0.0025',
                            profitEstimate: 125.50,
                            fundingRates: {
                                'BTC/USD': 0.0001,
                            },
                            positions: [
                                {
                                    type: 'short',
                                    ticker: 'BTC/USD',
                                    entryPrice: '45000',
                                    size: '0.1',
                                    leverage: 1,
                                    transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
                                },
                            ],
                            spotTrades: [
                                {
                                    type: 'buy',
                                    ticker: 'BTC/USDC',
                                    asset: 'BTC',
                                    amount: '0.1',
                                    executionPrice: '45000',
                                    transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
                                },
                            ],
                        },
                    },
                };
            }
        } catch (error) {
            // If we can't parse the task ID, return failed status
            return {
                status: 'failed',
                taskId,
                error: 'Invalid task ID format',
            };
        }
    }


    /**
     * Ensure the service is initialized before use
     * @throws Error if not initialized
     */
    private ensureInitialized(): void {
        if (!this.isInitialized || !this.dataProtectorService) {
            throw new Error(
                'IExecExecutionService not initialized. Call initialize() with Data Protector service first.'
            );
        }
    }

    /**
     * Check if the service is initialized and ready to use
     * @returns True if initialized, false otherwise
     */
    isReady(): boolean {
        return this.isInitialized && this.dataProtectorService !== null;
    }

    /**
     * Get the current iExec configuration
     * Useful for debugging and displaying configuration to users
     * @returns Current iExec configuration
     */
    getConfig(): IExecConfig {
        return { ...this.iexecConfig };
    }

    /**
     * Update iExec configuration
     * Can only be called before initialization
     * 
     * @param config - Partial iExec configuration to update
     * @throws Error if already initialized
     */
    updateConfig(config: Partial<IExecConfig>): void {
        if (this.isInitialized) {
            throw new Error('Cannot update iExec config after initialization');
        }
        this.iexecConfig = { ...this.iexecConfig, ...config };
    }
}

// Singleton instance for use across the application
let serviceInstance: IExecExecutionService | null = null;

/**
 * Get the singleton instance of IExecExecutionService
 * Creates a new instance if one doesn't exist
 * 
 * @param iexecConfig - Optional iExec configuration (only used on first call)
 * @returns Singleton service instance
 * 
 * @example
 * ```typescript
 * // Get service instance
 * const executionService = getIExecExecutionService({
 *   appAddress: '0x...',
 *   executionTimeout: 600,
 * });
 * 
 * // Initialize with Data Protector service
 * const dataProtectorService = getStrategyDataProtectorService();
 * await dataProtectorService.initialize(walletProvider);
 * await executionService.initialize(dataProtectorService);
 * 
 * // Execute strategy
 * const result = await executionService.executeStrategy(
 *   strategyId,
 *   userAddress,
 *   config
 * );
 * ```
 */
export function getIExecExecutionService(
    iexecConfig?: Partial<IExecConfig>
): IExecExecutionService {
    if (!serviceInstance) {
        serviceInstance = new IExecExecutionService(iexecConfig);
    }
    return serviceInstance;
}
