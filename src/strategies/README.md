# Strategy System - Composable Operations

This directory contains strategy implementations that execute in the TEE (Trusted Execution Environment). The strategy operations are protected and hidden from users - they only see metadata like name, description, risk level, and APR.

## Current Strategies

### 1. MockStrategy
Testing strategy for TEE validation - executes mock operations without real trades.

### 2. BTCDeltaNeutralStrategy
Delta neutral funding arbitrage on BTC/USDC using Synthetix v3 (perpetuals) and 1inch Fusion (spot).

### 3. ETHDeltaNeutralStrategy
Delta neutral funding arbitrage on ETH/USDC using Synthetix v3 (perpetuals) and 1inch Fusion (spot).

## Architecture

### Core Components

1. **StrategyOperation** - Individual atomic operations (buy, sell, open long, etc.)
2. **StrategyBuilder** - Fluent API for composing multiple operations
3. **Strategy Interface** - Base interface all strategies implement
4. **TEE Execution** - Operations execute securely in the TEE
5. **Protocol Integration** - Routes operations to specific protocols (1inch Fusion, Synthetix v3)

### Operation Types

#### Spot Trading (via 1inch Fusion)
- `SPOT_BUY` - Buy assets on spot market
- `SPOT_SELL` - Sell assets on spot market

#### Perpetual Positions (via Synthetix v3)
- `OPEN_LONG` - Open leveraged long position
- `OPEN_SHORT` - Open leveraged short position
- `CLOSE_LONG` - Close long position
- `CLOSE_SHORT` - Close short position

#### Market Analysis (via Synthetix v3)
- `CHECK_FUNDING_RATE` - Check perpetual funding rates
- `CHECK_PRICE` - Check current price against threshold
- `CHECK_LIQUIDITY` - Check market liquidity

#### Control Flow
- `CONDITIONAL` - Execute operations based on conditions
- `WAIT` - Wait for duration or condition

## Protocol Integration

All operations specify which protocol to use via the `exchange` parameter:

- **Spot Orders:** `exchange: '1inch-fusion'`
- **Perpetual Orders:** `exchange: 'synthetix-v3'`

See `src/config/protocols.ts` for protocol configurations.

## Creating a Strategy

### Using StrategyBuilder

```typescript
import { StrategyBuilder } from '../types/strategyBuilder';

const builder = new StrategyBuilder();

const operations = builder
  // Check funding rate on Synthetix v3
  .checkFundingRate('ETH/USDC', {
    minRate: 0.01,
    exchange: 'synthetix-v3',
    label: 'fundingCheck'
  })
  // Open short position on Synthetix v3
  .openShort('ETH/USDC', '50', 1, {
    isPercentage: true,
    exchange: 'synthetix-v3',
    label: 'shortPosition'
  })
  // Hedge with spot buy via 1inch Fusion
  .spotBuy('ETH/USDC', '50', {
    isPercentage: true,
    exchange: '1inch-fusion',
    label: 'spotHedge'
  })
  .build();
```

### Manual Operation Creation

```typescript
import { StrategyOperation, OperationType } from '../types/strategy';

const operations: StrategyOperation[] = [
  {
    type: OperationType.CHECK_FUNDING_RATE,
    order: 1,
    params: {
      ticker: 'BTC/USDC',
      minRate: 0.01,
      exchange: 'synthetix-v3'
    },
    label: 'fundingCheck'
  },
  {
    type: OperationType.OPEN_SHORT,
    order: 2,
    params: {
      ticker: 'BTC/USDC',
      size: '50',
      leverage: 1,
      isPercentage: true,
      exchange: 'synthetix-v3'
    },
    label: 'shortPosition'
  },
  {
    type: OperationType.SPOT_BUY,
    order: 3,
    params: {
      ticker: 'BTC/USDC',
      amount: '50',
      isPercentage: true,
      exchange: '1inch-fusion'
    },
    label: 'spotHedge'
  }
];
```

## Implemented Strategies

### BTC Delta Neutral Funding
**File:** `BTCDeltaNeutralStrategy.ts`

Captures BTC funding rate profits while maintaining delta neutral exposure:
1. Check BTC funding rate on Synthetix v3 (min 0.01%)
2. Open short perpetual on BTC/USDC (50% capital, 1x leverage)
3. Buy spot BTC via 1inch Fusion (50% capital)
4. Collect funding payments while maintaining zero directional exposure

