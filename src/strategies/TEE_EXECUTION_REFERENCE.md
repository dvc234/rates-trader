# TEE Execution Reference

This document describes how the TEE would deserialize and execute strategy operations. This code runs ONLY in the TEE and is never exposed to users.

## Deserialization Flow

### 1. Receive Serialized Strategy
```typescript
// TEE receives encrypted serialized strategy
const encryptedData = receiveFromUser();
const decrypted = decrypt(encryptedData);
const strategyData = JSON.parse(decrypted);

// strategyData structure:
{
  strategyId: string,
  strategyName: string,
  version: string,
  operations: StrategyOperation[]
}
```

### 2. Parse Operations
```typescript
// Each operation contains:
{
  type: OperationType,
  order: number,
  params: OperationParams,
  label?: string,
  optional?: boolean
}
```

### 3. Execute Operations Sequentially

```typescript
// Pseudo-code for TEE execution
async function executeStrategy(
  operations: StrategyOperation[],
  config: StrategyConfig,
  userWallet: Wallet
): Promise<ExecutionResult> {
  
  const results = new Map<string, any>();
  const metrics = {
    positions: [],
    spotTrades: [],
    closedPositions: [],
    fundingRates: {},
    prices: {},
    gasUsed: '0'
  };
  
  // Sort by order
  const sorted = operations.sort((a, b) => a.order - b.order);
  
  for (const operation of sorted) {
    try {
      const result = await executeOperation(
        operation,
        config,
        userWallet,
        results
      );
      
      // Store result if labeled
      if (operation.label) {
        results.set(operation.label, result);
      }
      
      // Update metrics
      updateMetrics(metrics, operation, result);
      
    } catch (error) {
      if (!operation.optional) {
        throw error; // Stop execution
      }
      // Continue if optional
    }
  }
  
  return {
    success: true,
    executedOperations: sorted.length,
    metrics
  };
}
```

## Operation Execution Handlers

### SPOT_BUY
```typescript
async function executeSpotBuy(
  params: SpotBuyParams,
  config: StrategyConfig,
  wallet: Wallet
): Promise<SpotTradeDetails> {
  
  const { ticker, amount, isPercentage, maxPrice, exchange } = params;
  
  // Calculate actual amount
  const capital = await getAvailableCapital(wallet);
  const buyAmount = isPercentage 
    ? (parseFloat(amount) / 100) * capital
    : parseFloat(amount);
  
  // Get current price
  const currentPrice = await getPrice(ticker, exchange);
  
  // Check max price
  if (maxPrice && currentPrice > parseFloat(maxPrice)) {
    throw new Error('Price exceeds maximum');
  }
  
  // Execute buy order
  const order = await executeBuyOrder(
    ticker,
    buyAmount,
    config.executionMode === 'instant' ? 'market' : 'limit',
    config.slippageTolerance,
    wallet,
    exchange
  );
  
  return {
    type: 'buy',
    ticker,
    asset: ticker.split('/')[0],
    amount: order.filled,
    executionPrice: order.price,
    transactionHash: order.txHash
  };
}
```

### OPEN_LONG
```typescript
async function executeOpenLong(
  params: OpenLongParams,
  config: StrategyConfig,
  wallet: Wallet
): Promise<PositionDetails> {
  
  const { ticker, size, leverage, isPercentage, stopLoss, takeProfit, exchange } = params;
  
  // Calculate position size
  const capital = await getAvailableCapital(wallet);
  const positionSize = isPercentage
    ? (parseFloat(size) / 100) * capital
    : parseFloat(size);
  
  // Open leveraged long position
  const position = await openLongPosition(
    ticker,
    positionSize,
    leverage,
    config.slippageTolerance,
    wallet,
    exchange
  );
  
  // Set stop loss and take profit if provided
  if (stopLoss) {
    const stopPrice = position.entryPrice * parseFloat(stopLoss);
    await setStopLoss(position.id, stopPrice, wallet, exchange);
  }
  
  if (takeProfit) {
    const targetPrice = position.entryPrice * parseFloat(takeProfit);
    await setTakeProfit(position.id, targetPrice, wallet, exchange);
  }
  
  return {
    type: 'long',
    ticker,
    entryPrice: position.entryPrice,
    size: position.size,
    leverage,
    transactionHash: position.txHash,
    stopLoss: stopLoss ? (position.entryPrice * parseFloat(stopLoss)).toString() : undefined,
    takeProfit: takeProfit ? (position.entryPrice * parseFloat(takeProfit)).toString() : undefined
  };
}
```

### CHECK_FUNDING_RATE
```typescript
async function executeCheckFundingRate(
  params: CheckFundingRateParams,
  exchange?: string
): Promise<number> {
  
  const { ticker, minRate, maxRate } = params;
  
  // Get current funding rate
  const fundingRate = await getFundingRate(ticker, exchange);
  
  // Check thresholds
  if (minRate !== undefined && fundingRate < minRate) {
    throw new Error(`Funding rate ${fundingRate} below minimum ${minRate}`);
  }
  
  if (maxRate !== undefined && fundingRate > maxRate) {
    throw new Error(`Funding rate ${fundingRate} above maximum ${maxRate}`);
  }
  
  return fundingRate;
}
```

