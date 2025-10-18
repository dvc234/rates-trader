# Strategy System Architecture

## Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│  (Only sees: name, description, risk, APR, price, results)     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Purchase & Execute
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      STRATEGY MARKETPLACE                        │
│  - MockStrategy                                                  │
│  - DeltaNeutralStrategy                                         │
│  - FundingArbitrageStrategy                                     │
│  - MomentumScalpStrategy                                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ serialize()
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ENCRYPTED OPERATIONS                          │
│  {                                                               │
│    strategyId: "...",                                           │
│    operations: [                                                │
│      { type: SPOT_BUY, params: {...} },                        │
│      { type: OPEN_LONG, params: {...} },                       │
│      { type: CHECK_FUNDING_RATE, params: {...} }               │
│    ]                                                            │
│  }                                                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Encrypted transmission
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TEE (Trusted Execution)                       │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 1. Decrypt operations                                      │ │
│  │ 2. Deserialize to StrategyOperation[]                     │ │
│  │ 3. Sort by operation.order field (ascending)              │ │
│  │ 4. Execute STRICTLY IN ORDER (no reordering):            │ │
│  │    operations[0] → operations[1] → operations[2] → ...   │ │
│  │    - Each operation executes only after previous completes│ │
│  │    - Order is determined by strategy creator              │ │
│  │    - TEE never modifies execution sequence                │ │
│  │ 5. Aggregate results                                      │ │
│  │ 6. Encrypt and return ExecutionResult                    │ │
│  └───────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Encrypted results
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EXECUTION RESULT                            │
│  {                                                               │
│    success: true,                                               │
│    executedOperations: 3,                                       │
│    metrics: {                                                   │
│      positions: [...],                                          │
│      spotTrades: [...],                                         │
│      closedPositions: [...],                                    │
│      gasUsed: "...",                                           │
│      profitEstimate: 123.45                                    │
│    }                                                            │
│  }                                                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Display to user
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         USER SEES                                │
│  ✓ Strategy executed successfully                               │
│  ✓ 3 operations completed                                       │
│  ✓ Positions: 1 long ETH/USDT @ $2,000                        │
│  ✓ Spot trades: Bought 0.5 ETH @ $2,000                       │
│  ✓ Estimated profit: $123.45                                   │
│                                                                  │
│  ✗ DOES NOT SEE:                                               │
│    - Exact operation sequence                                   │
│    - Parameter values (amounts, thresholds)                     │
│    - Conditional logic                                          │
│    - Timing and wait periods                                    │
└─────────────────────────────────────────────────────────────────┘
```

## Operation Flow

```
┌──────────────────┐
│ StrategyBuilder  │  Composable API for creating strategies
└────────┬─────────┘
         │
         │ .spotBuy()        → order: 0
         │ .openLong()       → order: 1
         │ .checkFundingRate() → order: 2
         │ .build()
         ▼
┌──────────────────────┐
│ StrategyOperation[]  │  Array of typed operations (ORDERED)
└────────┬─────────────┘
         │
         │ Each operation has:
         │ - type: OperationType
         │ - order: number (CRITICAL: defines execution sequence)
         │ - params: TypedParams
         │ - label?: string
         │ - optional?: boolean
         │
         │ TEE MUST execute in order: 0 → 1 → 2 → 3 → ...
         ▼
┌──────────────────────┐
│   Strategy Class     │  Implements Strategy interface
│   - serialize()      │  Converts to JSON for TEE
│   - validate()       │  Validates config
│   - getOperations()  │  Returns operations array
└────────┬─────────────┘
         │
         │ serialize()
         ▼
┌──────────────────────┐
│   JSON String        │  Ready for TEE transmission
└──────────────────────┘
```

## Operation Types Hierarchy

```
OperationType (enum)
├── Testing
│   └── MOCK_OPERATION
│
├── Spot Trading
│   ├── SPOT_BUY
│   └── SPOT_SELL
│
├── Perpetual Positions
│   ├── Long
│   │   ├── OPEN_LONG
│   │   └── CLOSE_LONG
│   └── Short
│       ├── OPEN_SHORT
│       └── CLOSE_SHORT
│
├── Market Analysis (read-only)
│   ├── CHECK_FUNDING_RATE
│   ├── CHECK_PRICE
│   └── CHECK_LIQUIDITY
│
└── Control Flow
    ├── CONDITIONAL
    └── WAIT
