# iExec Data Protector & iAppGenerator Setup Guide

This document explains how to configure the iExec Data Protector and iAppGenerator for the DeFi Strategy Platform.

## Overview

The platform uses two key iExec components:

1. **Data Protector**: Manages access control and encrypted data storage
2. **iAppGenerator**: Handles TEE (Trusted Execution Environment) execution of strategies

## Architecture

```
User Wallet → Data Protector → Protected Strategy Data
                                      ↓
                              iAppGenerator
                                      ↓
                              TEE Executor (Docker)
                                      ↓
                              Base Mainnet (Execution)
```

## Required Configuration

### 1. Environment Variables

Add these to your `.env.local` file:

```bash
# iExec TEE Configuration (REQUIRED)
NEXT_PUBLIC_IEXEC_APP_ADDRESS=0x... # Deployed iApp address

# Wallet Configuration (for Reown/WalletConnect)
NEXT_PUBLIC_REOWN_PROJECT_ID=your-project-id
```

### 2. Build Your iApp Using iApp Generator

**iApp Generator** is a CLI tool that builds confidential applications for TEE execution.

#### Step 1: Install iApp Generator

```bash
npm install -g @iexec/iapp-generator
# or
npx @iexec/iapp-generator --help
```

#### Step 2: Initialize Your iApp Project

```bash
# Create a new iApp project
npx @iexec/iapp-generator init strategy-executor

cd strategy-executor
```

**📖 Detailed Guide Available**: See `.kiro/specs/defi-strategy-platform/TASK_4.8_IAPP_SETUP_GUIDE.md` for complete step-by-step instructions including:
- Prerequisites checklist
- Code copying procedures
- Entry point implementation template
- Dependency configuration
- Testing instructions
- Troubleshooting guide

#### Step 3: Implement Strategy Executor

Create your TEE application code that:
- Receives protected strategy data
- Decrypts operations using Data Protector
- Executes operations on Base mainnet
- Returns results

See `src/strategies/TEE_EXECUTION_REFERENCE.md` for implementation details and the Task 4.8 guide for complete entry point code.

#### Step 4: Build and Deploy Your iApp

```bash
# Build the iApp (creates Docker image)
npx @iexec/iapp-generator build

# Deploy to iExec (Arbitrum Sepolia testnet)
npx @iexec/iapp-generator deploy --chain 134

# Output will include your app address:
# ✅ App deployed at: 0x1234...5678
```

#### Step 5: Configure Your App Address

```bash
# Add to .env.local
NEXT_PUBLIC_IEXEC_APP_ADDRESS=0x1234...5678
```

### 3. iApp Requirements

Your iApp must:

1. **Accept Protected Data**: Receive encrypted strategy data from Data Protector
2. **Decrypt in TEE**: Use Data Protector SDK to decrypt operations inside the TEE
3. **Execute Operations**: Run strategy operations sequentially (see TEE_EXECUTION_REFERENCE.md)
4. **Blockchain Interaction**: Connect to Base mainnet and execute trades
5. **Return Results**: Output execution results in the expected format

#### Example iApp Entry Point

```typescript
// index.ts (runs in TEE)
import { IExecDataProtector } from '@iexec/dataprotector';

async function main() {
  // 1. Get protected data address from iExec task parameters
  const protectedDataAddress = process.env.IEXEC_DATASET_ADDRESS;
  
  // 2. Initialize Data Protector in TEE
  const dataProtector = new IExecDataProtector(/* TEE provider */);
  
  // 3. Fetch and decrypt protected data (only works in authorized TEE)
  const protectedData = await dataProtector.core.getProtectedData({
    address: protectedDataAddress,
  });
  
  // 4. Parse strategy operations
  const { operations, metadata } = JSON.parse(protectedData[0].data);
  
  // 5. Execute strategy (see TEE_EXECUTION_REFERENCE.md)
  const executor = new StrategyExecutor();
  const result = await executor.execute(operations, getUserConfig());
  
  // 6. Return results
  console.log(JSON.stringify(result));
}

main().catch(console.error);
```

## How It Works

### 1. Strategy Purchase Flow

```typescript
// User purchases a strategy
const result = await strategyService.purchaseStrategy(strategy, userAddress);

// Behind the scenes:
// 1. Strategy operations are serialized
// 2. Data Protector encrypts the operations
// 3. Access is granted to the buyer's wallet
// 4. Protected data address is returned as ownership proof
```