### CHECK_PRICE
```typescript
async function executeCheckPrice(
  params: CheckPriceParams,
  exchange?: string
): Promise<string> {
  
  const { ticker, operator, targetPrice } = params;
  
  // Get current price
  const currentPrice = await getPrice(ticker, exchange);
  const target = parseFloat(targetPrice);
  
  // Check condition
  const conditions = {
    'gt': currentPrice > target,
    'lt': currentPrice < target,
    'gte': currentPrice >= target,
    'lte': currentPrice <= target,
    'eq': Math.abs(currentPrice - target) < 0.01
  };
  
  if (!conditions[operator]) {
    throw new Error(`Price condition not met: ${currentPrice} ${operator} ${target}`);
  }
  
  return currentPrice.toString();
}
```

### CLOSE_LONG
```typescript
async function executeCloseLong(
  params: CloseLongParams,
  config: StrategyConfig,
  wallet: Wallet
): Promise<ClosedPositionDetails> {
  
  const { ticker, amount, closeAll, minPrice, exchange } = params;
  
  // Get open position
  const position = await getOpenPosition(ticker, 'long', wallet, exchange);
  
  if (!position) {
    throw new Error('No open long position found');
  }
  
  // Calculate close amount
  const closeAmount = closeAll
    ? position.size
    : isPercentage
      ? (parseFloat(amount) / 100) * position.size
      : parseFloat(amount);
  
  // Get current price
  const currentPrice = await getPrice(ticker, exchange);
  
  // Check min price
  if (minPrice && currentPrice < parseFloat(minPrice)) {
    throw new Error('Price below minimum');
  }
  
  // Close position
  const result = await closePosition(
    position.id,
    closeAmount,
    config.slippageTolerance,
    wallet,
    exchange
  );
  
  // Calculate PnL
  const pnl = (result.exitPrice - position.entryPrice) * closeAmount * position.leverage;
  
  return {
    ticker,
    type: 'long',
    exitPrice: result.exitPrice,
    pnl: pnl.toString(),
    transactionHash: result.txHash
  };
}
```

### WAIT
```typescript
async function executeWait(
  params: WaitParams,
  results: Map<string, any>
): Promise<void> {
  
  const { duration, condition } = params;
  
  if (condition) {
    // Wait for condition to be true
    const startTime = Date.now();
    while (Date.now() - startTime < duration) {
      if (evaluateCondition(condition, results)) {
        return;
      }
      await sleep(1000); // Check every second
    }
    throw new Error('Wait condition timeout');
  } else {
    // Simple duration wait
    await sleep(duration);
  }
}
```

## Security Considerations

### What Stays in TEE
1. **Operation Logic** - All execution code
2. **Parameters** - Exact amounts, prices, thresholds
3. **Conditions** - Decision logic and triggers
4. **Timing** - Wait durations and schedules
5. **Private Keys** - User wallet credentials
6. **Intermediate Results** - Operation outputs used in conditions

### What Leaves TEE
1. **Final Results** - Positions opened/closed
2. **Transaction Hashes** - On-chain proof
3. **Aggregated Metrics** - Total gas, PnL
4. **Success/Failure Status** - Execution outcome

### Encryption
- All data entering TEE is encrypted
- All data leaving TEE is encrypted
- Only final results are decrypted for user
- Operation details never leave TEE

## Result Aggregation

```typescript
function updateMetrics(
  metrics: ExecutionMetrics,
  operation: StrategyOperation,
  result: any
): void {
  
  switch (operation.type) {
    case OperationType.SPOT_BUY:
    case OperationType.SPOT_SELL:
      metrics.spotTrades.push(result);
      break;
      
    case OperationType.OPEN_LONG:
    case OperationType.OPEN_SHORT:
      metrics.positions.push(result);
      break;
      
    case OperationType.CLOSE_LONG:
    case OperationType.CLOSE_SHORT:
      metrics.closedPositions.push(result);
      break;
      
    case OperationType.CHECK_FUNDING_RATE:
      metrics.fundingRates[operation.params.ticker] = result;
      break;
      
    case OperationType.CHECK_PRICE:
      metrics.prices[operation.params.ticker] = result;
      break;
  }
  
  // Accumulate gas
  if (result.gasUsed) {
    metrics.gasUsed = (
      BigInt(metrics.gasUsed) + BigInt(result.gasUsed)
    ).toString();
  }
}
```

## Error Handling

```typescript
function handleExecutionError(
  error: Error,
  operation: StrategyOperation,
  executedOps: number
): ExecutionResult {
  
  return {
    success: false,
    executedOperations: executedOps,
    error: operation.optional 
      ? `Optional operation failed: ${error.message}`
      : `Execution failed at operation ${executedOps + 1}: ${error.message}`,
    metrics: undefined
  };
}
```

## Notes

- This is reference documentation only
- Actual TEE implementation would be in a secure enclave
- All sensitive data remains encrypted in TEE
- Users never see operation details or intermediate results
- Only final execution outcomes are returned to users
