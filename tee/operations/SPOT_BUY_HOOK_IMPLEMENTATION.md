# SpotBuyOperation Hook/Callback Implementation

## Overview

The `SpotBuyOperation` implements a hook/callback mechanism to ensure the spot buy only executes after the short position is confirmed on-chain. This creates a proper delta-neutral position by guaranteeing the spot buy references the actual confirmed short entry price.

## Architecture

### Hook Pattern

The operation uses a two-phase hook pattern:

1. **Trigger Phase**: Wait for short position transaction confirmation
2. **Callback Phase**: Execute spot buy via 1inch Fusion resolver network

```
┌─────────────────────────────────────────────────────────────┐
│                    SpotBuyOperation Flow                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  1. Retrieve Short Position       │
        │     from ExecutionContext         │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  2. Wait for Transaction          │
        │     Confirmation (HOOK TRIGGER)   │
        │     - Monitor blockchain          │
        │     - Wait for confirmations      │
        │     - Read confirmed entry price  │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  3. Calculate Capital Amount      │
        │     based on percentage           │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  4. Create 1inch Fusion Order     │
        │     (CALLBACK MECHANISM)          │
        │                                   │
        │  Market Order:                    │
        │  - Execute immediately            │
        │                                   │
        │  Limit Order:                     │
        │  - Use confirmed price as target  │
        │  - Fusion resolver monitors       │
        │  - Auto-executes when matched     │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  5. Store Order Details           │
        │     in ExecutionContext           │
        └───────────────────────────────────┘
```

## Implementation Details

### 1. Transaction Confirmation Hook

The `waitForShortConfirmation()` method implements the hook trigger:

```typescript
private async waitForShortConfirmation(
  context: ExecutionContext,
  transactionHash: string
): Promise<string>
```

**Purpose**: 
- Wait for the short position transaction to be confirmed on-chain
- Read the actual confirmed entry price from the blockchain
- Ensure we reference real data, not estimates

**Implementation**:
- Uses the wallet's provider to monitor transaction status
- Waits for configured number of confirmations (typically 1-3)
- Parses transaction receipt to extract entry price
- Times out after reasonable period to prevent hanging

### 2. 1inch Fusion Smart Contract Predicate as Callback Mechanism

1inch Fusion uses **smart contract predicates** to implement conditional orders:

**How it works**:
1. TEE deploys/uses `FusionTriggerPredicate` smart contract
2. Operation creates Fusion order with predicate contract address
3. Predicate contract checks if short position is confirmed on-chain
4. Fusion resolvers call predicate function to check if order can execute
5. When predicate returns `true`, resolvers execute the spot buy order

**Smart Contract Predicate**:
```solidity
contract FusionTriggerPredicate {
    function checkShortPositionConfirmed(
        address user,
        bytes32 positionId,
        uint256 expectedEntryPrice
    ) external view returns (bool canExecute, uint256 actualEntryPrice) {
        // Check if position exists and is confirmed
        // Check if sufficient blocks have passed
        // Verify entry price is within acceptable range
        // Return true if all checks pass
    }
}
```

**Benefits**:
- **Trustless**: Predicate logic runs on-chain, fully transparent
- **Automatic**: Resolvers continuously call predicate, no TEE monitoring needed
- **Flexible**: Can add custom conditions (price, time, funding rate, etc.)
- **Gas-efficient**: Predicate uses `view` function, no gas cost for resolvers
- **Reliable**: Multiple resolvers ensure execution when conditions met

### 3. Order Types

#### Market Orders
- Execute immediately after short confirmation
- Use current market price
- Suitable for `executionMode: 'instant'`
- Returns transaction hash immediately

#### Limit Orders
- Create Fusion order with confirmed short entry price as target
- Fusion resolvers monitor and execute when price matches
- Suitable for `executionMode: 'optimized'`
- Returns Fusion order ID for tracking
- Transaction hash available after resolver execution

## Data Flow

### Context State Management

**Input** (from OpenPerpetualShortOperation):
```typescript
context.state.get('shortPosition') = {
  entryPrice: string,
  amount: string,
  transactionHash: string,
  pair: string,
  leverage: number,
  timestamp: number
}
```

**Output** (stored by SpotBuyOperation):
```typescript
context.state.set('spotHolding', {
  asset: string,
  amount: string,
  transactionHash?: string,      // For market orders
  fusionOrderId?: string,         // For limit orders
  executionPrice?: string,
  targetPrice?: string,
  amountSpent: string,
  orderType: 'market' | 'limit',
  status: 'filled' | 'pending',
  timestamp: number
})
```