### 2. Strategy Execution Flow

```typescript
// User executes an owned strategy
const result = await strategyService.executeStrategy(strategyId, config);

// Behind the scenes:
// 1. Ownership is verified via Data Protector
// 2. iAppGenerator initializes TEE execution
// 3. TEE Docker container starts
// 4. Protected data is decrypted in TEE
// 5. Operations execute on Base mainnet
// 6. Results are returned to user
```

### 3. Data Protection Details

**What gets encrypted:**
- Strategy operations (buy, sell, open positions, etc.)
- Operation parameters (amounts, prices, thresholds)
- Execution logic and conditions

**What stays public:**
- Strategy metadata (name, description, risk, APR)
- Price in RLC
- Execution results (transactions, PnL)

**Who can access:**
- **Encrypted operations**: Only buyers and the TEE app
- **Metadata**: Everyone (for marketplace display)
- **Execution**: Only buyers (verified by Data Protector)

## Integration with StrategyDataProtectorService

### Initialization

```typescript
import { getStrategyDataProtectorService } from '@/services/StrategyDataProtectorService';

// Get service instance with your deployed iApp address
const service = getStrategyDataProtectorService({
  appAddress: '0x...', // Your deployed iApp address (REQUIRED)
  maxAccessCount: undefined, // Optional: limit executions per purchase
});

// Initialize with wallet provider
await service.initialize(walletProvider);
```

### Purchase Strategy

```typescript
// Purchase a strategy
const result = await service.purchaseStrategy(strategy, buyerAddress);

if (result.success) {
  console.log('Protected data address:', result.protectedDataAddress);
  console.log('Transaction hash:', result.transactionHash);
}
```

### Verify Ownership

```typescript
// Check if user owns a strategy
const ownership = await service.checkStrategyOwnership(strategyId, userAddress);

if (ownership.isOwner) {
  console.log('User owns this strategy');
  console.log('Protected data:', ownership.protectedDataAddress);
}
```

### Get Owned Strategies

```typescript
// Get all strategies owned by user
const ownedStrategyIds = await service.getUserOwnedStrategies(userAddress);
console.log('Owned strategies:', ownedStrategyIds);
```

## Building Your iApp with iApp Generator

### Quick Start Guide

1. **Initialize iApp Project**
   ```bash
   npx @iexec/iapp-generator init my-strategy-executor
   cd my-strategy-executor
   ```

2. **Implement Your TEE Logic**
   
   Edit `src/index.ts` to implement strategy execution:
   
   ```typescript
   // src/index.ts (generated by iApp Generator)
   import { IExecDataProtector } from '@iexec/dataprotector';
   import { StrategyExecutor } from './executor/StrategyExecutor';
   
   async function main() {
     // 1. Get protected data address from iExec task
     const protectedDataAddress = process.env.IEXEC_DATASET_ADDRESS;
     
     // 2. Initialize Data Protector in TEE
     const dataProtector = new IExecDataProtector(/* TEE provider */);
     
     // 3. Fetch and decrypt protected data (only works in authorized TEE)
     const protectedData = await dataProtector.core.getProtectedData({
       address: protectedDataAddress,
     });
     
     // 4. Parse strategy data
     const strategyData = JSON.parse(protectedData[0].data);
     const { operations, metadata } = strategyData;
     
     // 5. Execute strategy operations
     const executor = new StrategyExecutor();
     executor.initialize(operations, getUserConfig());
     const result = await executor.execute();
     
     // 6. Return results (iExec captures stdout)
     console.log(JSON.stringify(result));
   }
   
   main().catch(console.error);
   ```

3. **Build Your iApp**
   ```bash
   # This creates a Docker image and prepares for deployment
   npx @iexec/iapp-generator build
   ```

4. **Deploy to iExec**
   ```bash
   # Deploy to Arbitrum Sepolia testnet
   npx @iexec/iapp-generator deploy --chain 134
   
   # Save the deployed app address
   # Output: ✅ App deployed at: 0x1234...5678
   ```

5. **Configure Your Frontend**
   ```bash
   # Add to .env.local
   echo "NEXT_PUBLIC_IEXEC_APP_ADDRESS=0x1234...5678" >> .env.local
   ```

### 2. Operation Execution

See `src/strategies/TEE_EXECUTION_REFERENCE.md` for detailed operation handlers.

### 3. Blockchain Integration

