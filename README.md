# 🚀 DeFi Strategy Platform - Confidential Execution with iExec

A decentralized platform for creating, purchasing, and executing DeFi strategies with confidential execution powered by iExec TEE (Trusted Execution Environment).

---

## 📋 What is This?

This platform enables users to:

- **Browse** pre-built DeFi strategies (Delta Neutral, Funding Rate Arbitrage, etc.)
- **Purchase** strategies securely using RLC tokens
- **Execute** strategies confidentially in a TEE environment
- **Track** positions and performance across multiple protocols

**Key Features:**
- ✅ Confidential strategy execution (operations hidden in TEE)
- ✅ Multi-protocol support (1inch Fusion, Avantis, and more)
- ✅ Encrypted strategy data with iExec DataProtector
- ✅ Cross-chain architecture (Arbitrum for payments, Base for execution)
- ✅ Built with Next.js, TypeScript, and Tailwind CSS

---

## 🛠️ Quick Start

### Prerequisites

- Node.js 18+ and npm
- A Web3 wallet (MetaMask, Coinbase Wallet, etc.)
- Basic understanding of DeFi concepts

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd <project-folder>
npm install
```

### 2. Get Your Reown Project ID

1. Go to [https://cloud.reown.com/app](https://cloud.reown.com/app)
2. Create a new project
3. Select **AppKit** → **Next.js**
4. Copy your Project ID

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Required: Wallet Connection
NEXT_PUBLIC_REOWN_PROJECT_ID=your_reown_project_id_here

# Required: Base Network RPC
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org

# Optional: Enable/Disable Features
NEXT_PUBLIC_ENABLE_1INCH=false
NEXT_PUBLIC_PERPS_PROTOCOL=avantis
```

**For Development/Testing:**
- The above configuration is sufficient to run the app with mock strategies
- No DEX addresses or TEE setup required initially

**For Production (Real Strategies):**
- See [IEXEC_SETUP.md](./IEXEC_SETUP.md) for TEE configuration
- See [contracts/DEPLOYMENT_GUIDE.md](./contracts/DEPLOYMENT_GUIDE.md) for smart contract deployment

### 4. Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Connect Your Wallet

1. Click "Connect Wallet" in the app
2. Select your wallet (MetaMask, Coinbase, etc.)
3. Approve the connection

You're ready to explore strategies!

---

## 🎯 Usage Guide

### For Users (Strategy Buyers)

1. **Browse Marketplace**
   - View available strategies with risk/APR info
   - Read strategy descriptions and requirements

2. **Purchase a Strategy**
   - Click "Purchase" on any strategy
   - Approve RLC token spending
   - Confirm transaction (strategy data is encrypted and stored)

3. **Execute Your Strategy**
   - Go to "My Strategies" tab
   - Configure execution parameters (capital, slippage, etc.)
   - Click "Execute" to run in TEE
   - Monitor execution status and results

### For Developers (Strategy Creators)

1. **Create a Strategy**
   - See [src/strategies/README.md](./src/strategies/README.md) for strategy development guide
   - Use the Strategy Builder API to define operations
   - Test with mock operations before deploying

2. **Deploy TEE Executor**
   - Follow [IEXEC_SETUP.md](./IEXEC_SETUP.md) to set up iExec TEE
   - Build and deploy your iApp using iApp Generator
   - Configure the app address in `.env.local`

3. **Deploy Smart Contracts**
   - Follow [contracts/DEPLOYMENT_GUIDE.md](./contracts/DEPLOYMENT_GUIDE.md)
   - Deploy position predicates for your protocols
   - Update contract addresses in configuration

---

## 📁 Project Structure