## 1inch Fusion Integration

### Service Interface

The `OneInchService` interface supports conditional orders with smart contract predicates:

```typescript
interface OneInchService {
  /**
   * Creates a conditional Fusion order with smart contract predicate
   */
  createConditionalFusionOrder(params: {
    // Order parameters
    asset: string;
    amount: string;
    targetPrice: string;
    wallet: SecureWallet;
    slippage: number;
    
    // Predicate parameters (for conditional execution)
    predicateContract: string;        // Address of FusionTriggerPredicate
    predicateFunction: string;        // Function to call
    predicateParams: {                // Parameters for predicate
      positionId: string;             // Short position ID
      expectedEntryPrice: string;     // Expected entry price
    };
  }): Promise<{
    fusionOrderId: string;            // Order ID for tracking
    predicateAddress: string;         // Predicate contract used
    estimatedExecutionTime: number;   // Estimated time until execution
  }>;
  
  /**
   * Legacy method for immediate market orders
   */
  executeFusionSwap(params: {
    asset: string;
    amount: string;
    orderType: 'market' | 'limit';
    targetPrice?: string;
    wallet: SecureWallet;
    slippage: number;
  }): Promise<{
    amountReceived?: string;
    executionPrice?: string;
    transactionHash?: string;
    fusionOrderId?: string;
    gasUsed?: string;
  }>;
}
```

### Fusion Resolver Network with Predicates

The resolver network provides the callback mechanism through smart contract predicates:

1. **Order Creation**: TEE creates Fusion order with predicate contract address
2. **Predicate Monitoring**: Resolvers continuously call predicate contract's `view` function
3. **Condition Check**: Predicate checks if short position is confirmed on-chain
4. **Execution**: When predicate returns `true`, resolver executes the order
5. **Competition**: Multiple resolvers compete for best execution
6. **Settlement**: User receives assets at target price or better

### Predicate Contract Flow

```
Resolver → Calls Predicate.checkShortPositionConfirmed()
              ↓
         Predicate → Queries Perpetual DEX Contract
              ↓
         Checks: Position exists?
                 Sufficient confirmations?
                 Price within range?
              ↓
         Returns: (true, actualEntryPrice) or (false, 0)
              ↓
Resolver → If true: Execute Fusion order
           If false: Wait and check again
```

## Benefits of This Approach

### 1. Proper Delta-Neutral Positioning
- Spot buy only happens after short is confirmed
- Uses actual confirmed entry price, not estimates
- Ensures balanced position from the start

### 2. No Active Monitoring Required
- TEE doesn't need to continuously monitor
- Fusion resolvers handle execution automatically
- Reduces TEE resource usage

### 3. Better Price Execution
- Limit orders can wait for optimal price
- Fusion resolvers compete for best execution
- Slippage protection built-in

### 4. Reliable Execution
- Multiple resolvers ensure order fills
- Automatic retry mechanisms
- Transparent on-chain settlement

## Error Handling

### Missing Short Position
```typescript
if (!shortPosition || !shortPosition.transactionHash) {
  return {
    success: false,
    error: {
      code: 'MISSING_SHORT_POSITION',
      message: 'Short position details not available',
      recoverable: false
    }
  };
}
```

### Confirmation Timeout
```typescript
// In waitForShortConfirmation()
if (confirmationTimeout) {
  throw new Error('Short position confirmation timeout');
}
```

### Fusion Order Creation Failure
```typescript
catch (error) {
  return {
    success: false,
    error: {
      code: 'SPOT_BUY_FAILED',
      message: 'Failed to execute spot buy',
      recoverable: true
    }
  };
}
```

## Testing Considerations

### Unit Tests
- Mock short position confirmation
- Test both market and limit order paths
- Verify price referencing logic
- Test error conditions

### Integration Tests
- Test with real blockchain (testnet)
- Verify Fusion order creation
- Monitor resolver execution
- Validate final position balance

## Future Enhancements

### 1. Advanced Confirmation Logic
- Support multiple confirmation levels
- Handle chain reorganizations
- Implement exponential backoff

### 2. Fusion Order Monitoring
- Track order status in real-time
- Handle partial fills
- Support order cancellation

### 3. Price Optimization
- Dynamic spread adjustment
- Multi-DEX price comparison
- MEV protection strategies

## References

- [1inch Fusion Documentation](https://docs.1inch.io/docs/fusion-swap/introduction)
- [1inch Resolver Network](https://docs.1inch.io/docs/fusion-swap/resolvers)
- [Delta-Neutral Strategies](https://www.investopedia.com/terms/d/deltaneutral.asp)