```typescript
// tee/services/DexService.ts
export class DexService {
  async executeTrade(params: TradeParams): Promise<TradeResult> {
    // Connect to Base mainnet
    const provider = new ethers.providers.JsonRpcProvider(
      'https://mainnet.base.org'
    );
    
    // Execute trade using 1inch, Uniswap, etc.
    // ...
  }
}
```

## Security Considerations

### 1. Data Protection
- All strategy operations are encrypted by Data Protector
- Only authorized wallets (buyers) can access encrypted data
- TEE app is the only entity that can decrypt operations

### 2. Access Control
- Data Protector verifies ownership before execution
- Non-owners cannot execute strategies
- Access grants are stored on-chain (Arbitrum Sepolia)

### 3. TEE Isolation
- Strategy execution happens in isolated TEE environment
- No external access to operation details during execution
- Only final results leave the TEE

### 4. Key Management
- User wallet keys never leave the browser
- TEE uses secure key management for trade execution
- Private keys are never exposed in logs or results

## Testing

### 1. Local Testing (Without TEE)

```typescript
// Use MockStrategy for testing
import { MockStrategy } from '@/strategies/MockStrategy';

const mockStrategy = new MockStrategy(true);
const serialized = mockStrategy.serialize();

// Test serialization/deserialization
console.log('Serialized:', serialized);
```

### 2. TEE Testing (With iExec)

```bash
# Test TEE executor locally
docker build -t strategy-executor:test .
docker run strategy-executor:test

# Deploy to iExec testnet
iexec app deploy --chain 134
```

### 3. Integration Testing

```typescript
// Test full purchase and execution flow
const service = getStrategyDataProtectorService();
await service.initialize(walletProvider);

// Purchase
const purchaseResult = await service.purchaseStrategy(strategy, userAddress);
expect(purchaseResult.success).toBe(true);

// Verify ownership
const ownership = await service.checkStrategyOwnership(strategy.id, userAddress);
expect(ownership.isOwner).toBe(true);
```

## Troubleshooting

### Issue: "Failed to initialize Data Protector"
- **Cause**: Invalid wallet provider or network
- **Solution**: Ensure wallet is connected to Arbitrum Sepolia

### Issue: "Insufficient RLC balance"
- **Cause**: Not enough RLC tokens for purchase
- **Solution**: Get testnet RLC from faucet

### Issue: "TEE app address not configured"
- **Cause**: `NEXT_PUBLIC_IEXEC_APP_ADDRESS` not set
- **Solution**: Build and deploy your iApp using iApp Generator, then set the address

### Issue: "TEE execution failed"
- **Cause**: iApp not properly deployed or not authorized
- **Solution**: Verify your iApp is deployed and the address is correct

### Issue: "Ownership verification failed"
- **Cause**: User hasn't purchased the strategy
- **Solution**: Purchase strategy first via `purchaseStrategy()`

## Next Steps

1. **Install iApp Generator**: `npm install -g @iexec/iapp-generator`
2. **Create iApp Project**: `npx @iexec/iapp-generator init strategy-executor`
3. **Implement TEE Logic**: Add strategy execution code (see TEE_EXECUTION_REFERENCE.md)
4. **Build iApp**: `npx @iexec/iapp-generator build`
5. **Deploy to iExec**: `npx @iexec/iapp-generator deploy --chain 134`
6. **Configure Frontend**: Set `NEXT_PUBLIC_IEXEC_APP_ADDRESS` in `.env.local`
7. **Test Purchase Flow**: Test strategy purchase with testnet RLC
8. **Test Execution**: Verify TEE execution works end-to-end

## Resources

- [iExec Data Protector Docs](https://docs.iex.ec/references/dataProtector)
- [iExec iApp Generator Docs](https://docs.iex.ec/references/iapp-generator)
- [iExec SDK Documentation](https://github.com/iExecBlockchainComputing/iexec-sdk)
- [Data Protector SDK](https://github.com/iExecBlockchainComputing/dataprotector-sdk)
- [TEE Execution Reference](./src/strategies/TEE_EXECUTION_REFERENCE.md)
- [Strategy Builder Guide](./src/types/strategyBuilder.ts)

## Support

For issues or questions:
1. Check the [iExec Discord](https://discord.gg/iexec)
2. Review [Data Protector examples](https://github.com/iExecBlockchainComputing/dataprotector-sdk)
3. See [TEE execution reference](./src/strategies/TEE_EXECUTION_REFERENCE.md)