```
├── src/
│   ├── app/                    # Next.js app router pages
│   ├── components/             # React components
│   │   ├── AppLayout.tsx       # Main layout with tabs
│   │   ├── MarketplaceView.tsx # Strategy marketplace
│   │   ├── MyStrategiesView.tsx # User's owned strategies
│   │   └── StrategyCard.tsx    # Strategy display card
│   ├── strategies/             # Strategy definitions
│   │   ├── BTCDeltaNeutralStrategy.ts
│   │   ├── FundingRatesStrategy.ts
│   │   └── README.md           # Strategy development guide
│   ├── services/               # Core services
│   │   ├── IExecExecutionService.ts      # TEE execution
│   │   └── StrategyDataProtectorService.ts # Data encryption
│   ├── config/                 # Configuration files
│   └── types/                  # TypeScript types
├── tee/                        # TEE executor code
│   ├── executor/               # Strategy execution engine
│   ├── operations/             # Operation handlers
│   └── README.md               # TEE development guide
├── contracts/                  # Smart contracts
│   ├── AvantisPositionPredicate.sol
│   └── DEPLOYMENT_GUIDE.md
└── scripts/                    # Utility scripts
```

---

## 🌐 Network Architecture

The platform uses multiple networks for different purposes:

### Payment Layer (Arbitrum Sepolia)
- Strategy purchases with RLC tokens
- Access control and ownership tracking
- Testnet for development

### Data Layer (iExec Bellecour)
- Encrypted strategy data storage
- TEE coordination and execution
- Data Protector operations

### Execution Layer (Base Mainnet)
- DEX interactions (1inch, Uniswap, etc.)
- Perpetual positions (Avantis, GMX, etc.)
- Actual strategy execution

**Flow:**
```
User → Purchase (Arbitrum) → Encrypt (Bellecour) → Execute (TEE → Base) → Results
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Validate environment configuration
npm run check:env

# Check runtime dependencies
npm run check:runtime
```

---

## 🔒 Security Features

### Confidential Execution
- Strategy operations are encrypted with iExec DataProtector
- Only the TEE can decrypt and execute operations
- Users can't see the internal logic of purchased strategies

### Access Control
- Ownership verified on-chain before execution
- Only strategy buyers can execute their purchased strategies
- TEE validates permissions before decryption

### Secure Key Management
- User wallet keys never leave the browser
- TEE uses isolated key management for trade execution
- No private keys in logs or results

---

## 📚 Documentation

### Getting Started
- [IEXEC_SETUP.md](./IEXEC_SETUP.md) - Complete iExec TEE setup guide
- [IEXEC_QUICK_REFERENCE.md](./IEXEC_QUICK_REFERENCE.md) - Quick reference for common tasks

### Architecture
- [PROTOCOL_ARCHITECTURE.md](./PROTOCOL_ARCHITECTURE.md) - System architecture diagrams
- [ARCHITECTURE_DIAGRAM.md](./ARCHITECTURE_DIAGRAM.md) - Visual architecture overview

### Development
- [src/strategies/README.md](./src/strategies/README.md) - Strategy development guide
- [src/strategies/TEE_EXECUTION_REFERENCE.md](./src/strategies/TEE_EXECUTION_REFERENCE.md) - TEE execution details
- [tee/README.md](./tee/README.md) - TEE executor documentation

### Deployment
- [contracts/DEPLOYMENT_GUIDE.md](./contracts/DEPLOYMENT_GUIDE.md) - Smart contract deployment
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - Pre-launch checklist
- [AVANTIS_DEPLOYMENT_GUIDE.md](./AVANTIS_DEPLOYMENT_GUIDE.md) - Avantis integration guide

---

## 🛠️ Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Lint code
npm test             # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:ui      # Run tests with UI
npm run check:env    # Validate environment variables
npm run check:runtime # Check runtime dependencies
```

---

## 🧩 Compatible Wallets

The following wallets are compatible with iExec Bellecour:

- ✅ MetaMask
- ✅ Coinbase Wallet
- ✅ Brave Wallet
- ✅ WalletConnect
- ✅ Zerion

❌ Other wallets may not work with iExec SDKs.

---

## 🚀 Deployment

### Frontend Deployment

Deploy to Vercel, Netlify, or any Next.js hosting:

```bash
npm run build
npm start
```

### TEE Deployment

1. Build your iApp with iApp Generator
2. Deploy to iExec network
3. Update `NEXT_PUBLIC_IEXEC_APP_ADDRESS` in production environment

See [IEXEC_SETUP.md](./IEXEC_SETUP.md) for detailed instructions.

### Smart Contract Deployment

Deploy position predicates and other contracts:

```bash
cd contracts
# Follow DEPLOYMENT_GUIDE.md
```

---

## 📝 License

This project is open source and available under the MIT License.

---