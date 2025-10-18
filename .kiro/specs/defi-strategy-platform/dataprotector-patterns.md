# DataProtector Usage Patterns - Audit Findings

## Overview

This document summarizes the existing DataProtector integration in the iExec starter code and identifies reusable patterns for implementing strategy purchase functionality in the DeFi Strategy Platform.

## Current Implementation Analysis

### 1. DataProtector Initialization Pattern

**Location**: `src/app/page.tsx` - `useEffect` hook (lines ~111-128)

**Current Implementation**:
```typescript
useEffect(() => {
  const initializeDataProtector = async () => {
    if (isConnected && connector) {
      try {
        const provider = await connector.getProvider() as Eip1193Provider;
        const dataProtector = new IExecDataProtector(provider, {
          allowExperimentalNetworks: true,
        });
        setDataProtectorCore(dataProtector.core);
      } catch (error) {
        console.error("Failed to initialize data protector:", error);
      }
    }
  };
  initializeDataProtector();
}, [isConnected, connector]);
```

**Key Insights**:
- Requires wallet connection (wagmi connector)
- Needs EIP-1193 provider from connector
- `allowExperimentalNetworks: true` enables testnet support (Arbitrum Sepolia)
- Returns `dataProtectorCore` for API operations

**Reusable for Strategy Platform**:
✅ **YES** - This exact pattern can be extracted into `StrategyDataProtectorService`

**Recommended Refactor**:
```typescript
class StrategyDataProtectorService {
  private dataProtectorCore: IExecDataProtectorCore | null = null;
  
  async initialize(connector: Connector): Promise<void> {
    const provider = await connector.getProvider() as Eip1193Provider;
    const dataProtector = new IExecDataProtector(provider, {
      allowExperimentalNetworks: true,
    });
    this.dataProtectorCore = dataProtector.core;
  }
  
  getCore(): IExecDataProtectorCore {
    if (!this.dataProtectorCore) {
      throw new Error("DataProtector not initialized");
    }
    return this.dataProtectorCore;
  }
}
```

---

### 2. Protect Data Pattern

**Location**: `src/app/page.tsx` - `protectData()` function (lines ~161-180)

**Current Implementation**:
```typescript
const protectData = async (event: { preventDefault: () => void }) => {
  event.preventDefault();
  if (dataProtectorCore) {
    setIsLoading(true);
    try {
      const protectedData = await dataProtectorCore.protectData({
        name: dataToProtect.name,
        data: {
          email: dataToProtect.data,
        },
      });
      setProtectedData(protectedData);
    } catch (error) {
      console.error("Error protecting data:", error);
    } finally {
      setIsLoading(false);
    }
  }
};
```

**Key Insights**:
- Accepts `name` (human-readable identifier) and `data` (object to encrypt)
- Data can be any JSON-serializable object
- Returns `ProtectedData` with unique `address` field
- Address serves as identifier for granting access
- Loading state management for UX

**Reusable for Strategy Platform**:
✅ **YES** - Core pattern applies directly to strategy encryption

**Adaptation for Strategy Purchase**:
```typescript
async protectStrategy(
  strategyName: string,
  operations: IOperation[],
  metadata: StrategyMetadata
): Promise<ProtectedData> {
  const serializedOperations = JSON.stringify(operations);
  
  return await this.dataProtectorCore.protectData({
    name: strategyName,
    data: {
      operations: serializedOperations,
      metadata: {
        description: metadata.description,
        riskLevel: metadata.riskLevel,
        aprRange: metadata.aprRange,
        version: metadata.version,
        createdAt: Date.now(),
      }
    },
  });
}
```

**Strategy Data Structure**:
- `name`: Strategy name (e.g., "Funding Rate Arbitrage Strategy")
- `data.operations`: Serialized array of IOperation objects
- `data.metadata`: Strategy metadata (description, risk, APR, etc.)

---

### 3. Grant Access Pattern

**Location**: `src/app/page.tsx` - `grantDataAccess()` function (lines ~130-159)

**Current Implementation**:
```typescript
const grantDataAccess = async (event: React.FormEvent) => {
  event.preventDefault();
  if (dataProtectorCore) {
    setIsGrantingAccess(true);
    try {
      const result = await dataProtectorCore.grantAccess({
        protectedData: grantAccessData.protectedDataAddress,
        authorizedApp: grantAccessData.authorizedApp,
        authorizedUser: grantAccessData.authorizedUser,
        pricePerAccess: grantAccessData.pricePerAccess,
        numberOfAccess: grantAccessData.numberOfAccess,
        onStatusUpdate: ({ title, isDone }) => {
          console.log(`Grant Access Status: ${title}, Done: ${isDone}`);
        },
      });
      setGrantedAccess(result);
    } catch (error) {
      console.error("Error granting access:", error);
    } finally {
      setIsGrantingAccess(false);
    }
  }
};
```