**Risk:** Low | **APR:** 15-45% | **Price:** 50 RLC

### ETH Delta Neutral Funding
**File:** `ETHDeltaNeutralStrategy.ts`

Captures ETH funding rate profits while maintaining delta neutral exposure:
1. Check ETH funding rate on Synthetix v3 (min 0.01%)
2. Open short perpetual on ETH/USDC (50% capital, 1x leverage)
3. Buy spot ETH via 1inch Fusion (50% capital)
4. Collect funding payments while maintaining zero directional exposure

**Risk:** Low | **APR:** 15-45% | **Price:** 50 RLC

## Security & Privacy

### TEE Protection
- All operation logic executes in TEE
- Users cannot see operation details
- Only serialized encrypted data leaves TEE
- Results show outcomes, not methods

### What Users See
- Strategy name and description
- Risk level (low/medium/high)
- Expected APR range
- Price in RLC tokens
- Execution results (positions, trades, PnL)

### What Users Don't See
- Specific operation sequence
- Exact parameters (amounts, prices, thresholds)
- Conditional logic
- Timing and wait periods
- Technical indicators used

## Operation Parameters

### Common Parameters
- `ticker` - Trading pair (e.g., 'ETH/USDC', 'BTC/USDC')
- `exchange` - Protocol to use ('1inch-fusion' for spot, 'synthetix-v3' for perpetuals)
- `label` - Reference label for operation result
- `optional` - Whether operation can fail without stopping execution

### Amount Specifications
- Absolute: `"1000"` (1000 USDC)
- Percentage: `"50"` with `isPercentage: true` (50% of capital)

### Price Specifications
- `maxPrice` - Maximum price for buys
- `minPrice` - Minimum price for sells
- `stopLoss` - Stop loss as multiplier (e.g., "0.95" = 5% loss)
- `takeProfit` - Take profit as multiplier (e.g., "1.10" = 10% gain)

## Base Network & USDC

All strategies are optimized for Base network and use USDC as the quote currency:
- **Trading Pairs:** BTC/USDC, ETH/USDC
- **Stablecoin:** USDC (native to Base)
- **Spot Protocol:** 1inch Fusion
- **Perpetual Protocol:** Synthetix v3

## Best Practices

1. **Always validate config** - Implement proper validation in `validate()` method
2. **Use labels** - Label operations for result tracking
3. **Specify protocols** - Always include `exchange` parameter for clarity
4. **Check conditions** - Use CHECK operations before executing trades
5. **Handle failures** - Mark risky operations as `optional: true`
6. **Serialize properly** - Include all necessary data in `serialize()` method
7. **Document risk** - Clearly communicate risk level to users
8. **Use USDC pairs** - Stick to USDC for Base network compatibility

## Testing

Test strategies with MockStrategy first to validate:
- Serialization/deserialization
- TEE communication
- Result handling
- Error scenarios

## Adding New Strategies

To add a new strategy:

1. Create new file in `src/strategies/` (e.g., `SOLDeltaNeutralStrategy.ts`)
2. Implement `Strategy` interface
3. Use `StrategyBuilder` to compose operations
4. Specify protocols via `exchange` parameter
5. Add validation logic in `validate()` method
6. Export from `src/strategies/index.ts`
7. Test with TEE integration

## Adding New Operations

To add a new operation type:

1. Add to `OperationType` enum in `src/types/strategy.ts`
2. Create params interface (e.g., `NewOperationParams`)
3. Add to `OperationParams` union type
4. Add builder method to `StrategyBuilder`
5. Implement TEE executor handler
6. Update `ExecutionResult` metrics if needed

## File Structure

```
src/strategies/
├── index.ts                        # Exports all strategies
├── MockStrategy.ts                 # Test strategy
├── BTCDeltaNeutralStrategy.ts     # BTC delta neutral + funding
├── ETHDeltaNeutralStrategy.ts     # ETH delta neutral + funding
├── README.md                       # This file
└── TEE_EXECUTION_REFERENCE.md     # TEE implementation guide
```

## Related Documentation

- **Protocol Integration:** See `PROTOCOL_INTEGRATION.md` for protocol details
- **Protocol Config:** See `src/config/protocols.ts` for protocol configurations
- **Type Definitions:** See `src/types/strategy.ts` for all types
- **Strategy Builder:** See `src/types/strategyBuilder.ts` for builder API
