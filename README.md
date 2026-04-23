# ☕ Digital Tip Jar DApp

A highly-responsive, real-time decentralized application built on the Stellar network using Soroban Smart Contracts. This project was developed as a submission for the **Stellar Level 2 Certification**.

## 🚀 Features

- **Real-Time Synchronized Dashboard**: A 3-column layout built with CSS Grid and modern Glassmorphism aesthetics.
- **Smart Contract Interoperability**: Built with a Soroban Rust contract that securely handles `deposit` functions.
- **Wallet Control Center**: Instant Integration with Freighter and xBull via `StellarWalletsKit`.
- **Live Event Scraping**: Continuously polls the Soroban RPC for real-time events to dynamically build an Activity Stream.
- **On-Chain Leaderboard**: Aggregates event payload data to automatically rank the top community supporters.
- **Raw SDK Transaction Building**: Implements `@stellar/stellar-sdk` to assemble, prepare, and submit XDR payloads seamlessly.

## 🛠 Tech Stack

- **Frontend**: React 18, TypeScript, Vite.
- **Blockchain**: Stellar Testnet, Soroban.
- **Smart Contracts**: Rust.
- **Integration**: `@stellar/stellar-sdk`, `@creit.tech/stellar-wallets-kit`.

## 📦 Getting Started

### 1. Install Dependencies
Navigate to the `frontend` folder and install packages:
```bash
cd frontend
npm install --ignore-scripts
```

### 2. Compile and Deploy the Contract
Compile the Rust smart contract into WebAssembly:
```bash
cd contract
cargo build --target wasm32-unknown-unknown --release
```

Deploy your `.wasm` file to the Stellar Testnet:
```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/digital_tip_jar.wasm \
  --source my-wallet \
  --network testnet
```

### 3. Run the DApp
Once deployed, copy your new Contract ID (`C...`) and paste it at the top of your `App.tsx` file. Then fire up the UI:
```bash
npm run dev
```

## 🔐 Security & Error Handling

This application features robust frontend error capturing that traps wallet rejections, balance underfunds, and network timeouts natively before they can crash the primary thread, providing users with immediate, color-coded dashboard feedback via the Transaction Status Log.