```

## Parameter Types

```
OperationParams (union type)
├── SpotBuyParams
│   ├── ticker: string
│   ├── amount: string
│   ├── isPercentage?: boolean
│   ├── maxPrice?: string
│   └── exchange?: string
│
├── OpenLongParams
│   ├── ticker: string
│   ├── size: string
│   ├── leverage: number
│   ├── isPercentage?: boolean
│   ├── stopLoss?: string
│   ├── takeProfit?: string
│   └── exchange?: string
│
├── CheckFundingRateParams
│   ├── ticker: string
│   ├── minRate?: number
│   ├── maxRate?: number
│   └── exchange?: string
│
└── ... (all other operation types)
```

## Data Flow: User → TEE → User

```
USER SIDE                    TEE SIDE                    USER SIDE
─────────                    ────────                    ─────────

Strategy                     Encrypted                   Execution
Metadata     ──encrypt──>    Operations    ──decrypt──>  Result
(visible)                    (hidden)                    (visible)

name                         operations[]                success
description                  ├─ type                     executedOps
risk                         ├─ order                    metrics
apr                          ├─ params                   ├─ positions
price                        │  ├─ ticker                │  └─ details
                            │  ├─ amount                 ├─ spotTrades
                            │  ├─ leverage               │  └─ details
                            │  └─ ...                    └─ gasUsed
                            ├─ label
                            └─ optional

     ↓                            ↓                           ↓
  VISIBLE                      HIDDEN                     VISIBLE
```

## Security Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                      PUBLIC ZONE                             │
│  - Strategy metadata (name, description, risk, APR)         │
│  - Execution results (positions, trades, PnL)               │
│  - Transaction hashes (on-chain proof)                      │
└─────────────────────────────────────────────────────────────┘
                              │
                    ══════════╪══════════
                    ENCRYPTION BOUNDARY
                    ══════════╪══════════
                              │
┌─────────────────────────────────────────────────────────────┐
│                    PROTECTED ZONE (TEE)                      │
│  - Operation types and sequence                             │
│  - Exact parameters (amounts, prices, thresholds)           │
│  - Conditional logic and triggers                           │
│  - Timing and wait periods                                  │
│  - Intermediate calculation results                         │
│  - Private keys and wallet credentials                      │
└─────────────────────────────────────────────────────────────┘
```

## Example: Funding Arbitrage Flow

```
1. USER PURCHASES STRATEGY
   ↓
   Sees: "Funding Rate Arbitrage - Low Risk - 15-40% APR"
   
2. USER CONFIGURES & EXECUTES
   ↓
   Provides: capital allocation, slippage tolerance
   
3. STRATEGY SERIALIZES (Hidden from user)
   ↓
   operations: [
     { order: 0, type: CHECK_FUNDING_RATE, params: { ticker: "ETH/USDT", minRate: 0.01 } },
     { order: 1, type: OPEN_SHORT, params: { ticker: "ETH/USDT", size: "50", leverage: 1 } },
     { order: 2, type: SPOT_BUY, params: { ticker: "ETH/USDT", amount: "50" } }
   ]
   
4. TEE EXECUTES IN EXACT ORDER (Hidden from user)
   ↓
   Step 0: Checks funding rate: 0.015% ✓
   Step 1: Opens short: 0.5 ETH @ $2,000 ✓
   Step 2: Buys spot: 0.5 ETH @ $2,000 ✓
   
   (TEE cannot reorder - must execute 0 → 1 → 2)
   
5. USER RECEIVES RESULT
   ↓
   Sees: 
   - Success ✓
   - Position: Short 0.5 ETH @ $2,000
   - Spot: Bought 0.5 ETH @ $2,000
   - Estimated daily funding: $0.30
```

## Composability Example

```typescript
// Strategy creator composes operations
const strategy = new StrategyBuilder()
  .checkFundingRate('ETH/USDT', { minRate: 0.01 })  // order: 0
  .openShort('ETH/USDT', '50', 1)                   // order: 1
  .spotBuy('ETH/USDT', '50')                        // order: 2
  .wait(28800000)                                    // order: 3
  .closeShort('ETH/USDT', { closeAll: true })       // order: 4
  .spotSell('ETH/USDT', '100', { isPercentage: true }) // order: 5
  .build();

// TEE EXECUTION ORDER (immutable):
// 0 → 1 → 2 → 3 → 4 → 5
// TEE cannot optimize, reorder, or parallelize
// Order is defined by strategy creator and enforced by TEE

// User only sees:
// "Funding Rate Arbitrage - Captures funding rate profits"
// Never sees the operation sequence or parameters
```
