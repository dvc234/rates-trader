# Protocol Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    STRATEGY LAYER                            │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ BTCDeltaNeutral      │  │ ETHDeltaNeutral      │        │
│  │ Strategy             │  │ Strategy             │        │
│  └──────────────────────┘  └──────────────────────┘        │
└────────────────────┬────────────────────┬───────────────────┘
                     │                    │
                     │ Serialized Ops     │
                     ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    TEE EXECUTOR                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Operation Router                                      │  │
│  │ - Reads 'exchange' parameter                         │  │
│  │ - Routes to appropriate protocol handler             │  │
│  └──────────────────────────────────────────────────────┘  │
│                     │                                        │
│        ┌────────────┴────────────┐                         │
│        ▼                         ▼                          │
│  ┌──────────┐            ┌──────────────┐                 │
│  │ Spot     │            │ Perpetual    │                 │
│  │ Handler  │            │ Handler      │                 │
│  └──────────┘            └──────────────┘                 │
└────────┬─────────────────────────┬───────────────────────┘
         │                         │
         │                         │
         ▼                         ▼
┌─────────────────┐      ┌──────────────────┐
│  1inch Fusion   │      │  Avantis         │
│  (Base)         │      │  (Base)          │
│                 │      │                  │
│  - Spot Buy     │      │  - Check Funding │
│  - Spot Sell    │      │  - Open Short    │
│  - MEV Protected│      │  - Open Long     │
│  - No Gas Fees  │      │  - Close Position│
└─────────────────┘      └──────────────────┘
```

## Operation Routing

```
┌─────────────────────────────────────────────────────────────┐
│                    OPERATION TYPES                           │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
        ┌───────────────┐       ┌───────────────┐
        │ SPOT TRADING  │       │  PERPETUALS   │
        └───────────────┘       └───────────────┘
                │                       │
        ┌───────┴───────┐       ┌───────┴────────────┐
        ▼               ▼       ▼                    ▼
    SPOT_BUY      SPOT_SELL   OPEN_LONG         OPEN_SHORT
        │               │       │                    │
        │               │       │                    │
        ▼               ▼       ▼                    ▼
    ┌─────────────────────┐   ┌──────────────────────┐
    │   1inch Fusion      │   │   Avantis            │
    │   exchange:         │   │   exchange:          │
    │   '1inch-fusion'    │   │   'avantis'          │
    └─────────────────────┘   └──────────────────────┘
                                        │
                                ┌───────┴────────┐
                                ▼                ▼
                          CLOSE_LONG      CLOSE_SHORT
                                │                │
                                ▼                ▼
                          ┌──────────────────────┐
                          │   Avantis            │
                          │   exchange:          │
                          │   'avantis'          │
                          └──────────────────────┘
                                        │
                                        ▼
                              CHECK_FUNDING_RATE
                                        │
                                        ▼
                          ┌──────────────────────┐
                          │   Avantis            │
                          │   exchange:          │
                          │   'avantis'          │
                          └──────────────────────┘
```

## BTC Strategy Flow

```
┌──────────────────────────────────────────────────────────────┐
│              BTC Delta Neutral Strategy                       │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │ 1. CHECK_FUNDING_RATE             │
        │    Ticker: BTC/USDC               │
        │    Exchange: avantis              │
        │    MinRate: 0.01%                 │
        └───────────────────────────────────┘
                            │
                            ▼ (if rate > 0.01%)
        ┌───────────────────────────────────┐
        │ 2. OPEN_SHORT                     │
        │    Ticker: BTC/USDC               │
        │    Exchange: avantis              │
        │    Size: 50% (1x leverage)        │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │ 3. SPOT_BUY                       │
        │    Ticker: BTC/USDC               │
        │    Exchange: 1inch-fusion         │
        │    Amount: 50%                    │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │ RESULT: Delta Neutral Position    │
        │ - Short BTC perp (Avantis)        │
        │ - Long BTC spot (1inch)           │
        │ - Collecting funding payments     │
        └───────────────────────────────────┘
