/**
 * TEE Entry Point
 * 
 * This is the main entry point for the Trusted Execution Environment (TEE) module.
 * It receives serialized strategy operations and user configuration from iExec,
 * executes them securely within the TEE, and returns sanitized results.
 * 
 * ## Input Format (from iExec)
 * 
 * The TEE receives input through environment variables and stdin:
 * 
 * **Environment Variables:**
 * - `IEXEC_DATASET_ADDRESS`: Address of the protected data (encrypted strategy)
 * - `IEXEC_IN`: Path to input file containing user configuration
 * - `IEXEC_OUT`: Path to output file for execution results
 * 
 * **Input File Structure (JSON):**
 * ```json
 * {
 *   "serializedStrategy": "...",  // Serialized strategy operations
 *   "config": {
 *     "spreadPercentage": 0.5,
 *     "slippageTolerance": 1.0,
 *     "executionMode": "instant",
 *     "capitalAllocation": "1000"
 *   },
 *   "wallet": {
 *     "address": "0x...",
 *     // Secure wallet credentials managed by TEE
 *   },
 *   "network": {
 *     "chainId": 8453,
 *     "rpcUrl": "https://mainnet.base.org",
 *     "contracts": {
 *       "oneInchFusion": "0x...",
 *       "perpetualDex": "0x..."
 *     }
 *   }
 * }
 * ```
 * 
 * ## Output Format (to iExec)
 * 
 * The TEE writes results to the output file specified by `IEXEC_OUT`:
 * 
 * **Success Response:**
 * ```json
 * {
 *   "success": true,
 *   "operationResults": [
 *     {
 *       "success": true,
 *       "operationType": "mock_operation",
 *       "data": { "message": "...", "executedAt": 1234567890 }
 *     }
 *   ],
 *   "totalGasUsed": "123456",
 *   "startTime": 1234567890,
 *   "endTime": 1234567900
 * }
 * ```
 * 
 * **Failure Response:**
 * ```json
 * {
 *   "success": false,
 *   "operationResults": [...],
 *   "totalGasUsed": "123456",
 *   "error": {
 *     "code": "EXECUTION_ERROR",
 *     "message": "Strategy execution failed",
 *     "recoverable": false
 *   },
 *   "startTime": 1234567890,
 *   "endTime": 1234567900
 * }
 * ```
 * 
 * ## Execution Flow
 * 
 * 1. **Read Input**: Parse input from `IEXEC_IN` file
 * 2. **Initialize Executor**: Create StrategyExecutor with serialized operations
 * 3. **Create Context**: Build ExecutionContext with config, wallet, and services
 * 4. **Execute Strategy**: Run operations sequentially in the TEE
 * 5. **Write Output**: Write results to `IEXEC_OUT` file
 * 6. **Exit**: Return appropriate exit code (0 for success, 1 for failure)
 * 
 * ## Security Guarantees
 * 
 * - All strategy operations remain encrypted until execution in TEE
 * - Operation logic and parameters never leave the TEE
 * - Only sanitized results and transaction hashes are returned
 * - Private keys are managed securely within the TEE
 * - All errors are sanitized to prevent strategy logic exposure
 * 
 * @module tee/index
 */

import * as fs from 'fs';
import * as path from 'path';
import { StrategyExecutor } from './executor/StrategyExecutor';
import { ExecutionContext, StrategyConfig, NetworkConfig, SecureWallet } from './executor/ExecutionContext';

/**
 * Input structure received from iExec.
 * Contains serialized strategy, user configuration, wallet, and network details.
 */
interface TEEInput {
  /** Serialized strategy operations (JSON string) */
  serializedStrategy: string;
  
  /** User-provided configuration for strategy execution */
  config: StrategyConfig;
  
  /** Secure wallet information (managed by TEE) */
  wallet: {
    address: string;
    // Additional wallet credentials managed securely by TEE
  };
  
  /** Network configuration for blockchain interactions */
  network: NetworkConfig;
}

