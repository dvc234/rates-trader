# Marketplace Component Tests

This directory contains comprehensive tests for the marketplace components of the DeFi Strategy Platform.

## Test Coverage

### StrategyCard Tests (`StrategyCard.test.tsx`)
- **15 tests** covering:
  - Strategy card rendering with all details (name, description, risk, APR, price)
  - Risk level color coding (low/green, medium/yellow, high/red)
  - Conditional button rendering (purchase vs execute based on ownership)
  - Loading states
  - User interactions (purchase and execute callbacks)
  - Edge cases and error handling

### MarketplaceView Tests (`MarketplaceView.test.tsx`)
- **14 tests** covering:
  - Wallet connection states and prompts
  - Loading skeleton display
  - Strategy grid layout rendering
  - Strategy ownership integration with localStorage
  - User interactions (purchase and execute)
  - Error states and retry functionality
  - Responsive grid layout

### AppLayout Tests (`AppLayout.test.tsx`)
- **26 tests** covering:
  - Navigation bar structure
  - Tab navigation (Marketplace and My Strategies)
  - Tab content rendering
  - Wallet connection integration
  - Network switching functionality
  - Responsive design
  - Tab icons
  - Error handling for wallet and network operations

## Running Tests

```bash
# Run all component tests
npm test -- src/components/__tests__

# Run specific test file
npm test -- src/components/__tests__/StrategyCard.test.tsx

# Run tests in watch mode
npm run test:watch -- src/components/__tests__

# Run tests with UI
npm run test:ui
```

## Test Setup

The tests use:
- **Vitest** as the test runner
- **React Testing Library** for component testing
- **@testing-library/user-event** for user interaction simulation
- **jsdom** environment for DOM simulation

### Test Utilities

Custom test utilities are provided in `src/test/test-utils.tsx`:
- `renderWithProviders()` - Wraps components with necessary providers (WagmiProvider, QueryClientProvider)
- Mock wagmi configuration for testing

### Mocking Strategy

Tests use Vitest's mocking capabilities to mock:
- Wagmi hooks (`useAccount`, `useDisconnect`, `useChainId`, `useSwitchChain`)
- Reown AppKit (`useAppKit`)
- Strategy modules (`MockStrategy`, `BTCDeltaNeutralStrategy`, `ETHDeltaNeutralStrategy`)
- Network configurations

## Test Results

All 55 tests pass successfully:
- ✓ StrategyCard: 15/15 tests passing
- ✓ MarketplaceView: 14/14 tests passing
- ✓ AppLayout: 26/26 tests passing

## Requirements Covered

These tests fulfill **Requirement 10.5** from the requirements document:
- WHEN testing UI components THEN the system SHALL include component tests
- Tests verify rendering, user interactions, state management, and error handling
- Tests ensure components work correctly in isolation and with mocked dependencies