```

## ETH Strategy Flow

```
┌──────────────────────────────────────────────────────────────┐
│              ETH Delta Neutral Strategy                       │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │ 1. CHECK_FUNDING_RATE             │
        │    Ticker: ETH/USDC               │
        │    Exchange: avantis              │
        │    MinRate: 0.01%                 │
        └───────────────────────────────────┘
                            │
                            ▼ (if rate > 0.01%)
        ┌───────────────────────────────────┐
        │ 2. OPEN_SHORT                     │
        │    Ticker: ETH/USDC               │
        │    Exchange: avantis              │
        │    Size: 50% (1x leverage)        │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │ 3. SPOT_BUY                       │
        │    Ticker: ETH/USDC               │
        │    Exchange: 1inch-fusion         │
        │    Amount: 50%                    │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │ RESULT: Delta Neutral Position    │
        │ - Short ETH perp (Avantis)        │
        │ - Long ETH spot (1inch)           │
        │ - Collecting funding payments     │
        └───────────────────────────────────┘
```

## Protocol Integration Points

```
┌─────────────────────────────────────────────────────────────┐
│                    BASE NETWORK                              │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
        ▼                                       ▼
┌──────────────────┐                  ┌──────────────────┐
│  1inch Fusion    │                  │  Avantis         │
│  Integration     │                  │  Integration     │
└──────────────────┘                  └──────────────────┘
        │                                       │
        │                                       │
┌───────┴────────┐                    ┌─────────┴─────────┐
│ Fusion API     │                    │ Avantis Core      │
│ - Create Order │                    │ - Get Funding     │
│ - Submit Order │                    │ - Open Position   │
│ - Track Fill   │                    │ - Close Position  │
└────────────────┘                    └───────────────────┘
        │                                       │
        ▼                                       ▼
┌────────────────┐                    ┌───────────────────┐
│ Resolver       │                    │ Market Contract   │
│ Network        │                    │ (BTC/ETH)         │
└────────────────┘                    └───────────────────┘
```

## Data Flow

```
USER INPUT
    │
    ├─ Capital: $1000 USDC
    ├─ Strategy: BTC Delta Neutral
    └─ Config: Slippage 1%
    │
    ▼
STRATEGY SERIALIZATION
    │
    ├─ Operation 1: check_funding_rate (avantis)
    ├─ Operation 2: open_short (avantis)
    └─ Operation 3: spot_buy (1inch-fusion)
    │
    ▼
TEE EXECUTION
    │
    ├─ Route to Avantis: Check funding = 0.015% ✓
    ├─ Route to Avantis: Open short 0.015 BTC @ $65k
    └─ Route to 1inch: Buy 0.015 BTC @ $65k
    │
    ▼
PROTOCOL EXECUTION
    │
    ├─ Avantis: Position opened, tx: 0xabc...
    └─ 1inch: Order filled, tx: 0xdef...
    │
    ▼
RESULT TO USER
    │
    ├─ Success ✓
    ├─ Short Position: 0.015 BTC @ $65,000
    ├─ Spot Holding: 0.015 BTC @ $65,000
    ├─ Daily Funding: ~$0.98
    └─ Delta Exposure: 0% (neutral)
```

## Configuration Structure

```typescript
// src/config/protocols.ts
{
  '1inch-fusion': {
    name: '1inch Fusion',
    type: 'spot',
    networks: ['base', ...],
    // Used for: SPOT_BUY, SPOT_SELL
  },
  
  'avantis': {
    name: 'Avantis',
    type: 'perpetual',
    networks: ['base', ...],
    addresses: { base: '0x...' },
    // Used for: OPEN_LONG, OPEN_SHORT, 
    //           CLOSE_LONG, CLOSE_SHORT,
    //           CHECK_FUNDING_RATE
  }
}
```

## Security Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                      PUBLIC (User Sees)                      │
│  - Strategy name: "BTC Delta Neutral Funding"               │
│  - Risk: Low                                                │
│  - APR: 15-45%                                              │
│  - Results: Positions, PnL, Gas                             │
└─────────────────────────────────────────────────────────────┘
                            │
                ════════════╪════════════
                  ENCRYPTION BOUNDARY
                ════════════╪════════════
                            │
┌─────────────────────────────────────────────────────────────┐
│                   PROTECTED (TEE Only)                       │
│  - Protocol: avantis                                        │
│  - Protocol: 1inch-fusion                                   │
│  - Funding threshold: 0.01%                                 │
│  - Capital split: 50/50                                     │
│  - Operation sequence                                       │
│  - API keys and credentials                                 │
└─────────────────────────────────────────────────────────────┘
```