/**
 * Main entry point for TEE execution.
 * 
 * This function orchestrates the complete strategy execution lifecycle:
 * 1. Reads input from iExec
 * 2. Initializes the strategy executor
 * 3. Creates execution context
 * 4. Executes the strategy
 * 5. Writes results back to iExec
 * 
 * The function handles all errors gracefully and ensures proper cleanup.
 * All sensitive data remains within the TEE and is never exposed.
 * 
 * @returns Promise that resolves when execution is complete
 * @throws Never throws - all errors are caught and written to output
 */
async function main(): Promise<void> {
  try {
    // Read input file path from environment variable
    // iExec provides this path when launching the TEE container
    const inputPath = process.env.IEXEC_IN || '/iexec_in/input.json';
    const outputPath = process.env.IEXEC_OUT || '/iexec_out/result.json';
    
    console.log('[TEE] Starting strategy execution...');
    console.log('[TEE] Input path:', inputPath);
    console.log('[TEE] Output path:', outputPath);
    
    // Read and parse input data
    const input = readInput(inputPath);
    console.log('[TEE] Input parsed successfully');
    console.log('[TEE] Execution mode:', input.config.executionMode);
    console.log('[TEE] Capital allocation:', input.config.capitalAllocation);
    
    // Initialize the strategy executor with serialized operations
    const executor = new StrategyExecutor();
    executor.initialize(input.serializedStrategy);
    console.log('[TEE] StrategyExecutor initialized');
    
    // Create execution context with wallet, config, and services
    const context = createExecutionContext(input);
    console.log('[TEE] ExecutionContext created');
    console.log('[TEE] Network:', input.network.chainId);
    console.log('[TEE] Wallet:', input.wallet.address);
    
    // Execute the strategy
    console.log('[TEE] Executing strategy...');
    const result = await executor.execute(context);
    console.log('[TEE] Strategy execution completed');
    console.log('[TEE] Success:', result.success);
    console.log('[TEE] Operations executed:', result.operationResults.length);
    console.log('[TEE] Total gas used:', result.totalGasUsed);
    
    // Write results to output file
    writeOutput(outputPath, result);
    console.log('[TEE] Results written to output file');
    
    // Exit with appropriate code
    // 0 = success, 1 = failure
    const exitCode = result.success ? 0 : 1;
    console.log('[TEE] Exiting with code:', exitCode);
    process.exit(exitCode);
    
  } catch (error) {
    // Catch any unexpected errors during execution
    // This ensures we always write a result, even if something goes wrong
    console.error('[TEE] Fatal error during execution:', error);
    
    // Create error result
    const errorResult = {
      success: false,
      operationResults: [],
      totalGasUsed: '0',
      error: {
        code: 'FATAL_ERROR',
        message: 'An unexpected error occurred during strategy execution',
        recoverable: false
      },
      startTime: Date.now(),
      endTime: Date.now()
    };
    
    // Attempt to write error result
    try {
      const outputPath = process.env.IEXEC_OUT || '/iexec_out/result.json';
      writeOutput(outputPath, errorResult);
      console.log('[TEE] Error result written to output file');
    } catch (writeError) {
      console.error('[TEE] Failed to write error result:', writeError);
    }
    
    // Exit with failure code
    process.exit(1);
  }
}

/**
 * Reads and parses input from the iExec input file.
 * 
 * The input file is provided by iExec and contains:
 * - Serialized strategy operations
 * - User configuration
 * - Wallet information
 * - Network configuration
 * 
 * @param inputPath - Path to the input file (provided by iExec)
 * @returns Parsed TEE input data
 * @throws Error if input file cannot be read or parsed
 */