**Key Insights**:
- Grants permission for specific app/user to access protected data
- `protectedData`: Address from `protectData()` result
- `authorizedApp`: iExec app address (TEE executor)
- `authorizedUser`: Wallet address (0x0000... for any user)
- `pricePerAccess`: Cost in nRLC (nano RLC, 1 RLC = 10^9 nRLC)
- `numberOfAccess`: Maximum access count
- `onStatusUpdate`: Progress callback for UX
- Returns `GrantedAccess` object with access details

**Reusable for Strategy Platform**:
✅ **YES** - This is the core of strategy purchase flow

**Adaptation for Strategy Purchase**:
```typescript
async purchaseStrategy(
  strategyId: string,
  protectedDataAddress: string,
  buyerAddress: string,
  teeExecutorAddress: string,
  priceInRLC: number
): Promise<GrantedAccess> {
  // First, buyer pays RLC tokens (separate transaction)
  // Then, seller grants access to buyer
  
  return await this.dataProtectorCore.grantAccess({
    protectedData: protectedDataAddress,
    authorizedApp: teeExecutorAddress, // TEE strategy executor
    authorizedUser: buyerAddress, // Buyer's wallet
    pricePerAccess: 0, // Already paid upfront
    numberOfAccess: 999999, // Unlimited executions
    onStatusUpdate: ({ title, isDone }) => {
      // Update UI with progress
      console.log(`Purchase Status: ${title}, Done: ${isDone}`);
    },
  });
}
```

**Purchase Flow**:
1. User clicks "Purchase Strategy" button
2. Request RLC token approval for strategy price
3. Execute RLC transfer to strategy seller
4. Seller grants access via `grantAccess()`
5. Buyer receives `GrantedAccess` as proof of ownership
6. Buyer can now execute strategy in TEE

---

### 4. Access Verification Pattern

**Current Implementation**: Not explicitly shown in starter code, but implied

**Needed for Strategy Platform**:
```typescript
async verifyStrategyOwnership(
  userAddress: string,
  protectedDataAddress: string
): Promise<boolean> {
  try {
    // Query DataProtector for user's granted access
    const userProtectedData = await this.dataProtectorCore.fetchProtectedData({
      owner: userAddress,
    });
    
    // Check if user has access to this specific protected data
    return userProtectedData.some(
      (data) => data.address === protectedDataAddress
    );
  } catch (error) {
    console.error("Error verifying ownership:", error);
    return false;
  }
}
```

**Usage**:
- Before strategy execution, verify user owns the strategy
- Before showing "Execute" button, check ownership
- Prevents unauthorized execution attempts

---

## State Management Patterns

### Current State Structure

```typescript
// DataProtector instance
const [dataProtectorCore, setDataProtectorCore] = 
  useState<IExecDataProtectorCore | null>(null);

// Form input state
const [dataToProtect, setDataToProtect] = useState({
  name: "",
  data: "",
});

// Result state
const [protectedData, setProtectedData] = useState<ProtectedData>();

// Loading state
const [isLoading, setIsLoading] = useState(false);

// Grant access state
const [grantAccessData, setGrantAccessData] = useState({
  protectedDataAddress: "",
  authorizedApp: "",
  authorizedUser: "",
  pricePerAccess: 0,
  numberOfAccess: 1,
});
const [grantedAccess, setGrantedAccess] = useState<GrantedAccess>();
const [isGrantingAccess, setIsGrantingAccess] = useState(false);
```

### Recommended State for Strategy Platform

```typescript
// Service instance (singleton or context)
const strategyDataProtectorService = useStrategyDataProtectorService();

// Marketplace state
const [availableStrategies, setAvailableStrategies] = useState<Strategy[]>([]);
const [ownedStrategies, setOwnedStrategies] = useState<Strategy[]>([]);

// Purchase state
const [isPurchasing, setIsPurchasing] = useState(false);
const [purchaseResult, setPurchaseResult] = useState<GrantedAccess | null>(null);

// Execution state (separate component)
const [isExecuting, setIsExecuting] = useState(false);
const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
```

---

## Error Handling Patterns

### Current Implementation
```typescript
try {
  // DataProtector operation
} catch (error) {
  console.error("Error:", error);
}
```

**Improvement Needed**:
- User-friendly error messages
- Specific error type handling
- Retry logic for network failures

### Recommended Error Handling

```typescript
class DataProtectorError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: any
  ) {
    super(message);
  }
}

async protectStrategy(...): Promise<ProtectedData> {
  try {
    return await this.dataProtectorCore.protectData({...});
  } catch (error: any) {
    if (error.message?.includes("insufficient funds")) {
      throw new DataProtectorError(
        "Insufficient RLC balance to protect data",
        "INSUFFICIENT_FUNDS",
        error
      );
    }
    if (error.message?.includes("user rejected")) {
      throw new DataProtectorError(
        "Transaction rejected by user",
        "USER_REJECTED",
        error
      );
    }
    throw new DataProtectorError(
      "Failed to protect strategy data",
      "PROTECTION_FAILED",
      error
    );
  }
}
```

---

## Progress Tracking Pattern

### Current Implementation
```typescript
onStatusUpdate: ({ title, isDone }) => {
  console.log(`Grant Access Status: ${title}, Done: ${isDone}`);
}
```

**Reusable for Strategy Platform**:
✅ **YES** - Can be used for purchase progress UI

### Recommended Enhancement

```typescript
interface ProgressUpdate {
  step: string;
  title: string;
  isDone: boolean;
  timestamp: number;
}

const [purchaseProgress, setPurchaseProgress] = useState<ProgressUpdate[]>([]);

// In purchaseStrategy method
onStatusUpdate: ({ title, isDone }) => {
  setPurchaseProgress(prev => [...prev, {
    step: title,
    title: title,
    isDone: isDone,
    timestamp: Date.now(),
  }]);
}
```

**UI Display**:
- Show progress steps in modal/sidebar
- Indicate current step with spinner
- Mark completed steps with checkmark
- Estimate remaining time

---

## Network Configuration

### Current Networks
- **iExec Sidechain (Bellecour)**: Chain ID 134
- **Arbitrum One**: Chain ID 42161
- **Arbitrum Sepolia**: Chain ID 421614 (testnet)

### Strategy Platform Networks
- **Arbitrum Sepolia**: RLC payments, DataProtector operations
- **Base Mainnet**: Strategy execution (DEX interactions)

**Important**: DataProtector operations must happen on Arbitrum Sepolia, but strategy execution happens on Base. The TEE executor bridges this gap.

---

## Key Takeaways for Strategy Purchase Implementation

### ✅ Directly Reusable Patterns

1. **Initialization**: Extract into `StrategyDataProtectorService.initialize()`
2. **Protect Data**: Adapt for strategy operations + metadata
3. **Grant Access**: Core of purchase flow after RLC payment
4. **Progress Tracking**: Use `onStatusUpdate` for purchase UX
5. **State Management**: Similar structure for marketplace/execution

### 🔧 Patterns Needing Adaptation

1. **Data Structure**: Change from `{ email }` to `{ operations, metadata }`
2. **Access Parameters**: Set `numberOfAccess` to high value for unlimited executions
3. **Pricing**: Implement RLC payment before `grantAccess()`
4. **Ownership Verification**: Add method to check user's granted access

### 🆕 New Patterns Needed

1. **Strategy Serialization**: Convert IOperation[] to JSON for encryption
2. **RLC Token Approval**: Request user approval for RLC spending
3. **RLC Payment**: Transfer RLC from buyer to seller
4. **Ownership Caching**: Store owned strategies locally for performance
5. **Multi-Step Purchase Flow**: Combine approval + payment + grant access

---

## Recommended Service Architecture

```typescript
class StrategyDataProtectorService {
  private dataProtectorCore: IExecDataProtectorCore | null = null;
  
  // Initialization
  async initialize(connector: Connector): Promise<void>
  
  // Strategy Creation (for sellers)
  async protectStrategy(
    name: string,
    operations: IOperation[],
    metadata: StrategyMetadata
  ): Promise<ProtectedData>
  
  // Strategy Purchase (for buyers)
  async purchaseStrategy(
    strategyId: string,
    protectedDataAddress: string,
    buyerAddress: string,
    teeExecutorAddress: string,
    priceInRLC: number,
    onProgress?: (update: ProgressUpdate) => void
  ): Promise<GrantedAccess>
  
  // Ownership Verification
  async verifyOwnership(
    userAddress: string,
    protectedDataAddress: string
  ): Promise<boolean>
  
  // Query User's Strategies
  async getUserStrategies(
    userAddress: string
  ): Promise<ProtectedData[]>
}
```

---

## Testing Considerations

### Unit Tests Needed
- ✅ Service initialization with mock provider
- ✅ Strategy protection with mock operations
- ✅ Grant access with mock parameters
- ✅ Ownership verification with mock data
- ✅ Error handling for each method

### Integration Tests Needed
- ✅ End-to-end purchase flow on testnet
- ✅ Verify encrypted data can be decrypted in TEE
- ✅ Test with actual RLC token transfers
- ✅ Verify access grants work with TEE executor

---

## Documentation References

- **DataProtector SDK**: https://docs.iex.ec/references/dataProtector
- **iExec Explorer**: https://explorer.iex.ec/
- **Current Implementation**: `src/app/page.tsx`

---

## Next Steps

1. ✅ **Task 0.2 Complete**: DataProtector patterns documented
2. **Task 0.3**: Identify reusable vs removable components
3. **Task 0.4**: Create comprehensive audit findings document
4. **Phase 2**: Implement `StrategyDataProtectorService` based on these patterns
5. **Phase 2**: Integrate purchase flow into marketplace UI

---

*Document created as part of Task 0.2: Review existing DataProtector integration*
*Last updated: 2025-10-18*