function readInput(inputPath: string): TEEInput {
  try {
    // Read input file
    const inputData = fs.readFileSync(inputPath, 'utf-8');
    
    // Parse JSON
    const input = JSON.parse(inputData) as TEEInput;
    
    // Validate required fields
    if (!input.serializedStrategy) {
      throw new Error('Missing required field: serializedStrategy');
    }
    if (!input.config) {
      throw new Error('Missing required field: config');
    }
    if (!input.wallet) {
      throw new Error('Missing required field: wallet');
    }
    if (!input.network) {
      throw new Error('Missing required field: network');
    }
    
    return input;
    
  } catch (error) {
    console.error('[TEE] Failed to read input:', error);
    throw new Error(
      `Failed to read input file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Writes execution results to the iExec output file.
 * 
 * The output file is read by iExec after execution completes.
 * Results are written as JSON and include:
 * - Success status
 * - Operation results
 * - Gas usage
 * - Errors (if any)
 * 
 * @param outputPath - Path to the output file (provided by iExec)
 * @param result - Execution result to write
 * @throws Error if output file cannot be written
 */
function writeOutput(outputPath: string, result: any): void {
  try {
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write result as JSON
    const resultJson = JSON.stringify(result, null, 2);
    fs.writeFileSync(outputPath, resultJson, 'utf-8');
    
  } catch (error) {
    console.error('[TEE] Failed to write output:', error);
    throw new Error(
      `Failed to write output file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Creates an ExecutionContext from the TEE input.
 * 
 * The ExecutionContext provides:
 * - User configuration
 * - Secure wallet for transaction signing
 * - Network configuration
 * - Shared state map
 * - Access to blockchain services
 * 
 * Note: In a production implementation, this would initialize actual
 * service instances (DexService, PerpetualService, OneInchService).
 * For now, we provide placeholder implementations.
 * 
 * @param input - Parsed TEE input data
 * @returns ExecutionContext for strategy execution
 */
function createExecutionContext(input: TEEInput): ExecutionContext {
  // Create secure wallet instance
  // In production, this would use actual secure key management
  const wallet: SecureWallet = {
    address: input.wallet.address,
    
    async signTransaction(_transaction: any): Promise<string> {
      // Placeholder: In production, this would sign using secure keys
      console.log('[TEE] Signing transaction...');
      return '0x...signed_transaction';
    },
    
    async getBalance(_tokenAddress?: string): Promise<string> {
      // Placeholder: In production, this would query actual balance
      console.log('[TEE] Getting balance...');
      return '1000000000000000000'; // 1 ETH in wei
    }
  };
  
  // Create execution context
  const context: ExecutionContext = {
    config: input.config,
    wallet,
    network: input.network,
    state: new Map<string, any>(),
    
    getDexService() {
      // Placeholder: In production, this would return actual DexService
      return {
        async getFundingRate(pair: string): Promise<number> {
          console.log(`[TEE] Getting funding rate for ${pair}...`);
          return 0.01; // 1% funding rate
        }
      };
    },
    
    getPerpetualService() {
      // Placeholder: In production, this would return actual PerpetualService
      return {
        async openShort(_params: any): Promise<any> {
          console.log('[TEE] Opening short position...');
          return {
            entryPrice: '50000',
            transactionHash: '0x...short_tx',
            gasUsed: '100000'
          };
        },
        
        async closePosition(_position: any): Promise<any> {
          console.log('[TEE] Closing position...');
          return {
            transactionHash: '0x...close_tx',
            gasUsed: '80000'
          };
        }
      };
    },
    
    getOneInchService() {
      // Placeholder: In production, this would return actual OneInchService
      return {
        async executeFusionSwap(_params: any): Promise<any> {
          console.log('[TEE] Executing 1inch Fusion swap...');
          return {
            amountReceived: '1000000',
            executionPrice: '50000',
            transactionHash: '0x...swap_tx',
            gasUsed: '150000'
          };
        }
      };
    }
  };
  
  return context;
}

// Export main for testing purposes
export { main };

// Run the main function only if this is the entry point
// This allows the module to be imported in tests without auto-executing
if (require.main === module) {
  main().catch((error) => {
    console.error('[TEE] Unhandled error:', error);
    process.exit(1);
  });
}
